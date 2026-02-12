/**
 * Video codec utilities for encoder/decoder configuration.
 * Extracted from video-processor for SRP compliance.
 */

import type { VideoMeta } from '../core/types';

/**
 * Get codec candidates for encoding based on source codec and resolution.
 */
export function getCodecCandidates(meta: VideoMeta, sourceCodec: string): string[] {
    const sourceCodecLower = sourceCodec.toLowerCase();
    const avcCandidates = getAvcCodecCandidates(meta);

    if (sourceCodecLower.startsWith('hvc1') || sourceCodecLower.startsWith('hev1')) {
        return [
            'hvc1.1.6.L153.B0',
            'hev1.1.6.L153.B0',
            'hvc1.1.6.L123.B0',
            'hev1.1.6.L123.B0',
            ...avcCandidates,
        ];
    }

    if (sourceCodecLower.startsWith('av01')) {
        return ['av01.0.12M.08', ...avcCandidates];
    }

    if (sourceCodecLower.startsWith('vp09')) {
        return ['vp09.00.41.08', ...avcCandidates];
    }

    return avcCandidates;
}

/**
 * Get AVC (H.264) codec candidates based on resolution.
 */
export function getAvcCodecCandidates(meta: VideoMeta): string[] {
    const pixels = meta.width * meta.height;
    if (pixels > 4096 * 2304) {
        return ['avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.64002A', 'avc1.640029', 'avc1.640028'];
    }
    if (pixels > 1920 * 1080) {
        return ['avc1.640033', 'avc1.640032', 'avc1.64002A', 'avc1.640029', 'avc1.640028'];
    }
    return ['avc1.640029', 'avc1.640028'];
}

/**
 * Scale video dimensions to fit within a maximum area.
 */
export function scaleToMaxArea(meta: VideoMeta, maxArea: number): VideoMeta {
    const area = meta.width * meta.height;
    if (area <= maxArea) return { ...meta };

    const scale = Math.sqrt(maxArea / area);
    const width = Math.max(2, Math.floor(meta.width * scale));
    const height = Math.max(2, Math.floor(meta.height * scale));

    return { ...meta, width, height };
}

/**
 * Estimate bitrate baseline based on resolution.
 */
export function estimateBitrateBaseline(meta: VideoMeta): number {
    const pixels = meta.width * meta.height;
    if (pixels >= 3840 * 2160) return 35_000_000; // 4K: 35 Mbps
    if (pixels >= 1920 * 1080) return 15_000_000; // 1080p: 15 Mbps
    if (pixels >= 1280 * 720) return 8_000_000;   // 720p: 8 Mbps
    return 5_000_000;                              // Default: 5 Mbps
}

/**
 * Estimate target bitrate based on source and target dimensions.
 */
export function estimateTargetBitrate(
    sourceMeta: VideoMeta,
    targetMeta: VideoMeta,
    sourceFileSize: number,
): number {
    const sourceDuration = Math.max(1, sourceMeta.duration || 1);
    const sourceBitrate = Math.round((sourceFileSize * 8) / sourceDuration);

    const sourcePixels = Math.max(1, sourceMeta.width * sourceMeta.height);
    const targetPixels = Math.max(1, targetMeta.width * targetMeta.height);
    const pixelScale = targetPixels / sourcePixels;

    const scaledSourceBitrate = Math.round(sourceBitrate * Math.min(1, pixelScale));
    const baseline = estimateBitrateBaseline(targetMeta);
    const target = Math.max(scaledSourceBitrate, baseline);

    // Keep bitrate sane for browser encoders while preserving source quality intent
    return Math.min(140_000_000, Math.max(5_000_000, target));
}

/**
 * Convert codec string to Mediabunny format.
 */
export function toMediabunnyVideoCodec(codec: string): string {
    const normalized = codec.toLowerCase();
    if (normalized.startsWith('avc1') || normalized.startsWith('avc3')) return 'avc';
    if (normalized.startsWith('hvc1') || normalized.startsWith('hev1')) return 'hevc';
    if (normalized.startsWith('vp09')) return 'vp9';
    if (normalized.startsWith('vp08')) return 'vp8';
    if (normalized.startsWith('av01')) return 'av1';
    return 'avc';
}

/**
 * Convert audio codec string to Mediabunny format.
 */
export function toMediabunnyAudioCodec(codec: string): string {
    const normalized = codec.toLowerCase();
    if (normalized.startsWith('mp4a')) return 'aac';
    if (normalized.startsWith('opus')) return 'opus';
    if (normalized.startsWith('mp3')) return 'mp3';
    if (normalized.startsWith('flac')) return 'flac';
    return 'aac';
}
