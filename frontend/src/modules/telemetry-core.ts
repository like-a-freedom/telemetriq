import type { TrackPoint, TelemetryFrame } from '../core/types';

/** Earth radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Minimum speed threshold (km/h) to consider "moving" */
const MOVING_SPEED_THRESHOLD = 1.0;

/** Pace estimation parameters (for stable yet responsive pace display) */
const PACE_WINDOW_MIN_DISTANCE_KM = 0.008; // 8 meters
const PACE_WINDOW_MIN_SECONDS = 3;
const PACE_WINDOW_MAX_SECONDS = 300;
const PACE_DISPLAY_WINDOW_SECONDS = 10;

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
 * Format seconds into compact elapsed time:
 * - < 1 hour: M:SS
 * - >= 1 hour: H:MM:SS
 */
export function formatElapsedTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
}

/**
 * Format pace from seconds per km to M:SS string.
 */
export function formatPace(secondsPerKm: number | undefined): string | undefined {
    if (secondsPerKm === undefined) return undefined;
    const roundedSeconds = Math.round(secondsPerKm);
    const minutes = Math.floor(roundedSeconds / 60);
    const seconds = roundedSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function interpolateOptionalValue(
    before: number | undefined,
    after: number | undefined,
    t: number,
): number | undefined {
    if (before !== undefined && after !== undefined) {
        return lerp(before, after, t);
    }
    return before ?? after;
}

function interpolateDistanceAtTime(frames: TelemetryFrame[], targetTime: number): number | undefined {
    if (frames.length === 0) return undefined;

    const first = frames[0]!;
    const last = frames[frames.length - 1]!;

    if (targetTime < first.timeOffset || targetTime > last.timeOffset) return undefined;

    let lo = 0;
    let hi = frames.length - 1;

    while (lo < hi - 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (frames[mid]!.timeOffset <= targetTime) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    const before = frames[lo]!;
    const after = frames[hi]!;

    if (before.timeOffset === after.timeOffset) {
        return before.distanceKm;
    }

    const t = (targetTime - before.timeOffset) / (after.timeOffset - before.timeOffset);
    return lerp(before.distanceKm, after.distanceKm, t);
}

/**
 * Estimate pace for display at 1Hz (once per second) using distance delta
 * over the recent fixed lookback window.
 */
function estimateDisplayPaceAtTime(frames: TelemetryFrame[], gpxTime: number): number | undefined {
    if (frames.length === 0) return undefined;

    const first = frames[0]!;
    const last = frames[frames.length - 1]!;
    if (gpxTime < first.timeOffset || gpxTime > last.timeOffset) return undefined;

    const sampledSecond = Math.floor(gpxTime);
    const halfWindow = PACE_DISPLAY_WINDOW_SECONDS / 2;

    const centeredStart = Math.max(first.timeOffset, sampledSecond - halfWindow);
    const centeredEnd = Math.min(last.timeOffset, sampledSecond + halfWindow);

    const tryEstimate = (startTime: number, endTime: number): number | undefined => {
        const elapsedSec = endTime - startTime;
        if (elapsedSec < PACE_WINDOW_MIN_SECONDS) return undefined;

        const startDist = interpolateDistanceAtTime(frames, startTime);
        const endDist = interpolateDistanceAtTime(frames, endTime);
        if (startDist === undefined || endDist === undefined) return undefined;

        const distKm = endDist - startDist;
        if (distKm < PACE_WINDOW_MIN_DISTANCE_KM) return undefined;

        const paceSecPerKm = elapsedSec / distKm;
        if (paceSecPerKm < 120 || paceSecPerKm > 1800) return undefined;
        return paceSecPerKm;
    };

    // Primary mode: symmetric window around current second.
    const centeredPace = tryEstimate(centeredStart, centeredEnd);
    if (centeredPace !== undefined) return centeredPace;

    // Fallback 1: backward window.
    const backwardStart = Math.max(first.timeOffset, sampledSecond - PACE_DISPLAY_WINDOW_SECONDS);
    const backwardPace = tryEstimate(backwardStart, sampledSecond);
    if (backwardPace !== undefined) return backwardPace;

    // Fallback 2: forward window.
    const forwardEnd = Math.min(last.timeOffset, sampledSecond + PACE_DISPLAY_WINDOW_SECONDS);
    return tryEstimate(sampledSecond, forwardEnd);
}

/**
 * Fill missing pace values using linear interpolation between known values,
 * and edge extrapolation using nearest known pace.
 */
function fillMissingPaceValues(values: Array<number | undefined>): Array<number | undefined> {
    if (values.length === 0) return values;

    const result = [...values];
    const validIndices: number[] = [];

    for (let i = 0; i < result.length; i++) {
        if (result[i] !== undefined) {
            validIndices.push(i);
        }
    }

    if (validIndices.length === 0) {
        return result;
    }

    const firstValidIdx = validIndices[0]!;
    const firstValue = result[firstValidIdx]!;
    for (let i = 0; i < firstValidIdx; i++) {
        result[i] = firstValue;
    }

    for (let k = 0; k < validIndices.length - 1; k++) {
        const left = validIndices[k]!;
        const right = validIndices[k + 1]!;
        const leftValue = result[left]!;
        const rightValue = result[right]!;

        for (let i = left + 1; i < right; i++) {
            const t = (i - left) / (right - left);
            result[i] = lerp(leftValue, rightValue, t);
        }
    }

    const lastValidIdx = validIndices[validIndices.length - 1]!;
    const lastValue = result[lastValidIdx]!;
    for (let i = lastValidIdx + 1; i < result.length; i++) {
        result[i] = lastValue;
    }

    return result;
}

/**
 * Estimate pace at point index using a rolling time/distance window.
 * Prefers backward window (historic pace), then falls back to forward window
 * near track start when history is insufficient.
 */
function estimateRollingPaceAtIndex(
    points: TrackPoint[],
    distances: number[],
    index: number,
): number | undefined {
    const point = points[index];
    if (!point) return undefined;

    const currTimeMs = point.time.getTime();
    const currDistKm = distances[index]!;

    for (let j = index - 1; j >= 0; j--) {
        const prevPoint = points[j]!;
        const dtSec = (currTimeMs - prevPoint.time.getTime()) / 1000;
        if (dtSec > PACE_WINDOW_MAX_SECONDS) break;
        if (dtSec < PACE_WINDOW_MIN_SECONDS) continue;

        const distKm = currDistKm - distances[j]!;
        if (distKm < PACE_WINDOW_MIN_DISTANCE_KM) continue;

        const pace = dtSec / distKm;
        if (pace >= 120 && pace <= 1800) return pace;
    }

    for (let j = index + 1; j < points.length; j++) {
        const nextPoint = points[j]!;
        const dtSec = (nextPoint.time.getTime() - currTimeMs) / 1000;
        if (dtSec > PACE_WINDOW_MAX_SECONDS) break;
        if (dtSec < PACE_WINDOW_MIN_SECONDS) continue;

        const distKm = distances[j]! - currDistKm;
        if (distKm < PACE_WINDOW_MIN_DISTANCE_KM) continue;

        const pace = dtSec / distKm;
        if (pace >= 120 && pace <= 1800) return pace;
    }

    return undefined;
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
            pace = estimateRollingPaceAtIndex(points, distances, i);

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
            elevationM: point.ele,
            elapsedTime: formatElapsedTime(timeOffset),
            movingTimeSeconds: movingTimeMs / 1000,
        });
    }

    const smoothedPace = fillMissingPaceValues(frames.map((frame) => frame.paceSecondsPerKm));
    for (let i = 0; i < frames.length; i++) {
        frames[i]!.paceSecondsPerKm = smoothedPace[i];
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
    const interpolatedPace = estimateDisplayPaceAtTime(frames, gpxTime)
        ?? interpolateOptionalValue(
            beforeFrame.paceSecondsPerKm,
            afterFrame.paceSecondsPerKm,
            t,
        );

    const interpolatedDist = lerp(beforeFrame.distanceKm, afterFrame.distanceKm, t);
    const interpolatedMovingTime = lerp(beforeFrame.movingTimeSeconds, afterFrame.movingTimeSeconds, t);
    const interpolatedElevation = (beforeFrame.elevationM !== undefined && afterFrame.elevationM !== undefined)
        ? lerp(beforeFrame.elevationM, afterFrame.elevationM, t)
        : (beforeFrame.elevationM ?? afterFrame.elevationM);

    return {
        timeOffset: gpxTime,
        hr: interpolatedHr,
        paceSecondsPerKm: interpolatedPace,
        distanceKm: interpolatedDist,
        elevationM: interpolatedElevation,
        elapsedTime: formatElapsedTime(gpxTime),
        movingTimeSeconds: interpolatedMovingTime,
    };
}
