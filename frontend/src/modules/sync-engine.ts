import type { TrackPoint, SyncConfig } from '../core/types';
import { SyncError } from '../core/errors';
import { haversineDistance } from './telemetry-core';

/** Maximum auto-sync offset in seconds */
const MAX_AUTO_OFFSET_SECONDS = 300; // 5 minutes

/** Manual sync range in seconds (±30 minutes) */
export const MANUAL_SYNC_RANGE_SECONDS = 1800;

/**
 * Resolve effective sync range in seconds.
 * Uses video duration when available, but never exceeds manual range.
 */
export function getSyncRangeSeconds(videoDurationSeconds?: number): number {
    if (!Number.isFinite(videoDurationSeconds) || (videoDurationSeconds ?? 0) <= 0) {
        return MANUAL_SYNC_RANGE_SECONDS;
    }

    return Math.min(MANUAL_SYNC_RANGE_SECONDS, Math.max(1, Math.round(videoDurationSeconds!)));
}

/**
 * Attempt automatic synchronization between GPX and video.
 * Looks for the closest GPX point to the video's GPS start coordinates.
 * Returns a SyncConfig with the computed offset.
 */
export function autoSync(
    gpxPoints: TrackPoint[],
    videoStartTime?: Date,
    videoStartLat?: number,
    videoStartLon?: number,
    videoTimezoneOffsetMinutes?: number,
): SyncConfig {
    if (gpxPoints.length === 0) {
        throw new SyncError('No track points for synchronization');
    }

    // If we have video GPS coordinates, find nearest point
    if (videoStartLat !== undefined && videoStartLon !== undefined) {
        return syncByGpsCoordinates(gpxPoints, videoStartLat, videoStartLon);
    }

    // If we have video start time, sync by time
    if (videoStartTime) {
        return syncByTime(gpxPoints, videoStartTime, videoTimezoneOffsetMinutes);
    }

    // Fallback: use first GPX point as reference (offset = 0)
    return {
        offsetSeconds: 0,
        autoSynced: false,
        warning: 'Auto-sync is not possible without GPS or the video start time.',
    };
}

/**
 * Sync by finding the nearest GPX point to the given GPS coordinates.
 */
function syncByGpsCoordinates(
    gpxPoints: TrackPoint[],
    lat: number,
    lon: number,
): SyncConfig {
    let minDist = Infinity;
    let closestIdx = 0;

    for (let i = 0; i < gpxPoints.length; i++) {
        const point = gpxPoints[i]!;
        const dist = haversineDistance(lat, lon, point.lat, point.lon);
        if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
        }
    }

    const closestPoint = gpxPoints[closestIdx]!;
    const gpxStartTime = gpxPoints[0]!.time.getTime();
    const closestTime = closestPoint.time.getTime();
    const offsetSeconds = (closestTime - gpxStartTime) / 1000;

    return {
        offsetSeconds,
        autoSynced: true,
    };
}

/**
 * Sync by matching video creation time with GPX timestamps.
 */
function syncByTime(
    gpxPoints: TrackPoint[],
    videoTime: Date,
    _videoTimezoneOffsetMinutes?: number,
): SyncConfig {
    // Date already stores an absolute UTC timestamp internally.
    // Applying timezone offset again shifts time twice and breaks auto-sync.
    const videoMs = videoTime.getTime();
    const gpxStartMs = gpxPoints[0]!.time.getTime();
    // Calculate how far into the GPX track the video starts
    const offsetMs = videoMs - gpxStartMs;
    const offsetSeconds = offsetMs / 1000;

    // Warn if the offset is too large, but still apply the offset
    // This allows users to sync even when devices were set to different times
    if (Math.abs(offsetSeconds) > MAX_AUTO_OFFSET_SECONDS) {
        return {
            offsetSeconds,
            autoSynced: true, // Still auto-sync, but with warning
            warning: `Large time difference: ${formatTimeDiff(offsetSeconds)}. Auto-sync was applied — please verify manually.`,
        };
    }

    return {
        offsetSeconds,
        autoSynced: true,
    };
}

/**
 * Format time difference in seconds to human-readable string
 */
function formatTimeDiff(seconds: number): string {
    const totalSeconds = Math.max(0, Math.round(Math.abs(seconds)));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} h`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs} sec`);

    return parts.join(' ');
}

/**
 * Clamp manual sync offset to allowed range.
 */
export function clampSyncOffset(offsetSeconds: number): number {
    return clampSyncOffsetToRange(offsetSeconds, MANUAL_SYNC_RANGE_SECONDS);
}

/**
 * Clamp manual sync offset to allowed range.
 */
export function clampSyncOffsetToRange(offsetSeconds: number, maxAbsSeconds: number): number {
    if (!Number.isFinite(offsetSeconds)) return 0;

    const safeMaxAbsSeconds = Number.isFinite(maxAbsSeconds) && maxAbsSeconds > 0
        ? maxAbsSeconds
        : MANUAL_SYNC_RANGE_SECONDS;

    return Math.max(
        -safeMaxAbsSeconds,
        Math.min(safeMaxAbsSeconds, offsetSeconds),
    );
}

/**
 * Calculate the GPX time range covered by the video.
 */
export function getGpxTimeRange(points: TrackPoint[]): { startMs: number; endMs: number; durationMs: number } | null {
    if (points.length < 2) return null;

    const startMs = points[0]!.time.getTime();
    const endMs = points[points.length - 1]!.time.getTime();

    return {
        startMs,
        endMs,
        durationMs: endMs - startMs,
    };
}
