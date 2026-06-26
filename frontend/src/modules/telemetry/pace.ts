import type { TrackPoint } from '../../core/types';

export const MAX_CONSECUTIVE_GAP_SECONDS = 5;
const MEDIAN_SPEED_WINDOW = 5;
const SEGMENT_SPEED_WINDOW_SECONDS = 7;
const MAX_PLAUSIBLE_SPEED_MS = 12;
const GRADE_WINDOW_METERS = 30;
const MIN_GRADE_DISTANCE_METERS = 10;
const MAX_PLAUSIBLE_CYCLING_SPEED_MS = 35;
const SEGMENT_SPIKE_NEIGHBOR_RADIUS = 2;
const SEGMENT_SPIKE_MIN_DELTA_MS = 1.5;
export const MAX_INTERPOLATED_PACE_GAP_SECONDS = 2;
export const PACE_DISPLAY_LOOKBACK_SECONDS = 2;

export function median(values: number[]): number | undefined {
    if (values.length === 0) return undefined;

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
        ? (sorted[middle - 1]! + sorted[middle]!) / 2
        : sorted[middle];
}

export function fillMissingPaceValues(
    values: Array<number | undefined>,
    pausedPoints: boolean[],
): Array<number | undefined> {
    if (values.length === 0) return values;

    const result = [...values];
    const validIndices = _findValidIndices(result);

    if (validIndices.length === 0) return result;

    _extrapolateLeadingValues(result, validIndices);
    _interpolateGapValues(result, validIndices, pausedPoints);
    _extrapolateTrailingValues(result, validIndices);

    return _applyMedianFilter(result as number[], 7);
}

export function gapContainsPausedPoint(pausedPoints: boolean[], left: number, right: number): boolean {
    for (let i = left + 1; i < right; i++) {
        if (pausedPoints[i]) return true;
    }
    return false;
}

function _applyMedianFilter(values: number[], windowSize: number): Array<number | undefined> {
    if (values.length < windowSize) return values;

    const halfWindow = Math.floor(windowSize / 2);
    const result: Array<number | undefined> = new Array(values.length);

    for (let i = 0; i < values.length; i++) {
        if (i < halfWindow || i >= values.length - halfWindow) {
            result[i] = values[i];
            continue;
        }

        const window: number[] = [];
        for (let j = -halfWindow; j <= halfWindow; j++) {
            const val = values[i + j];
            if (val !== undefined) window.push(val);
        }

        result[i] = window.length === 0 ? undefined : median(window)!;
    }

    return result;
}

function _findValidIndices(values: Array<number | undefined>): number[] {
    return values
        .map((v, i) => (v !== undefined ? i : -1))
        .filter((i) => i >= 0);
}

function _extrapolateLeadingValues(
    result: Array<number | undefined>,
    validIndices: number[],
): void {
    const firstValidIdx = validIndices[0]!;
    const firstValue = result[firstValidIdx]!;
    for (let i = 0; i < firstValidIdx; i++) {
        result[i] = firstValue;
    }
}

function _interpolateGapValues(
    result: Array<number | undefined>,
    validIndices: number[],
    pausedPoints: boolean[],
): void {
    for (let k = 0; k < validIndices.length - 1; k++) {
        const left = validIndices[k]!;
        const right = validIndices[k + 1]!;
        const leftValue = result[left]!;

        if (gapContainsPausedPoint(pausedPoints, left, right)) {
            for (let i = left + 1; i < right; i++) result[i] = leftValue;
            continue;
        }

        for (let i = left + 1; i < right; i++) {
            const t = (i - left) / (right - left);
            result[i] = leftValue + t * (result[right]! - leftValue);
        }
    }
}

function _extrapolateTrailingValues(
    result: Array<number | undefined>,
    validIndices: number[],
): void {
    const lastValidIdx = validIndices[validIndices.length - 1]!;
    const lastValue = result[lastValidIdx]!;
    for (let i = lastValidIdx + 1; i < result.length; i++) {
        result[i] = lastValue;
    }
}

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

function _computeSegmentSpeedMs(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
): number | undefined {
    if (index === 0 || pausedPoints[index]) return undefined;

    let windowStart = index - 1;
    let movingTimeSeconds = 0;

    for (let j = index - 1; j >= 1; j -= 1) {
        const segmentDt = (points[j + 1]!.time.getTime() - points[j]!.time.getTime()) / 1000;

        if (segmentDt > MAX_CONSECUTIVE_GAP_SECONDS) break;

        if (!pausedPoints[j]) {
            movingTimeSeconds += segmentDt;
            windowStart = j;
        }

        if (movingTimeSeconds >= SEGMENT_SPEED_WINDOW_SECONDS) break;
    }

    if (windowStart >= index || movingTimeSeconds <= 0) {
        const singleDt = (points[index]!.time.getTime() - points[index - 1]!.time.getTime()) / 1000;
        if (singleDt <= 0 || singleDt > MAX_CONSECUTIVE_GAP_SECONDS) return undefined;
        const singleDistKm = distances[index]! - distances[index - 1]!;
        if (singleDistKm <= 0) return undefined;
        const singleSpeedMs = (singleDistKm * 1000) / singleDt;
        if (!Number.isFinite(singleSpeedMs) || singleSpeedMs <= 0 || singleSpeedMs > MAX_PLAUSIBLE_CYCLING_SPEED_MS) {
            return undefined;
        }
        return singleSpeedMs;
    }

    const segmentDistanceKm = distances[index]! - distances[windowStart]!;
    if (segmentDistanceKm <= 0) return undefined;

    const speedMs = (segmentDistanceKm * 1000) / movingTimeSeconds;
    if (!Number.isFinite(speedMs) || speedMs <= 0 || speedMs > MAX_PLAUSIBLE_CYCLING_SPEED_MS) {
        return undefined;
    }

    return speedMs;
}

function _stabilizeSegmentSpeeds(
    segmentSpeeds: Array<number | undefined>,
): Array<number | undefined> {
    const result = [...segmentSpeeds];

    for (let i = 0; i < segmentSpeeds.length; i++) {
        const currentSpeed = segmentSpeeds[i];
        if (currentSpeed === undefined) continue;

        const neighborhood: number[] = [];
        for (
            let j = Math.max(0, i - SEGMENT_SPIKE_NEIGHBOR_RADIUS);
            j <= Math.min(segmentSpeeds.length - 1, i + SEGMENT_SPIKE_NEIGHBOR_RADIUS);
            j += 1
        ) {
            if (j === i) continue;
            const value = segmentSpeeds[j];
            if (value !== undefined) neighborhood.push(value);
        }

        if (neighborhood.length < 3) continue;

        const neighborhoodMedian = median(neighborhood);
        if (neighborhoodMedian === undefined) continue;

        const threshold = Math.max(
            SEGMENT_SPIKE_MIN_DELTA_MS,
            neighborhoodMedian * 0.35,
        );

        if (Math.abs(currentSpeed - neighborhoodMedian) <= threshold) continue;

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

export function speedMsToPaceSecondsPerKm(speedMs: number | undefined): number | undefined {
    if (speedMs === undefined || speedMs <= 0) return undefined;
    const paceSecondsPerKm = 1000 / speedMs;
    if (paceSecondsPerKm < 120 || paceSecondsPerKm > 1800) return undefined;
    return paceSecondsPerKm;
}

function _fillMissingMetricValues(
    values: Array<number | undefined>,
): Array<number | undefined> {
    if (values.length === 0) return values;

    const result = [...values];
    const validIndices = _findValidIndices(result);

    if (validIndices.length === 0) return result;

    _extrapolateLeadingValues(result, validIndices);
    _holdAcrossGaps(result, validIndices);
    _extrapolateTrailingValues(result, validIndices);

    return result;
}

function _holdAcrossGaps(
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

export function buildResponsiveMetricProfiles(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
): {
    paceValues: Array<number | undefined>;
    speedKmhValues: Array<number | undefined>;
} {
    const rawSegmentSpeeds = points.map((_, index) =>
        _computeSegmentSpeedMs(points, distances, pausedPoints, index),
    );
    const stabilizedSegmentSpeeds = _stabilizeSegmentSpeeds(rawSegmentSpeeds);

    return {
        paceValues: _fillMissingMetricValues(
            stabilizedSegmentSpeeds.map((speedMs) =>
                speedMs !== undefined ? speedMsToPaceSecondsPerKm(speedMs) : undefined,
            ),
        ),
        speedKmhValues: _fillMissingMetricValues(
            stabilizedSegmentSpeeds.map((speedMs) =>
                speedMs !== undefined ? speedMs * 3.6 : undefined,
            ),
        ),
    };
}

export function computeCurrentGradePercent(
    points: TrackPoint[],
    distances: number[],
    pausedPoints: boolean[],
    index: number,
): number | undefined {
    const endPoint = points[index]!;
    if (endPoint.ele === undefined) return undefined;

    let windowStartIndex = index;
    let horizontalMeters = 0;

    for (let i = index; i > 0; i -= 1) {
        if (pausedPoints[i]) continue;

        const segmentTimeSeconds = (points[i]!.time.getTime() - points[i - 1]!.time.getTime()) / 1000;
        if (segmentTimeSeconds <= 0 || segmentTimeSeconds > MAX_CONSECUTIVE_GAP_SECONDS) break;

        const segmentDistanceMeters = (distances[i]! - distances[i - 1]!) * 1000;
        if (segmentDistanceMeters <= 0) continue;

        horizontalMeters += segmentDistanceMeters;
        windowStartIndex = i - 1;

        if (horizontalMeters >= GRADE_WINDOW_METERS) break;
    }

    if (horizontalMeters < MIN_GRADE_DISTANCE_METERS) return undefined;

    const startPoint = points[windowStartIndex]!;
    if (startPoint.ele === undefined) return undefined;

    const rawGradePercent = ((endPoint.ele - startPoint.ele) / horizontalMeters) * 100;
    return Math.max(-60, Math.min(60, rawGradePercent));
}

export function updateMovingTime(
    currentMovingTimeMs: number,
    point: TrackPoint,
    prevPoint: TrackPoint,
    currDist: number,
    prevDist: number,
    isPaused: boolean,
): number {
    if (isPaused) return currentMovingTimeMs;

    const segmentDist = currDist - prevDist;
    const segmentTime = (point.time.getTime() - prevPoint.time.getTime()) / 1000;

    if (segmentTime > 0 && segmentDist > 0.00001) {
        const speedKmh = (segmentDist / segmentTime) * 3600;
        if (speedKmh >= 1.0) {
            return currentMovingTimeMs + (point.time.getTime() - prevPoint.time.getTime());
        }
    }

    return currentMovingTimeMs;
}