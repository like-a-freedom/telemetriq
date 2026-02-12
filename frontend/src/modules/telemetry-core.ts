import type { TrackPoint, TelemetryFrame } from '../core/types';

/** Earth radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Minimum speed threshold (km/h) to consider "moving" */
const MOVING_SPEED_THRESHOLD = 1.0;

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Calculate cumulative distances for an array of track points.
 * Returns an array of cumulative distances in km (same length as points).
 */
export function calculateCumulativeDistances(points: TrackPoint[]): number[] {
    if (points.length === 0) return [];

    const distances: number[] = [0];

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]!;
        const curr = points[i]!;
        const segmentDist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
        distances.push(distances[i - 1]! + segmentDist);
    }

    return distances;
}

/**
 * Calculate pace in seconds per km between two track points.
 * Returns undefined if distance is too small.
 */
export function calculatePace(
    prevPoint: TrackPoint,
    currPoint: TrackPoint,
    prevDistance: number,
    currDistance: number,
): number | undefined {
    const distKm = currDistance - prevDistance;
    if (distKm < 0.001) return undefined;

    const timeDiffSec = (currPoint.time.getTime() - prevPoint.time.getTime()) / 1000;
    if (timeDiffSec <= 0) return undefined;

    const paceSecPerKm = timeDiffSec / distKm;

    // Clamp unreasonable pace values (faster than 2:00/km or slower than 30:00/km)
    if (paceSecPerKm < 120 || paceSecPerKm > 1800) return undefined;

    return paceSecPerKm;
}

/**
 * Linearly interpolate a numeric value between two points.
 */
export function lerp(v0: number, v1: number, t: number): number {
    return v0 + t * (v1 - v0);
}

/**
 * Interpolate heart rate at a given time between two track points.
 */
export function interpolateHr(
    before: TrackPoint,
    after: TrackPoint,
    targetTime: Date,
): number | undefined {
    if (before.hr === undefined && after.hr === undefined) return undefined;
    if (before.hr === undefined) return after.hr;
    if (after.hr === undefined) return before.hr;

    const totalMs = after.time.getTime() - before.time.getTime();
    if (totalMs <= 0) return before.hr;

    const t = (targetTime.getTime() - before.time.getTime()) / totalMs;
    return Math.round(lerp(before.hr, after.hr, Math.max(0, Math.min(1, t))));
}

/**
 * Format seconds into HH:MM:SS.
 */
export function formatElapsedTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format pace from seconds per km to M:SS string.
 */
export function formatPace(secondsPerKm: number | undefined): string | undefined {
    if (secondsPerKm === undefined) return undefined;
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Build a complete telemetry timeline from track points.
 * Returns an array of TelemetryFrame, one per track point.
 */
export function buildTelemetryTimeline(points: TrackPoint[]): TelemetryFrame[] {
    if (points.length === 0) return [];

    const distances = calculateCumulativeDistances(points);
    const startTime = points[0]!.time.getTime();
    const frames: TelemetryFrame[] = [];

    let movingTimeMs = 0;

    for (let i = 0; i < points.length; i++) {
        const point = points[i]!;
        const timeOffset = (point.time.getTime() - startTime) / 1000;

        let pace: number | undefined;
        if (i > 0) {
            const prevPoint = points[i - 1]!;
            const prevDist = distances[i - 1]!;
            const currDist = distances[i]!;
            pace = calculatePace(prevPoint, point, prevDist, currDist);

            const segmentDist = currDist - prevDist;
            const segmentTime = (point.time.getTime() - prevPoint.time.getTime()) / 1000;
            if (segmentTime > 0) {
                const speedKmh = (segmentDist / segmentTime) * 3600;
                if (speedKmh >= MOVING_SPEED_THRESHOLD) {
                    movingTimeMs += point.time.getTime() - prevPoint.time.getTime();
                }
            }
        }

        frames.push({
            timeOffset,
            hr: point.hr,
            paceSecondsPerKm: pace,
            distanceKm: distances[i]!,
            elapsedTime: formatElapsedTime(timeOffset),
            movingTimeSeconds: movingTimeMs / 1000,
        });
    }

    return frames;
}

/**
 * Get a telemetry frame at a specific video time offset.
 * Uses binary search and linear interpolation.
 */
export function getTelemetryAtTime(
    frames: TelemetryFrame[],
    videoTimeSeconds: number,
    syncOffsetSeconds: number,
): TelemetryFrame | null {
    if (frames.length === 0) return null;
    if (!Number.isFinite(videoTimeSeconds) || !Number.isFinite(syncOffsetSeconds)) return null;

    const gpxTime = videoTimeSeconds + syncOffsetSeconds;
    if (!Number.isFinite(gpxTime)) return null;

    const firstFrame = frames[0]!;
    const lastFrame = frames[frames.length - 1]!;

    if (gpxTime < firstFrame.timeOffset || gpxTime > lastFrame.timeOffset) {
        return null;
    }

    let lo = 0;
    let hi = frames.length - 1;

    while (lo < hi - 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (frames[mid]!.timeOffset <= gpxTime) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    const beforeFrame = frames[lo]!;
    const afterFrame = frames[hi]!;

    if (lo === hi || afterFrame.timeOffset === beforeFrame.timeOffset) {
        return beforeFrame;
    }

    const t = (gpxTime - beforeFrame.timeOffset) / (afterFrame.timeOffset - beforeFrame.timeOffset);

    const interpolatedHr = (beforeFrame.hr !== undefined && afterFrame.hr !== undefined)
        ? Math.round(lerp(beforeFrame.hr, afterFrame.hr, t))
        : (beforeFrame.hr ?? afterFrame.hr);

    const interpolatedDist = lerp(beforeFrame.distanceKm, afterFrame.distanceKm, t);
    const interpolatedMovingTime = lerp(beforeFrame.movingTimeSeconds, afterFrame.movingTimeSeconds, t);

    return {
        timeOffset: gpxTime,
        hr: interpolatedHr,
        paceSecondsPerKm: beforeFrame.paceSecondsPerKm,
        distanceKm: interpolatedDist,
        elapsedTime: formatElapsedTime(gpxTime),
        movingTimeSeconds: interpolatedMovingTime,
    };
}
