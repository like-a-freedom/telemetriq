import type { FileValidation, VideoMeta } from '../core/types';
import { ValidationError } from '../core/errors';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';

/** Maximum video file size: 4 GB */
const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024;

/** Maximum video duration: 60 minutes */
export const MAX_VIDEO_DURATION_SECONDS = 60 * 60;

/** Warning threshold: 30 minutes */
export const WARN_DURATION_SECONDS = 30 * 60;

/**
 * For very large files, skip deep MP4 metadata extraction during upload.
 * This avoids UI freezes when users select multi-GB videos.
 */
export const FAST_METADATA_THRESHOLD_BYTES = 1024 * 1024 * 1024; // 1 GB

/** Allowed video MIME types */
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v'];

/** Allowed video extensions */
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v'];

/**
 * Parse creation time from DJI filename.
 * Format: DJI_YYYYMMDD_HHMMSS e.g., DJI_20260211_092425
 * Returns local Date (without timezone info) - timezone should be handled separately.
 * The time is interpreted as local time, not UTC.
 */
function parseDjiFilename(filename: string): { date: Date; isLocalTime: boolean } | undefined {
    const djiMatch = filename.match(/^DJI_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i);
    if (!djiMatch) return undefined;

    const [, year, month, day, hour, minute, second] = djiMatch;
    // Create date in local timezone (the time in filename is local, not UTC)
    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
    );

    if (Number.isNaN(date.getTime())) return undefined;

    return { date, isLocalTime: true };
}

/**
 * Validate a video file before processing.
 */
export function validateVideoFile(file: File): FileValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
        errors.push(`Unsupported format: ${ext}. Expected MP4 or MOV`);
    }

    if (file.type && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
        // Only add as warning since browsers may not always detect MIME correctly
        warnings.push(`Non-standard MIME type: ${file.type}`);
    }

    if (file.size > MAX_VIDEO_SIZE) {
        errors.push(`File is too large: ${(file.size / (1024 * 1024 * 1024)).toFixed(1)} GB. Max 4 GB`);
    }

    if (file.size === 0) {
        errors.push('File is empty');
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Extract video metadata from a video file.
 * Creates a temporary video element to read duration, dimensions, etc.
 */
export function extractVideoMeta(file: File): Promise<VideoMeta> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        const url = URL.createObjectURL(file);
        video.src = url;

        video.onloadedmetadata = () => {
            // Try DJI filename first (most reliable for drone videos)
            const djiParsed = parseDjiFilename(file.name);
            const djiStartTime = djiParsed?.date;
            // Fallback to lastModified (filesystem time)
            const fsStartTime = file.lastModified ? new Date(file.lastModified) : undefined;
            // Use DJI time if available, otherwise filesystem time
            const startTime = djiStartTime ?? fsStartTime;

            const meta: VideoMeta = {
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                fps: 30, // Default, will be refined during processing
                codec: 'unknown',
                fileSize: file.size,
                fileName: file.name,
                startTime,
                // DJI filename time is local time, convert browser offset to positive timezone
                // getTimezoneOffset() returns negative for positive timezones (e.g., -180 for UTC+3)
                // We invert it so that sync engine can use: localTime - offset = UTC
                timezoneOffsetMinutes: djiParsed ? -djiParsed.date.getTimezoneOffset() : (startTime ? startTime.getTimezoneOffset() : undefined),
            };

            URL.revokeObjectURL(url);

            if (meta.duration > MAX_VIDEO_DURATION_SECONDS) {
                reject(new ValidationError(
                    `Video is too long: ${Math.round(meta.duration / 60)} min. Max 60 min`,
                ));
                return;
            }

            // Fast path for large videos: keep upload responsive and skip
            // expensive container parsing on the critical UI path.
            if (file.size >= FAST_METADATA_THRESHOLD_BYTES) {
                resolve(meta);
                return;
            }

            extractMp4Metadata(file)
                .then((mp4Meta) => {
                    if (mp4Meta.codec) meta.codec = mp4Meta.codec;
                    if (mp4Meta.fps) meta.fps = mp4Meta.fps;
                    if (meta.width <= 0 && mp4Meta.width && mp4Meta.width > 0) {
                        meta.width = mp4Meta.width;
                    }
                    if (meta.height <= 0 && mp4Meta.height && mp4Meta.height > 0) {
                        meta.height = mp4Meta.height;
                    }
                    if ((!Number.isFinite(meta.duration) || meta.duration <= 0)
                        && mp4Meta.duration && mp4Meta.duration > 0) {
                        meta.duration = mp4Meta.duration;
                    }
                    // Use MP4 metadata UTC time as primary source for sync
                    // It's more reliable than DJI filename (which is local time without timezone info)
                    if (mp4Meta.startTime) {
                        meta.startTime = mp4Meta.startTime;
                        meta.timezoneOffsetMinutes = 0; // MP4 creation_time is UTC
                    }
                    if (mp4Meta.gps) meta.gps = mp4Meta.gps;

                })
                .catch(() => undefined)
                .finally(() => {
                    if (meta.width <= 0 || meta.height <= 0) {
                        reject(new ValidationError('Failed to determine video resolution from metadata'));
                        return;
                    }
                    resolve(meta);
                });
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new ValidationError('Failed to read video metadata'));
        };
    });
}

async function extractMp4Metadata(file: File): Promise<{
    startTime?: Date;
    timezoneOffsetMinutes?: number;
    gps?: { lat: number; lon: number };
    codec?: string;
    fps?: number;
    width?: number;
    height?: number;
    rotation?: 0 | 90 | 180 | 270;
    duration?: number;
}> {
    return withSuppressedUnsupportedAudioCodecWarnings(async () => {
        const input = new Input({
            formats: ALL_FORMATS,
            source: new BlobSource(file),
        });

        try {
            const videoTrack = await input.getPrimaryVideoTrack();
            const codec = videoTrack
                ? ((await videoTrack.getCodecParameterString()) ?? (await videoTrack.getDecoderConfig())?.codec)
                : undefined;

            const fps = videoTrack
                ? (await videoTrack.computePacketStats(120)).averagePacketRate
                : undefined;

            const width = videoTrack?.displayWidth;
            const height = videoTrack?.displayHeight;
            const rotation = normalizeRotation(videoTrack?.rotation);

            const tags = await input.getMetadataTags();
            const created = tags.date;
            const gps = findIso6709Location(tags.raw);

            return {
                codec,
                fps,
                width,
                height,
                rotation,
                startTime: created,
                timezoneOffsetMinutes: created ? 0 : undefined, // MP4 creation_time is UTC
                gps,
            };
        } finally {
            const disposable = input as unknown as { [Symbol.dispose]?: () => void };
            try {
                disposable[Symbol.dispose]?.();
            } catch {
                // no-op
            }
        }
    });
}

function normalizeRotation(value: unknown): 0 | 90 | 180 | 270 {
    if (value === 90 || value === 180 || value === 270) return value;
    return 0;
}

async function withSuppressedUnsupportedAudioCodecWarnings<T>(
    operation: () => Promise<T>,
): Promise<T> {
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
        const text = args
            .map((arg) => (typeof arg === 'string' ? arg : String(arg ?? '')))
            .join(' ');

        if (/Unsupported audio codec/i.test(text)) {
            return;
        }

        originalWarn(...args);
    };

    try {
        return await operation();
    } finally {
        console.warn = originalWarn;
    }
}

function findIso6709Location(info: unknown): { lat: number; lon: number } | undefined {
    const isoRegex = /([+-]\d{2,3}\.\d+)([+-]\d{2,3}\.\d+)/;

    const stack: unknown[] = [info];
    while (stack.length) {
        const current = stack.pop();
        if (!current) continue;

        if (typeof current === 'string') {
            const match = current.match(isoRegex);
            if (match) {
                const lat = Number(match[1]);
                const lon = Number(match[2]);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                    return { lat, lon };
                }
            }
        } else if (Array.isArray(current)) {
            for (const item of current) stack.push(item);
        } else if (typeof current === 'object') {
            for (const value of Object.values(current as Record<string, unknown>)) {
                stack.push(value);
            }
        }
    }

    return undefined;
}

/**
 * Check if the browser supports WebCodecs API.
 */
export function isWebCodecsSupported(): boolean {
    return (
        typeof VideoDecoder !== 'undefined' &&
        typeof VideoEncoder !== 'undefined' &&
        typeof VideoFrame !== 'undefined'
    );
}

/**
 * Check if SharedArrayBuffer is available (needed for FFmpeg.wasm).
 */
export function isSharedArrayBufferSupported(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
}

/**
 * Check all required browser capabilities.
 */
export function checkBrowserCapabilities(): { supported: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!isWebCodecsSupported()) {
        missing.push('WebCodecs API');
    }

    if (!isSharedArrayBufferSupported()) {
        missing.push('SharedArrayBuffer');
    }

    if (typeof OffscreenCanvas === 'undefined') {
        missing.push('OffscreenCanvas');
    }

    return {
        supported: missing.length === 0,
        missing,
    };
}
