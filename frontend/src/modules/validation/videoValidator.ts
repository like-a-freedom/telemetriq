import type { FileValidation } from '../../core/types';

/** Maximum video file size: 4 GB */
export const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024;

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
export function parseDjiFilename(filename: string): { date: Date; isLocalTime: boolean } | undefined {
    const djiMatch = filename.match(/^DJI_(\d{4})(\d{2})(\d{2})_?(\d{2})(\d{2})(\d{2})/i);
    if (!djiMatch) return undefined;

    const [, year, month, day, hour, minute, second] = djiMatch;
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