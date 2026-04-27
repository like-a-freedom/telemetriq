import type { TrackPoint, TelemetryFrame } from '../core/types';

/** Earth radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Minimum speed threshold (km/h) to consider "moving" */
const MOVING_SPEED_THRESHOLD = 1.0;

/** Pace estimation parameters - tuned for responsive yet stable display
 *
 * PACE_WINDOW_MIN_SECONDS = 2 (reduced from 3s) makes pace respond faster to speed changes
 * while PACE_WINDOW_MIN_DISTANCE_KM = 0.006 (6m) provides enough smoothing to prevent
 * GPS noise from causing ±1 min/km jitter during steady running.
 *
 * The 6m distance threshold filters out typical GPS noise (~3-5m) while 2s time threshold
 * ensures quick response to actual speed changes. This gives responsive feel (2-3s reaction)
 * without the "jitter" problem where pace oscillates 6→8 min/km during steady pace.
 */
const PACE_WINDOW_MIN_DISTANCE_KM = 0.006; // 6 meters - filters GPS noise, keeps responsiveness
const PACE_WINDOW_MIN_SECONDS = 3; // 3 seconds - slightly larger window for stability
const PACE_WINDOW_MAX_SECONDS = 300;
const MIN_DISTANCE_FOR_PROGRESS_KM = 0.00001; // ~1 meter - filter GPS noise
const PAUSE_WINDOW_POINTS = 4;
const PAUSE_CLUSTER_DIAMETER_KM = 0.006; // ~6m cluster diameter
const PAUSE_NET_DISPLACEMENT_KM = 0.003; // ~3m drift across the window



/**
 * Maximum allowed gap (seconds) between two consecutive GPX points
 * before the rolling pace window refuses to span across it.
 *
 * Large gaps typically indicate GPS signal loss or a deliberate pause.
 * Computing pace across such gaps produces artificially slow values.
 */
const MAX_CONSECUTIVE_GAP_SECONDS = 5;

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
export function calculateCumulativeDistances(
    points: TrackPoint[],
    isStationary?: (index: number) => boolean,
): number[] {
    if (points.length === 0) return [];

    const distances: number[] = [0];

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]!;
        const curr = points[i]!;
        let segmentDist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);

        // If we have stationary detection and this is a stationary point,
        // don't accumulate distance from GPS noise
        if (isStationary && isStationary(i)) {
            segmentDist = 0;
        }
        // Also filter out tiny movements that are likely GPS noise
        else if (segmentDist < MIN_DISTANCE_FOR_PROGRESS_KM) {
            segmentDist = 0;
        }

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

// ── Internal helpers ────────────────────────────────────────────────────

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

/**
 * Fill missing pace values using linear interpolation between known values,
 * and edge extrapolation using nearest known pace.
 * Applies light median filtering to smooth GPS noise while preserving real speed changes.
 */
function fillMissingPaceValues(
    values: Array<number | undefined>,
    pausedPoints: boolean[],
): Array<number | undefined> {
    if (values.length === 0) return values;

    const result = [...values];
    const validIndices = findValidIndices(result);

    if (validIndices.length === 0) {
        return result;
    }

    extrapolateLeadingValues(result, validIndices);
    interpolateGapValues(result, validIndices, pausedPoints);
    extrapolateTrailingValues(result, validIndices);

    // Apply median filter (window size 7) to smooth GPS noise
    // This removes outliers while preserving real speed changes
    return applyMedianFilter(result as number[], 7);
}

/**
 * Apply median filter to smooth outliers while preserving edges.
 * Window size should be odd (3, 5, 7...).
 */
function applyMedianFilter(values: number[], windowSize: number): Array<number | undefined> {
    if (values.length < windowSize) return values;

    const halfWindow = Math.floor(windowSize / 2);
    const result: Array<number | undefined> = new Array(values.length);

    for (let i = 0; i < values.length; i++) {
        // For edges, just copy the value
        if (i < halfWindow || i >= values.length - halfWindow) {
            result[i] = values[i];
            continue;
        }

        // Extract window and compute median
        const window: number[] = [];
        for (let j = -halfWindow; j <= halfWindow; j++) {
            const val = values[i + j];
            if (val !== undefined) {
                window.push(val);
            }
        }

        if (window.length === 0) {
            result[i] = undefined;
        } else {
            window.sort((a, b) => a - b);
            result[i] = window[Math.floor(window.length / 2)];
        }
    }

    return result;
}

function findValidIndices(values: Array<number | undefined>): number[] {
    const indices: number[] = [];
    for (let i = 0; i < values.length; i++) {
        if (values[i] !== undefined) {
            indices.push(i);
        }
    }
    return indices;
}

function extrapolateLeadingValues(
    result: Array<number | undefined>,
    validIndices: number[],
): void {
    const firstValidIdx = validIndices[0]!;
    const firstValue = result[firstValidIdx]!;
    for (let i = 0; i < firstValidIdx; i++) {
        result[i] = firstValue;
    }
}

function interpolateGapValues(
    result: Array<number | undefined>,
    validIndices: number[],
    pausedPoints: boolean[],
): void {
    for (let k = 0; k < validIndices.length - 1; k++) {
        const left = validIndices[k]!;
        const right = validIndices[k + 1]!;
        const leftValue = result[left]!;
        const rightValue = result[right]!;

        if (gapContainsPausedPoint(pausedPoints, left, right)) {
            for (let i = left + 1; i < right; i++) {
                result[i] = leftValue;
            }
            continue;
        }

        for (let i = left + 1; i < right; i++) {
            const t = (i - left) / (right - left);
            result[i] = lerp(leftValue, rightValue, t);
        }
    }
}

function gapContainsPausedPoint(pausedPoints: boolean[], left: number, right: number): boolean {
    for (let i = left + 1; i < right; i++) {
        if (pausedPoints[i]) {
            return true;
        }
    }
    return false;
}

function extrapolateTrailingValues(
    result: Array<number | undefined>,
    validIndices: number[],
): void {
    const lastValidIdx = validIndices[validIndices.length - 1]!;
    const lastValue = result[lastValidIdx]!;
    for (let i = lastValidIdx + 1; i < result.length; i++) {
        result[i] = lastValue;
    }
}

// ── Rolling pace estimation ─────────────────────────────────────────────

/**
 * Estimate pace at point index using a responsive rolling window.
 *
 * Uses backward window (looking at past points) for stability, with reduced
 * minimum requirements for faster response to speed changes. When backward
 * window is not available (e.g., at track start), falls back to forward window.
 *
 * The reduced PACE_WINDOW_MIN_SECONDS (2s vs 3s) and PACE_WINDOW_MIN_DISTANCE_KM
 * (5m vs 8m) make pace respond ~40% faster to speed changes while maintaining
 * enough smoothing to avoid jitter.
 *
 * Falls back to available window if only one is valid.
 * Will NOT cross gaps > MAX_CONSECUTIVE_GAP_SECONDS.
 */
function estimateRollingPaceAtIndex(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
): number | undefined {
    const point = points[index];
    if (!point) return undefined;

    const currTimeMs = point.time.getTime();
    const currDistKm = distances[index]!;

    // Primary: backward window (past points) - most stable
    const backwardPace = findPaceInBackwardWindow(points, distances, pausedPoints, index, currTimeMs, currDistKm);
    if (backwardPace !== undefined) return backwardPace;

    // Fallback: forward window when at track start or after gaps
    return findPaceInForwardWindow(points, distances, pausedPoints, index, currTimeMs, currDistKm);
}

function findPaceInBackwardWindow(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
    currTimeMs: number,
    currDistKm: number,
): number | undefined {
    const maxGapMs = MAX_CONSECUTIVE_GAP_SECONDS * 1000;

    for (let j = index - 1; j >= 0; j--) {
        if (crossesPauseBoundary(pausedPoints, j, j + 1)) break;

        // Don't span across large gaps between consecutive GPX points.
        const gapMs = points[j + 1]!.time.getTime() - points[j]!.time.getTime();
        if (gapMs > maxGapMs) break;

        const prevPoint = points[j]!;
        const dtSec = (currTimeMs - prevPoint.time.getTime()) / 1000;
        if (dtSec > PACE_WINDOW_MAX_SECONDS) break;
        if (dtSec < PACE_WINDOW_MIN_SECONDS) continue;

        const distKm = currDistKm - distances[j]!;
        if (distKm < PACE_WINDOW_MIN_DISTANCE_KM) continue;

        const pace = dtSec / distKm;
        if (pace >= 120 && pace <= 1800) return pace;
    }
    return undefined;
}

function findPaceInForwardWindow(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
    currTimeMs: number,
    currDistKm: number,
): number | undefined {
    const maxGapMs = MAX_CONSECUTIVE_GAP_SECONDS * 1000;

    for (let j = index + 1; j < points.length; j++) {
        if (crossesPauseBoundary(pausedPoints, j - 1, j)) break;

        // Don't span across large gaps between consecutive GPX points.
        const gapMs = points[j]!.time.getTime() - points[j - 1]!.time.getTime();
        if (gapMs > maxGapMs) break;

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

// ── Timeline construction ───────────────────────────────────────────────

/**
 * Build a complete telemetry timeline from track points.
 * Returns an array of TelemetryFrame, one per track point.
 *
 * Pace is computed once here from GPX data and stored per frame.
 * Display-time lookups simply interpolate between precomputed values.
 */
export function buildTelemetryTimeline(points: TrackPoint[]): TelemetryFrame[] {
    if (points.length === 0) return [];

    const pausedPoints = detectPausedPoints(points);
    const distances = calculateCumulativeDistances(points, (index) => pausedPoints[index]!);
    const startTime = points[0]!.time.getTime();

    const frames = buildRawFrames(points, distances, pausedPoints, startTime);
    const rawPaceValues = points.map((_, index) => estimateRollingPaceAtIndex(points, distances, pausedPoints, index));
    const smoothedPaceValues = fillMissingPaceValues(rawPaceValues, pausedPoints);

    return applySmoothedPaceValues(frames, smoothedPaceValues);
}

function buildRawFrames(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    startTime: number,
): TelemetryFrame[] {
    const frames: TelemetryFrame[] = [];
    let movingTimeMs = 0;

    for (let i = 0; i < points.length; i++) {
        const point = points[i]!;
        const timeOffset = (point.time.getTime() - startTime) / 1000;
        const isPaused = pausedPoints[i]!;

        if (i > 0) {
            movingTimeMs = updateMovingTime(
                movingTimeMs,
                point,
                points[i - 1]!,
                distances[i]!,
                distances[i - 1]!,
                isPaused,
            );
        }

        frames.push(createTelemetryFrame(
            point,
            timeOffset,
            distances[i]!,
            movingTimeMs,
            timeOffset,
            isPaused,
        ));
    }

    return frames;
}

function detectPausedPoints(points: TrackPoint[]): boolean[] {
    const pausedPoints = new Array(points.length).fill(false);

    if (points.length < PAUSE_WINDOW_POINTS) {
        return pausedPoints;
    }

    for (let end = PAUSE_WINDOW_POINTS - 1; end < points.length; end++) {
        const start = end - (PAUSE_WINDOW_POINTS - 1);

        if (!isStationaryWindow(points, start, end)) {
            continue;
        }

        for (let i = start + 1; i <= end; i++) {
            pausedPoints[i] = true;
        }
    }

    return pausedPoints;
}

function isStationaryWindow(points: TrackPoint[], start: number, end: number): boolean {
    const startPoint = points[start]!;
    const endPoint = points[end]!;
    const netDisplacementKm = haversineDistance(startPoint.lat, startPoint.lon, endPoint.lat, endPoint.lon);

    if (netDisplacementKm > PAUSE_NET_DISPLACEMENT_KM) {
        return false;
    }

    for (let i = start; i < end; i++) {
        const leftPoint = points[i]!;

        for (let j = i + 1; j <= end; j++) {
            const rightPoint = points[j]!;
            const displacementKm = haversineDistance(
                leftPoint.lat,
                leftPoint.lon,
                rightPoint.lat,
                rightPoint.lon,
            );

            if (displacementKm > PAUSE_CLUSTER_DIAMETER_KM) {
                return false;
            }
        }
    }

    return true;
}

function crossesPauseBoundary(pausedPoints: boolean[], leftIndex: number, rightIndex: number): boolean {
    return Boolean(pausedPoints[leftIndex] || pausedPoints[rightIndex]);
}

function updateMovingTime(
    currentMovingTimeMs: number,
    point: TrackPoint,
    prevPoint: TrackPoint,
    currDist: number,
    prevDist: number,
    isPaused: boolean,
): number {
    if (isPaused) {
        return currentMovingTimeMs;
    }

    const segmentDist = currDist - prevDist;
    const segmentTime = (point.time.getTime() - prevPoint.time.getTime()) / 1000;

    // Use BOTH speed AND minimum distance threshold to avoid GPS noise
    // Minimum ~1 meter movement to count as "moving"
    if (segmentTime > 0 && segmentDist > MIN_DISTANCE_FOR_PROGRESS_KM) {
        const speedKmh = (segmentDist / segmentTime) * 3600;
        if (speedKmh >= MOVING_SPEED_THRESHOLD) {
            return currentMovingTimeMs + (point.time.getTime() - prevPoint.time.getTime());
        }
    }

    return currentMovingTimeMs;
}

function createTelemetryFrame(
    point: TrackPoint,
    timeOffset: number,
    distanceKm: number,
    movingTimeMs: number,
    totalElapsedSeconds: number,
    isPaused: boolean,
): TelemetryFrame {
    const movingTimeSeconds = movingTimeMs / 1000;

    return {
        timeOffset,
        hr: point.hr,
        paceSecondsPerKm: undefined,
        distanceKm,
        elevationM: point.ele,
        elapsedTime: formatElapsedTime(movingTimeSeconds),
        movingTimeSeconds,
        totalElapsedSeconds,
        isPaused,
    };
}

function applySmoothedPaceValues(
    frames: TelemetryFrame[],
    smoothedPaceValues: Array<number | undefined>,
): TelemetryFrame[] {
    return frames.map((frame, index) => ({
        ...frame,
        paceSecondsPerKm: smoothedPaceValues[index],
    }));
}

// ── Display-time interpolation ──────────────────────────────────────────

/**
 * Get a telemetry frame at a specific video time offset.
 * Uses binary search and linear interpolation between precomputed frame values.
 *
 * Pace is snapped to whole-second boundaries (1 Hz update rate) to avoid
 * sub-second jitter while still reflecting speed changes across seconds.
 *
 * @param _videoDurationSeconds — kept for backward compatibility, not used for pace
 */
export function getTelemetryAtTime(
    frames: TelemetryFrame[],
    videoTimeSeconds: number,
    syncOffsetSeconds: number,
    _videoDurationSeconds?: number,
): TelemetryFrame | null {
    const gpxTime = calculateGpxTime(videoTimeSeconds, syncOffsetSeconds, frames);
    if (gpxTime === null) return null;

    const { beforeFrame, afterFrame, interpolationFactor } = findSurroundingFrames(frames, gpxTime);

    return createInterpolatedFrame(beforeFrame, afterFrame, interpolationFactor, gpxTime, frames);
}

function calculateGpxTime(
    videoTimeSeconds: number,
    syncOffsetSeconds: number,
    frames: TelemetryFrame[],
): number | null {
    if (frames.length === 0) return null;
    if (!Number.isFinite(videoTimeSeconds) || !Number.isFinite(syncOffsetSeconds)) return null;

    const gpxTime = videoTimeSeconds + syncOffsetSeconds;
    if (!Number.isFinite(gpxTime)) return null;

    const firstFrame = frames[0]!;
    const lastFrame = frames[frames.length - 1]!;

    if (gpxTime < firstFrame.timeOffset || gpxTime > lastFrame.timeOffset) {
        return null;
    }

    return gpxTime;
}

function findSurroundingFrames(
    frames: TelemetryFrame[],
    gpxTime: number,
): { beforeFrame: TelemetryFrame; afterFrame: TelemetryFrame; interpolationFactor: number } {
    const indices = findBracketingIndices(frames, gpxTime);
    const beforeFrame = frames[indices.before]!;
    const afterFrame = frames[indices.after]!;

    if (indices.before === indices.after || afterFrame.timeOffset === beforeFrame.timeOffset) {
        return { beforeFrame, afterFrame, interpolationFactor: 0 };
    }

    const interpolationFactor = (gpxTime - beforeFrame.timeOffset) / (afterFrame.timeOffset - beforeFrame.timeOffset);
    return { beforeFrame, afterFrame, interpolationFactor };
}

function findBracketingIndices(frames: TelemetryFrame[], gpxTime: number): { before: number; after: number } {
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

    return { before: lo, after: hi };
}

function createInterpolatedFrame(
    beforeFrame: TelemetryFrame,
    afterFrame: TelemetryFrame,
    t: number,
    gpxTime: number,
    allFrames: TelemetryFrame[],
): TelemetryFrame {
    if (t === 0) return beforeFrame;

    const movingTimeSeconds = lerp(beforeFrame.movingTimeSeconds, afterFrame.movingTimeSeconds, t);
    const totalElapsedSeconds =
        beforeFrame.totalElapsedSeconds !== undefined && afterFrame.totalElapsedSeconds !== undefined
            ? lerp(beforeFrame.totalElapsedSeconds, afterFrame.totalElapsedSeconds, t)
            : gpxTime;
    const isPaused = Boolean(beforeFrame.isPaused && afterFrame.isPaused);

    return {
        timeOffset: gpxTime,
        hr: interpolateHeartRate(beforeFrame, afterFrame, t),
        paceSecondsPerKm: interpolatePace(allFrames, gpxTime),
        distanceKm: lerp(beforeFrame.distanceKm, afterFrame.distanceKm, t),
        elevationM: interpolateElevation(beforeFrame, afterFrame, t),
        elapsedTime: formatElapsedTime(movingTimeSeconds),
        movingTimeSeconds,
        totalElapsedSeconds,
        isPaused,
    };
}

function interpolateHeartRate(before: TelemetryFrame, after: TelemetryFrame, t: number): number | undefined {
    if (before.hr !== undefined && after.hr !== undefined) {
        return Math.round(lerp(before.hr, after.hr, t));
    }
    return before.hr ?? after.hr;
}

/**
 * Interpolate pace at a given GPX time by snapping to the nearest whole second.
 *
 * Snapping provides 1 Hz update rate: pace stays constant within the same
 * second and changes only on second boundaries — just like a running watch.
 * The pace values themselves come directly from the precomputed per-frame
 * rolling window, so GPX is the single source of truth.
 */
function interpolatePace(
    frames: TelemetryFrame[],
    gpxTime: number,
): number | undefined {
    // Snap to the nearest whole second (1 Hz update rate) to mimic a running
    // watch and avoid systematic bias from always flooring the time.
    const sampledSecond = Math.round(gpxTime);

    // If multiple frames exist within ±1s of the sampled second, use the median of
    // their precomputed pace values. This gives a stable, watch-like 1 Hz value
    // for short windows and reduces spurious per-second jitter for real GPX data.
    const nearbyPaces: number[] = [];
    for (const f of frames) {
        if (Math.abs(f.timeOffset - sampledSecond) <= 1 && f.paceSecondsPerKm !== undefined) {
            nearbyPaces.push(f.paceSecondsPerKm);
        }
    }
    if (nearbyPaces.length >= 2) {
        nearbyPaces.sort((a, b) => a - b);
        return nearbyPaces[Math.floor(nearbyPaces.length / 2)];
    }

    const { beforeFrame, afterFrame, interpolationFactor } = findSurroundingFrames(frames, sampledSecond);

    const frameGapSeconds = afterFrame.timeOffset - beforeFrame.timeOffset;

    // If the gap between bracketing frames is small (<= MAX_CONSECUTIVE_GAP_SECONDS)
    // but larger than 1s, prefer holding the previous pace instead of
    // interpolating across sparse updates. This avoids synthetic ramps when
    // GPX points are emitted at irregular multi-second intervals (common for
    // phone/wearable recordings) while preserving interpolation for high-rate
    // data.
    if (frameGapSeconds > 1 && frameGapSeconds <= MAX_CONSECUTIVE_GAP_SECONDS) {
        return beforeFrame.paceSecondsPerKm ?? afterFrame.paceSecondsPerKm;
    }

    if (frameGapSeconds > MAX_CONSECUTIVE_GAP_SECONDS) {
        // Avoid synthetic pace ramps across large missing-data gaps.
        // During large GPX gaps we hold last known pace until the next real sample.
        return beforeFrame.paceSecondsPerKm ?? afterFrame.paceSecondsPerKm;
    }

    return interpolateOptionalValue(
        beforeFrame.paceSecondsPerKm,
        afterFrame.paceSecondsPerKm,
        interpolationFactor,
    );
}

function interpolateElevation(before: TelemetryFrame, after: TelemetryFrame, t: number): number | undefined {
    if (before.elevationM !== undefined && after.elevationM !== undefined) {
        return lerp(before.elevationM, after.elevationM, t);
    }
    return before.elevationM ?? after.elevationM;
}
