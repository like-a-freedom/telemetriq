import type { TrackPoint, TelemetryFrame } from '../core/types';

/** Earth radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Minimum speed threshold (km/h) to consider "moving" */
const MOVING_SPEED_THRESHOLD = 1.0;

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

/** Number of recent segments to sample for median-speed pace calculation */
const MEDIAN_SPEED_WINDOW = 5;

/**
 * Rolling window (in moving-seconds) for segment speed computation.
 * Averages over the last N seconds of non-paused movement to cancel
 * GPS jitter while staying responsive to genuine speed changes.
 */
const SEGMENT_SPEED_WINDOW_SECONDS = 7;

/** Max plausible running speed (m/s) — ~43 km/h, generous for any amateur athlete */
const MAX_PLAUSIBLE_SPEED_MS = 12;

const GRADE_WINDOW_METERS = 30;
const MIN_GRADE_DISTANCE_METERS = 10;
const MAX_PLAUSIBLE_CYCLING_SPEED_MS = 35;
const SEGMENT_SPIKE_NEIGHBOR_RADIUS = 2;
const SEGMENT_SPIKE_MIN_DELTA_MS = 1.5;
const MAX_INTERPOLATED_PACE_GAP_SECONDS = 2;

/**
 * Backward-looking window (in seconds) for display-time pace smoothing.
 * Only samples frames at or before the query time so the median never
 * incorporates future data — eliminating forward-looking lag while still
 * rejecting single-frame GPS noise.
 */
const PACE_DISPLAY_LOOKBACK_SECONDS = 2;

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

export function interpolateOptionalValue(
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
export function fillMissingPaceValues(
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

export function gapContainsPausedPoint(pausedPoints: boolean[], left: number, right: number): boolean {
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

// ── Median-speed pace estimation ────────────────────────────────────────

/**
 * Compute pace at a given frame index using median of recent segment speeds.
 *
 * Collects speed (m/s) from the last N non-paused segments, takes the median,
 * and converts to seconds/km. More robust than rolling cumulative distance
 * because a single noisy GPS segment has minimal effect on the median.
 *
 * Falls back to forward-looking segments at the start of the track.
 */
export function computeMedianPace(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
): number | undefined {
    const speeds: number[] = [];

    for (let direction = -1; direction <= 1; direction += 2) {
        const start: number = direction === -1
            ? Math.max(0, index - MEDIAN_SPEED_WINDOW)
            : index + 1;
        const end: number = direction === -1
            ? index
            : Math.min(points.length - 1, index + MEDIAN_SPEED_WINDOW);

        for (let k = Math.max(1, start); k <= end; k++) {
            if (pausedPoints[k]) continue;

            const segmentTime = (points[k].time.getTime() - points[k - 1].time.getTime()) / 1000;
            if (segmentTime <= 0 || segmentTime > MAX_CONSECUTIVE_GAP_SECONDS) continue;

            const segmentDistKm = distances[k] - distances[k - 1];
            if (segmentDistKm <= 0) continue;

            const speedMs = (segmentDistKm * 1000) / segmentTime;
            if (speedMs > MAX_PLAUSIBLE_SPEED_MS) continue;

            speeds.push(speedMs);
        }

        if (speeds.length >= 2) break;
    }

    if (speeds.length === 0) return undefined;

    speeds.sort((a, b) => a - b);
    const medianSpeed = speeds.length % 2 === 0
        ? (speeds[speeds.length / 2 - 1] + speeds[speeds.length / 2]) / 2
        : speeds[Math.floor(speeds.length / 2)];

    if (medianSpeed <= 0) return undefined;
    const pace = 1000 / medianSpeed;
    if (pace < 120 || pace > 1800) return undefined;
    return pace;
}

function median(values: number[]): number | undefined {
    if (values.length === 0) {
        return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
        ? (sorted[middle - 1]! + sorted[middle]!) / 2
        : sorted[middle];
}

function computeSegmentSpeedMs(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
): number | undefined {
    if (index === 0 || pausedPoints[index]) {
        return undefined;
    }

    // Walk backward from index, accumulating non-paused moving time.
    // Stop once we have at least SEGMENT_SPEED_WINDOW_SECONDS of moving
    // time or hit a large gap.
    let windowStart = index - 1;
    let movingTimeSeconds = 0;

    for (let j = index - 1; j >= 1; j -= 1) {
        const segmentDt = (points[j + 1]!.time.getTime() - points[j]!.time.getTime()) / 1000;

        // Don't span large gaps.
        if (segmentDt > MAX_CONSECUTIVE_GAP_SECONDS) {
            break;
        }

        if (!pausedPoints[j]) {
            movingTimeSeconds += segmentDt;
            windowStart = j;
        }

        if (movingTimeSeconds >= SEGMENT_SPEED_WINDOW_SECONDS) {
            break;
        }
    }

    // If we couldn't accumulate enough moving time (e.g. very short track),
    // fall back to the single previous segment.
    if (windowStart >= index || movingTimeSeconds <= 0) {
        const singleDt = (points[index]!.time.getTime() - points[index - 1]!.time.getTime()) / 1000;
        if (singleDt <= 0 || singleDt > MAX_CONSECUTIVE_GAP_SECONDS) {
            return undefined;
        }
        const singleDistKm = distances[index]! - distances[index - 1]!;
        if (singleDistKm <= 0) {
            return undefined;
        }
        const singleSpeedMs = (singleDistKm * 1000) / singleDt;
        if (!Number.isFinite(singleSpeedMs) || singleSpeedMs <= 0 || singleSpeedMs > MAX_PLAUSIBLE_CYCLING_SPEED_MS) {
            return undefined;
        }
        return singleSpeedMs;
    }

    const segmentDistanceKm = distances[index]! - distances[windowStart]!;
    if (segmentDistanceKm <= 0) {
        return undefined;
    }

    const speedMs = (segmentDistanceKm * 1000) / movingTimeSeconds;
    if (!Number.isFinite(speedMs) || speedMs <= 0 || speedMs > MAX_PLAUSIBLE_CYCLING_SPEED_MS) {
        return undefined;
    }

    return speedMs;
}

function stabilizeSegmentSpeeds(
    segmentSpeeds: Array<number | undefined>,
): Array<number | undefined> {
    const result = [...segmentSpeeds];

    for (let i = 0; i < segmentSpeeds.length; i++) {
        const currentSpeed = segmentSpeeds[i];
        if (currentSpeed === undefined) {
            continue;
        }

        const neighborhood: number[] = [];
        for (
            let j = Math.max(0, i - SEGMENT_SPIKE_NEIGHBOR_RADIUS);
            j <= Math.min(segmentSpeeds.length - 1, i + SEGMENT_SPIKE_NEIGHBOR_RADIUS);
            j += 1
        ) {
            if (j === i) {
                continue;
            }

            const value = segmentSpeeds[j];
            if (value !== undefined) {
                neighborhood.push(value);
            }
        }

        if (neighborhood.length < 3) {
            continue;
        }

        const neighborhoodMedian = median(neighborhood);
        if (neighborhoodMedian === undefined) {
            continue;
        }

        const threshold = Math.max(
            SEGMENT_SPIKE_MIN_DELTA_MS,
            neighborhoodMedian * 0.35,
        );

        if (Math.abs(currentSpeed - neighborhoodMedian) <= threshold) {
            continue;
        }

        const previousSpeed = i > 0 ? segmentSpeeds[i - 1] : undefined;
        const nextSpeed = i < segmentSpeeds.length - 1 ? segmentSpeeds[i + 1] : undefined;
        const sustainedChange =
            (previousSpeed !== undefined && Math.abs(currentSpeed - previousSpeed) <= threshold)
            || (nextSpeed !== undefined && Math.abs(currentSpeed - nextSpeed) <= threshold);

        if (!sustainedChange) {
            result[i] = neighborhoodMedian;
        }
    }

    return result;
}

function speedMsToPaceSecondsPerKm(speedMs: number | undefined): number | undefined {
    if (speedMs === undefined || speedMs <= 0) {
        return undefined;
    }

    const paceSecondsPerKm = 1000 / speedMs;
    if (paceSecondsPerKm < 120 || paceSecondsPerKm > 1800) {
        return undefined;
    }

    return paceSecondsPerKm;
}

function fillMissingMetricValues(
    values: Array<number | undefined>,
): Array<number | undefined> {
    if (values.length === 0) {
        return values;
    }

    const result = [...values];
    const validIndices = findValidIndices(result);

    if (validIndices.length === 0) {
        return result;
    }

    extrapolateLeadingValues(result, validIndices);
    holdAcrossGaps(result, validIndices);
    extrapolateTrailingValues(result, validIndices);

    return result;
}

function holdAcrossGaps(
    result: Array<number | undefined>,
    validIndices: number[],
): void {
    for (let k = 0; k < validIndices.length - 1; k++) {
        const left = validIndices[k]!;
        const right = validIndices[k + 1]!;
        const leftValue = result[left]!;
        for (let i = left + 1; i < right; i++) {
            result[i] = leftValue;
        }
    }
}

function buildResponsiveMetricProfiles(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
): {
    paceValues: Array<number | undefined>;
    speedKmhValues: Array<number | undefined>;
} {
    const rawSegmentSpeeds = points.map((_, index) => computeSegmentSpeedMs(points, distances, pausedPoints, index));
    const stabilizedSegmentSpeeds = stabilizeSegmentSpeeds(rawSegmentSpeeds);

    return {
        paceValues: fillMissingMetricValues(
            stabilizedSegmentSpeeds.map((speedMs) => speedMsToPaceSecondsPerKm(speedMs)),
        ),
        speedKmhValues: fillMissingMetricValues(
            stabilizedSegmentSpeeds.map((speedMs) => speedMs !== undefined ? speedMs * 3.6 : undefined),
        ),
    };
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
    const { paceValues, speedKmhValues } = buildResponsiveMetricProfiles(
        points,
        distances,
        pausedPoints,
    );

    return buildRawFrames(
        points,
        distances,
        pausedPoints,
        startTime,
        paceValues,
        speedKmhValues,
    );
}

function buildRawFrames(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    startTime: number,
    paceValues: Array<number | undefined>,
    speedKmhValues: Array<number | undefined>,
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
            paceValues[i],
            speedKmhValues[i],
            points,
            distances,
            pausedPoints,
            i,
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

function computeCurrentGradePercent(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
): number | undefined {
    const endPoint = points[index]!;
    if (endPoint.ele === undefined) {
        return undefined;
    }

    let windowStartIndex = index;
    let horizontalMeters = 0;

    for (let i = index; i > 0; i -= 1) {
        if (pausedPoints[i]) {
            continue;
        }

        const segmentTimeSeconds = (points[i]!.time.getTime() - points[i - 1]!.time.getTime()) / 1000;
        if (segmentTimeSeconds <= 0 || segmentTimeSeconds > MAX_CONSECUTIVE_GAP_SECONDS) {
            break;
        }

        const segmentDistanceMeters = (distances[i]! - distances[i - 1]!) * 1000;
        if (segmentDistanceMeters <= 0) {
            continue;
        }

        horizontalMeters += segmentDistanceMeters;
        windowStartIndex = i - 1;

        if (horizontalMeters >= GRADE_WINDOW_METERS) {
            break;
        }
    }

    if (horizontalMeters < MIN_GRADE_DISTANCE_METERS) {
        return undefined;
    }

    const startPoint = points[windowStartIndex]!;
    if (startPoint.ele === undefined) {
        return undefined;
    }

    const rawGradePercent = ((endPoint.ele - startPoint.ele) / horizontalMeters) * 100;
    return Math.max(-60, Math.min(60, rawGradePercent));
}

function createTelemetryFrame(
    point: TrackPoint,
    timeOffset: number,
    distanceKm: number,
    movingTimeMs: number,
    totalElapsedSeconds: number,
    isPaused: boolean,
    paceSecondsPerKm: number | undefined,
    speedKmh: number | undefined,
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
): TelemetryFrame {
    const movingTimeSeconds = movingTimeMs / 1000;

    return {
        timeOffset,
        hr: point.hr,
        paceSecondsPerKm,
        speedKmh,
        gradePercent: computeCurrentGradePercent(points, distances, pausedPoints, index),
        cadenceRpm: point.cadence,
        powerWatts: point.power,
        distanceKm,
        elevationM: point.ele,
        elapsedTime: formatElapsedTime(movingTimeSeconds),
        movingTimeSeconds,
        totalElapsedSeconds,
        isPaused,
    };
}

// ── Display-time interpolation ──────────────────────────────────────────

export const TRAIL_RUN_GRAPH_LOOKBACK_SECONDS = 60;
export const TRAIL_RUN_GRAPH_SAMPLE_COUNT = 180;

/**
 * Get a telemetry frame at a specific video time offset.
 * Uses binary search and linear interpolation between precomputed frame values.
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

export function getTelemetryWindow(
    frames: TelemetryFrame[],
    videoTimeSeconds: number,
    syncOffsetSeconds: number,
    lookbackSeconds: number,
): TelemetryFrame[] {
    const gpxTime = calculateGpxTime(videoTimeSeconds, syncOffsetSeconds, frames);
    if (gpxTime === null) {
        return [];
    }

    const clampedLookbackSeconds = Math.max(0, lookbackSeconds);
    const firstFrame = frames[0]!;
    const windowStartTime = Math.max(firstFrame.timeOffset, gpxTime - clampedLookbackSeconds);
    const startIndices = findBracketingIndices(frames, windowStartTime);
    const endIndices = findBracketingIndices(frames, gpxTime);
    const startIndex = Math.max(0, startIndices.before);
    const endIndex = Math.min(frames.length - 1, endIndices.after);

    return frames.slice(startIndex, endIndex + 1).filter((frame) => {
        return frame.timeOffset >= windowStartTime && frame.timeOffset <= gpxTime;
    });
}

export function getInterpolatedHeartRateHistory(
    frames: TelemetryFrame[],
    videoTimeSeconds: number,
    syncOffsetSeconds: number,
    lookbackSeconds = TRAIL_RUN_GRAPH_LOOKBACK_SECONDS,
    sampleCount = TRAIL_RUN_GRAPH_SAMPLE_COUNT,
): number[] {
    const gpxTime = calculateGpxTime(videoTimeSeconds, syncOffsetSeconds, frames);
    if (gpxTime === null) {
        return [];
    }

    const clampedSampleCount = Math.max(0, Math.floor(sampleCount));
    if (clampedSampleCount === 0) {
        return [];
    }

    const clampedLookbackSeconds = Math.max(0, lookbackSeconds);
    const firstFrame = frames[0]!;
    const windowStartTime = Math.max(firstFrame.timeOffset, gpxTime - clampedLookbackSeconds);
    const duration = Math.max(0, gpxTime - windowStartTime);
    const result: number[] = [];

    let { before, after } = findBracketingIndices(frames, windowStartTime);

    for (let index = 0; index < clampedSampleCount; index++) {
        const progress = clampedSampleCount === 1 ? 1 : index / (clampedSampleCount - 1);
        const sampleTime = windowStartTime + duration * progress;

        while (after < frames.length - 1 && frames[after]!.timeOffset < sampleTime) {
            before = after;
            after += 1;
        }

        const hr = interpolateHeartRateForGraph(frames[before]!, frames[after]!, sampleTime);
        if (hr !== undefined) {
            result.push(hr);
        }
    }

    return result;
}

export function getInterpolatedElevationHistory(
    frames: TelemetryFrame[],
    videoTimeSeconds: number,
    syncOffsetSeconds: number,
    lookbackSeconds = TRAIL_RUN_GRAPH_LOOKBACK_SECONDS,
    sampleCount = TRAIL_RUN_GRAPH_SAMPLE_COUNT,
): number[] {
    const gpxTime = calculateGpxTime(videoTimeSeconds, syncOffsetSeconds, frames);
    if (gpxTime === null) {
        return [];
    }

    const clampedSampleCount = Math.max(0, Math.floor(sampleCount));
    if (clampedSampleCount === 0) {
        return [];
    }

    const clampedLookbackSeconds = Math.max(0, lookbackSeconds);
    const firstFrame = frames[0]!;
    const windowStartTime = Math.max(firstFrame.timeOffset, gpxTime - clampedLookbackSeconds);
    const duration = Math.max(0, gpxTime - windowStartTime);
    const result: number[] = [];

    let { before, after } = findBracketingIndices(frames, windowStartTime);

    for (let index = 0; index < clampedSampleCount; index++) {
        const progress = clampedSampleCount === 1 ? 1 : index / (clampedSampleCount - 1);
        const sampleTime = windowStartTime + duration * progress;

        while (after < frames.length - 1 && frames[after]!.timeOffset < sampleTime) {
            before = after;
            after += 1;
        }

        const ele = interpolateElevationForGraph(frames[before]!, frames[after]!, sampleTime);
        if (ele !== undefined) {
            result.push(ele);
        }
    }

    return result;
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
    if (t === 0) {
        return {
            ...beforeFrame,
            paceSecondsPerKm: interpolatePace(allFrames, gpxTime) ?? beforeFrame.paceSecondsPerKm,
        };
    }

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
        speedKmh: interpolateTelemetryMetric(beforeFrame.speedKmh, afterFrame.speedKmh, t, beforeFrame, afterFrame),
        gradePercent: interpolateTelemetryMetric(beforeFrame.gradePercent, afterFrame.gradePercent, t, beforeFrame, afterFrame),
        cadenceRpm: interpolateDiscreteTelemetryMetric(beforeFrame.cadenceRpm, afterFrame.cadenceRpm, t, beforeFrame, afterFrame),
        powerWatts: interpolateDiscreteTelemetryMetric(beforeFrame.powerWatts, afterFrame.powerWatts, t, beforeFrame, afterFrame),
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

function interpolateHeartRateForGraph(
    before: TelemetryFrame,
    after: TelemetryFrame,
    sampleTime: number,
): number | undefined {
    if (before.hr !== undefined && after.hr !== undefined) {
        if (after.timeOffset === before.timeOffset) {
            return before.hr;
        }

        const t = (sampleTime - before.timeOffset) / (after.timeOffset - before.timeOffset);
        return lerp(before.hr, after.hr, Math.max(0, Math.min(1, t)));
    }

    return before.hr ?? after.hr;
}

function interpolateElevationForGraph(
    before: TelemetryFrame,
    after: TelemetryFrame,
    sampleTime: number,
): number | undefined {
    if (before.elevationM !== undefined && after.elevationM !== undefined) {
        if (after.timeOffset === before.timeOffset) {
            return before.elevationM;
        }

        const t = (sampleTime - before.timeOffset) / (after.timeOffset - before.timeOffset);
        return lerp(before.elevationM, after.elevationM, Math.max(0, Math.min(1, t)));
    }

    return before.elevationM ?? after.elevationM;
}

function interpolateTelemetryMetric(
    before: number | undefined,
    after: number | undefined,
    t: number,
    beforeFrame: TelemetryFrame,
    afterFrame: TelemetryFrame,
): number | undefined {
    const frameGapSeconds = afterFrame.timeOffset - beforeFrame.timeOffset;
    if (frameGapSeconds > MAX_CONSECUTIVE_GAP_SECONDS) {
        return before ?? after;
    }

    return interpolateOptionalValue(before, after, t);
}

function interpolateDiscreteTelemetryMetric(
    before: number | undefined,
    after: number | undefined,
    t: number,
    beforeFrame: TelemetryFrame,
    afterFrame: TelemetryFrame,
): number | undefined {
    const value = interpolateTelemetryMetric(before, after, t, beforeFrame, afterFrame);
    return value === undefined ? undefined : Math.round(value);
}

/**
 * Interpolate pace at a given GPX time.
 *
 * For dense 1-2 second sampling, takes the median of a backward-only window
 * (current frame and up to 2 s of prior frames). This rejects single-frame
 * GPS noise while never incorporating future data, so speed transitions are
 * reflected within 1-2 seconds. For sparser 3-5 second gaps the last known
 * pace is held to avoid inventing ramps across missing data.
 */
function interpolatePace(
    frames: TelemetryFrame[],
    gpxTime: number,
): number | undefined {
    const { beforeFrame, afterFrame, interpolationFactor } = findSurroundingFrames(frames, gpxTime);
    const frameGapSeconds = afterFrame.timeOffset - beforeFrame.timeOffset;

    // Dense sampling (≤2 s): backward-only median for noise rejection without lag.
    if (frameGapSeconds <= MAX_INTERPOLATED_PACE_GAP_SECONDS) {
        const backwardPaces = frames
            .filter((frame) =>
                frame.timeOffset <= gpxTime
                && frame.timeOffset >= gpxTime - PACE_DISPLAY_LOOKBACK_SECONDS
                && frame.paceSecondsPerKm !== undefined,
            )
            .map((frame) => frame.paceSecondsPerKm as number);

        if (backwardPaces.length >= 2) {
            return median(backwardPaces);
        }

        if (backwardPaces.length === 1) {
            // Single backward frame: prefer the backward value over interpolation
            // to avoid forward-looking artefacts.
            return backwardPaces[0];
        }

        // No pace data in backward window: try speed-based median.
        const backwardSpeeds = frames
            .filter((frame) =>
                frame.timeOffset <= gpxTime
                && frame.timeOffset >= gpxTime - PACE_DISPLAY_LOOKBACK_SECONDS
                && frame.speedKmh !== undefined,
            )
            .map((frame) => frame.speedKmh! / 3.6);
        const speedMedian = median(backwardSpeeds);
        if (speedMedian !== undefined) {
            return speedMsToPaceSecondsPerKm(speedMedian);
        }

        // Final fallback: interpolate between surrounding frames.
        return interpolateOptionalValue(
            beforeFrame.paceSecondsPerKm,
            afterFrame.paceSecondsPerKm,
            interpolationFactor,
        );
    }

    // Sparse gaps (2-5 s): hold last known pace to avoid inventing ramps.
    if (frameGapSeconds > MAX_INTERPOLATED_PACE_GAP_SECONDS
        && frameGapSeconds <= MAX_CONSECUTIVE_GAP_SECONDS) {
        return beforeFrame.paceSecondsPerKm ?? afterFrame.paceSecondsPerKm;
    }

    // Very sparse gaps (>5 s): hold last known pace.
    if (frameGapSeconds > MAX_CONSECUTIVE_GAP_SECONDS) {
        return beforeFrame.paceSecondsPerKm ?? afterFrame.paceSecondsPerKm;
    }

    // Fallback: interpolate.
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
