import type { TrackPoint, SyncConfig } from '../core/types';
import { SyncError } from '../core/errors';
import { haversineDistance } from './telemetry-core';

/** Maximum auto-sync offset in seconds */
const MAX_AUTO_OFFSET_SECONDS = 300; // 5 minutes

/** Manual sync range in seconds (±30 minutes) */
export const MANUAL_SYNC_RANGE_SECONDS = 1800;

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
    videoTimezoneOffsetMinutes?: number,
): SyncConfig {
    const videoMs = videoTimezoneOffsetMinutes !== undefined
        ? videoTime.getTime() - videoTimezoneOffsetMinutes * 60_000
        : videoTime.getTime();
    const gpxStartMs = gpxPoints[0]!.time.getTime();
    // Calculate how far into the GPX track the video starts
    const offsetMs = videoMs - gpxStartMs;
    const offsetSeconds = offsetMs / 1000;

    // Warn if the offset is too large
    if (Math.abs(offsetSeconds) > MAX_AUTO_OFFSET_SECONDS) {
        return {
            offsetSeconds,
            autoSynced: false,
            warning: 'Time difference exceeds 5 minutes. Check the device clock.',
        };
    }

    return {
        offsetSeconds,
        autoSynced: true,
    };
}

/**
 * Clamp manual sync offset to allowed range.
 */
export function clampSyncOffset(offsetSeconds: number): number {
    return Math.max(
        -MANUAL_SYNC_RANGE_SECONDS,
        Math.min(MANUAL_SYNC_RANGE_SECONDS, offsetSeconds),
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
