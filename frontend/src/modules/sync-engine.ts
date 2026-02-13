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
    console.log('[DEBUG autoSync] Called with:', {
        gpxPointsCount: gpxPoints.length,
        videoStartTime: videoStartTime?.toISOString(),
        videoStartLat,
        videoStartLon,
        videoTimezoneOffsetMinutes
    });
    
    if (gpxPoints.length === 0) {
        throw new SyncError('No track points for synchronization');
    }

    // If we have video GPS coordinates, find nearest point
    if (videoStartLat !== undefined && videoStartLon !== undefined) {
        console.log('[DEBUG autoSync] Using GPS coordinates');
        return syncByGpsCoordinates(gpxPoints, videoStartLat, videoStartLon);
    }

    // If we have video start time, sync by time
    if (videoStartTime) {
        console.log('[DEBUG autoSync] Using time sync');
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
    // Convert local video time to UTC using timezone offset
    // timezoneOffsetMinutes: minutes to ADD to local time to get UTC (e.g., +180 for UTC+3)
    // Note: JavaScript's getTimezoneOffset() returns negative for positive timezones,
    // so we invert the sign when using user-selected timezone
    const timezoneMs = videoTimezoneOffsetMinutes !== undefined
        ? videoTimezoneOffsetMinutes * 60_000
        : 0;
    // Subtract timezone offset to convert local → UTC
    const videoMs = videoTime.getTime() - timezoneMs;
    const gpxStartMs = gpxPoints[0]!.time.getTime();
    // Calculate how far into the GPX track the video starts
    const offsetMs = videoMs - gpxStartMs;
    const offsetSeconds = offsetMs / 1000;

    // DEBUG logging
    console.log('[DEBUG syncByTime] videoTime:', videoTime.toISOString());
    console.log('[DEBUG syncByTime] videoTimezoneOffsetMinutes:', videoTimezoneOffsetMinutes);
    console.log('[DEBUG syncByTime] timezoneMs:', timezoneMs);
    console.log('[DEBUG syncByTime] videoMs (UTC):', new Date(videoMs).toISOString());
    console.log('[DEBUG syncByTime] gpxStartMs:', new Date(gpxStartMs).toISOString());
    console.log('[DEBUG syncByTime] offsetMs:', offsetMs);
    console.log('[DEBUG syncByTime] offsetSeconds:', offsetSeconds);

    // Warn if the offset is too large, but still apply the offset
    // This allows users to sync even when devices were set to different times
    if (Math.abs(offsetSeconds) > MAX_AUTO_OFFSET_SECONDS) {
        return {
            offsetSeconds,
            autoSynced: true, // Still auto-sync, but with warning
            warning: `Large time difference (${formatTimeDiff(Math.abs(offsetSeconds))}). Verify sync manually if needed.`,
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
    const absSeconds = Math.abs(seconds);
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

/**
 * Clamp manual sync offset to allowed range.
 */
export function clampSyncOffset(offsetSeconds: number): number {
    if (!Number.isFinite(offsetSeconds)) return 0;
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
