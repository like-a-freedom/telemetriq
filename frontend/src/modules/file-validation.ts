import type { FileValidation, VideoMeta } from '../core/types';
import { ValidationError } from '../core/errors';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';

/** Maximum video file size: 4 GB */
const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024;

/** Maximum video duration: 60 minutes */
export const MAX_VIDEO_DURATION_SECONDS = 60 * 60;

/** Warning threshold: 30 minutes */
export const WARN_DURATION_SECONDS = 30 * 60;

/** Allowed video MIME types */
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v'];

/** Allowed video extensions */
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v'];

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
            const startTime = file.lastModified ? new Date(file.lastModified) : undefined;
            const meta: VideoMeta = {
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                fps: 30, // Default, will be refined during processing
                codec: 'unknown',
                fileSize: file.size,
                fileName: file.name,
                startTime,
                timezoneOffsetMinutes: startTime ? startTime.getTimezoneOffset() : undefined,
            };

            URL.revokeObjectURL(url);

            if (meta.duration > MAX_VIDEO_DURATION_SECONDS) {
                reject(new ValidationError(
                    `Video is too long: ${Math.round(meta.duration / 60)} min. Max 60 min`,
                ));
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
                    if (mp4Meta.startTime) {
                        meta.startTime = mp4Meta.startTime;
                        meta.timezoneOffsetMinutes = mp4Meta.timezoneOffsetMinutes;
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
    duration?: number;
}> {
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
        const duration = await input.computeDuration();

        const tags = await input.getMetadataTags();
        const created = tags.date;
        const gps = findIso6709Location(tags.raw);

        return {
            codec,
            fps,
            width,
            height,
            duration,
            startTime: created,
            timezoneOffsetMinutes: created ? created.getTimezoneOffset() : undefined,
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
