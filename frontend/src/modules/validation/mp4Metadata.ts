import type { VideoMeta } from '../../core/types';
import { ValidationError } from '../../core/errors';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import {
    parseDjiFilename,
    MAX_VIDEO_DURATION_SECONDS,
    FAST_METADATA_THRESHOLD_BYTES,
} from './videoValidator';
import { extractMp4CreationTimeFromMvhd } from './mp4Binary';
import { findMetadataDate } from './metadataExtractor';
import { findIso6709Location } from './gpsExtractor';

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
            const djiParsed = parseDjiFilename(file.name);

            const meta: VideoMeta = {
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                fps: 30,
                codec: 'unknown',
                fileSize: file.size,
                fileName: file.name,
                startTime: djiParsed?.date,
                timezoneOffsetMinutes: djiParsed
                    ? -djiParsed.date.getTimezoneOffset()
                    : undefined,
            };

            URL.revokeObjectURL(url);

            if (meta.duration > MAX_VIDEO_DURATION_SECONDS) {
                reject(new ValidationError(
                    `Video is too long: ${Math.round(meta.duration / 60)} min. Max 60 min`,
                ));
                return;
            }

            if (file.size >= FAST_METADATA_THRESHOLD_BYTES) {
                extractMp4CreationTimeFromMvhd(file)
                    .then((created) => {
                        if (created) {
                            meta.startTime = created;
                            meta.timezoneOffsetMinutes = 0;
                        }
                        resolve(meta);
                    })
                    .catch(() => {
                        resolve(meta);
                    });
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
                        meta.timezoneOffsetMinutes = 0;
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

export async function extractMp4Metadata(file: File): Promise<{
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
            let videoTrack: Awaited<ReturnType<Input['getPrimaryVideoTrack']>> | undefined;
            try {
                videoTrack = await input.getPrimaryVideoTrack();
            } catch {
                // Some files contain auxiliary data streams that may fail track probing.
            }

            let codec: string | undefined;
            let fps: number | undefined;
            const width = videoTrack?.displayWidth;
            const height = videoTrack?.displayHeight;
            const rotation = normalizeRotation(videoTrack?.rotation);

            if (videoTrack) {
                try {
                    codec = (await videoTrack.getCodecParameterString())
                        ?? (await videoTrack.getDecoderConfig())?.codec;
                } catch {
                    codec = undefined;
                }

                try {
                    fps = (await videoTrack.computePacketStats(120)).averagePacketRate;
                } catch {
                    fps = undefined;
                }
            }

            let tags: Awaited<ReturnType<Input['getMetadataTags']>> | undefined;
            try {
                tags = await input.getMetadataTags();
            } catch {
                tags = undefined;
            }

            const created = findMetadataDate(tags) ?? await extractMp4CreationTimeFromMvhd(file);
            const gps = findIso6709Location(tags?.raw);

            return {
                codec,
                fps,
                width,
                height,
                rotation,
                startTime: created,
                timezoneOffsetMinutes: created ? 0 : undefined,
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