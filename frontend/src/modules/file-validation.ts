import type { FileValidation, VideoMeta } from '../core/types';
import { ValidationError } from '../core/errors';
import { createSafeMP4BoxFile, appendFileToMp4box } from './mp4box-safe';

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
    return new Promise((resolve, reject) => {
        const mp4boxfile = createSafeMP4BoxFile();
        let resolved = false;
        mp4boxfile.onError = (e: unknown) => {
            if (!resolved) {
                resolved = true;
                reject(e);
            }
        };

        mp4boxfile.onReady = (info: any) => {
            if (resolved) return;
            resolved = true;

            const videoTrack = info.tracks?.find((t: any) => t.video) ?? info.tracks?.[0];
            const codec = videoTrack?.codec;
            const fps = videoTrack?.video?.frame_rate
                ? Number(videoTrack.video.frame_rate)
                : undefined;
            const width = videoTrack?.video?.width ? Number(videoTrack.video.width) : undefined;
            const height = videoTrack?.video?.height ? Number(videoTrack.video.height) : undefined;
            const duration =
                typeof info.duration === 'number' && typeof info.timescale === 'number' && info.timescale > 0
                    ? Number(info.duration) / Number(info.timescale)
                    : undefined;

            const created = info.created ? new Date(info.created) : undefined;
            const gps = findIso6709Location(info);

            resolve({
                codec,
                fps,
                width,
                height,
                duration,
                startTime: created,
                timezoneOffsetMinutes: created ? created.getTimezoneOffset() : undefined,
                gps,
            });
        };

        appendFileToMp4box(mp4boxfile, file)
            .then(() => {
                try {
                    mp4boxfile.flush();
                } catch (flushError) {
                    if (!resolved) {
                        resolved = true;
                        reject(flushError);
                    }
                    return;
                }
            })
            .catch((error) => {
                if (!resolved) {
                    resolved = true;
                    reject(error);
                }
            });
    });
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
