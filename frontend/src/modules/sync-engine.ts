import type { TrackPoint, SyncConfig } from '../core/types';
import { SyncError } from '../core/errors';
import { haversineDistance } from './telemetry-core';

/**
 * Buffer around GPX time range: offsets within [−BUFFER, trackDuration + BUFFER]
 * are considered plausible; anything outside triggers a warning.
 */
const TIME_RANGE_BUFFER_SECONDS = 300; // 5 minutes

/** Max divergence between GPS and time offsets to accept GPS refinement */
const GPS_REFINEMENT_TOLERANCE_SECONDS = 30;

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
 * Automatic synchronization between GPX track and video.
 *
 * Offset semantics:
 *   offset = videoCreationTime − gpxStartTime
 *   Positive → video starts after GPX start (skip beginning of GPX)
 *   Negative → video starts before GPX start (no telemetry initially)
 *
 * Strategy (in priority order):
 *   1. Time + GPS → compute time-based offset, refine with GPS if consistent
 *   2. Time only  → use time-based offset directly
 *   3. GPS only   → nearest GPX point to video GPS coordinates
 *   4. Neither    → cannot auto-sync
 */
export function autoSync(
    gpxPoints: TrackPoint[],
    videoStartTime?: Date,
    videoStartLat?: number,
    videoStartLon?: number,
): SyncConfig {
    if (gpxPoints.length === 0) {
        throw new SyncError('No track points for synchronization');
    }

    const hasTime = videoStartTime !== undefined;
    const hasGps = videoStartLat !== undefined && videoStartLon !== undefined;

    if (!hasTime && !hasGps) {
        return {
            offsetSeconds: 0,
            autoSynced: false,
            warning: 'Auto-sync is not possible without GPS or the video start time.',
        };
    }

    // GPS-only path (no video creation time)
    if (!hasTime) {
        return findNearestGps(gpxPoints, videoStartLat!, videoStartLon!);
    }

    // --- Time-based offset ---
    const gpxStartMs = gpxPoints[0]!.time.getTime();
    const gpxEndMs = gpxPoints[gpxPoints.length - 1]!.time.getTime();
    const trackDurationSec = (gpxEndMs - gpxStartMs) / 1000;
    const timeOffset = (videoStartTime!.getTime() - gpxStartMs) / 1000;

    const insideRange =
        timeOffset >= -TIME_RANGE_BUFFER_SECONDS
        && timeOffset <= trackDurationSec + TIME_RANGE_BUFFER_SECONDS;

    // Time + GPS
    if (hasGps) {
        if (insideRange) {
            return refineWithGps(gpxPoints, videoStartLat!, videoStartLon!, timeOffset);
        }

        // Time outside GPX range → fall back to global GPS search
        const gpsResult = findNearestGps(gpxPoints, videoStartLat!, videoStartLon!);
        return {
            ...gpsResult,
            warning: `Video time is outside GPX range (${formatTimeDiff(timeOffset)}). GPS-based sync was applied.`,
        };
    }

    // Time-only
    if (!insideRange) {
        return {
            offsetSeconds: timeOffset,
            autoSynced: true,
            warning: `Video time is outside GPX range (${formatTimeDiff(timeOffset)}). Please verify sync manually.`,
        };
    }

    return { offsetSeconds: timeOffset, autoSynced: true };
}

/**
 * Refine a time-based offset with GPS data.
 * If GPS agrees with time (within tolerance), use GPS for extra precision.
 * Otherwise, trust time-based offset and warn about GPS mismatch.
 */
function refineWithGps(
    gpxPoints: TrackPoint[],
    lat: number,
    lon: number,
    timeOffset: number,
): SyncConfig {
    const gps = findNearestGpsInWindow(
        gpxPoints, lat, lon,
        timeOffset, TIME_RANGE_BUFFER_SECONDS,
    );

    if (!gps) {
        return {
            offsetSeconds: timeOffset,
            autoSynced: true,
            warning: 'Video GPS does not match near the expected time. Time-based sync was applied.',
        };
    }

    const divergence = Math.abs(gps.offsetSeconds - timeOffset);
    if (divergence <= GPS_REFINEMENT_TOLERANCE_SECONDS) {
        return { offsetSeconds: gps.offsetSeconds, autoSynced: true };
    }

    return {
        offsetSeconds: timeOffset,
        autoSynced: true,
        warning: `GPS location differs from video time by ${formatTimeDiff(divergence)}. Time-based sync was applied.`,
    };
}

/**
 * Find nearest GPX point to coordinates (global search across entire track).
 */
function findNearestGps(
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

    const gpxStartMs = gpxPoints[0]!.time.getTime();
    const offsetSeconds = (gpxPoints[closestIdx]!.time.getTime() - gpxStartMs) / 1000;

    return { offsetSeconds, autoSynced: true };
}

/**
 * Find nearest GPX point to coordinates within a time-offset window.
 * Returns undefined if no points exist in the window.
 */
function findNearestGpsInWindow(
    gpxPoints: TrackPoint[],
    lat: number,
    lon: number,
    centerOffset: number,
    windowSeconds: number,
): SyncConfig | undefined {
    const gpxStartMs = gpxPoints[0]!.time.getTime();
    const minOffset = centerOffset - windowSeconds;
    const maxOffset = centerOffset + windowSeconds;

    let minDist = Infinity;
    let closestIdx: number | undefined;

    for (let i = 0; i < gpxPoints.length; i++) {
        const point = gpxPoints[i]!;
        const pointOffset = (point.time.getTime() - gpxStartMs) / 1000;

        if (pointOffset < minOffset || pointOffset > maxOffset) {
            continue;
        }

        const dist = haversineDistance(lat, lon, point.lat, point.lon);
        if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
        }
    }

    if (closestIdx === undefined) {
        return undefined;
    }

    const offsetSeconds = (gpxPoints[closestIdx]!.time.getTime() - gpxStartMs) / 1000;

    return { offsetSeconds, autoSynced: true };
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
