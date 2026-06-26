import type { TelemetryFrame } from '../../core/types';
import { median, speedMsToPaceSecondsPerKm, MAX_CONSECUTIVE_GAP_SECONDS, PACE_DISPLAY_LOOKBACK_SECONDS, MAX_INTERPOLATED_PACE_GAP_SECONDS } from './pace';
import { interpolateOptionalValue, formatElapsedTime } from './interpolation';

export const TRAIL_RUN_GRAPH_LOOKBACK_SECONDS = 60;
export const TRAIL_RUN_GRAPH_SAMPLE_COUNT = 180;

export function getTelemetryAtTime(
    frames: TelemetryFrame[],
    videoTimeSeconds: number,
    syncOffsetSeconds: number,
    _videoDurationSeconds?: number,
): TelemetryFrame | null {
    const gpxTime = _calculateGpxTime(videoTimeSeconds, syncOffsetSeconds, frames);
    if (gpxTime === null) return null;

    const { beforeFrame, afterFrame, interpolationFactor } = _findSurroundingFrames(frames, gpxTime);

    return _createInterpolatedFrame(beforeFrame, afterFrame, interpolationFactor, gpxTime, frames);
}

export function getTelemetryWindow(
    frames: TelemetryFrame[],
    videoTimeSeconds: number,
    syncOffsetSeconds: number,
    lookbackSeconds: number,
): TelemetryFrame[] {
    const gpxTime = _calculateGpxTime(videoTimeSeconds, syncOffsetSeconds, frames);
    if (gpxTime === null) return [];

    const clampedLookbackSeconds = Math.max(0, lookbackSeconds);
    const firstFrame = frames[0]!;
    const windowStartTime = Math.max(firstFrame.timeOffset, gpxTime - clampedLookbackSeconds);
    const startIndices = _findBracketingIndices(frames, windowStartTime);
    const endIndices = _findBracketingIndices(frames, gpxTime);
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
    const gpxTime = _calculateGpxTime(videoTimeSeconds, syncOffsetSeconds, frames);
    if (gpxTime === null) return [];

    const clampedSampleCount = Math.max(0, Math.floor(sampleCount));
    if (clampedSampleCount === 0) return [];

    const clampedLookbackSeconds = Math.max(0, lookbackSeconds);
    const firstFrame = frames[0]!;
    const windowStartTime = Math.max(firstFrame.timeOffset, gpxTime - clampedLookbackSeconds);
    const duration = Math.max(0, gpxTime - windowStartTime);
    const result: number[] = [];

    let { before, after } = _findBracketingIndices(frames, windowStartTime);

    for (let index = 0; index < clampedSampleCount; index++) {
        const progress = clampedSampleCount === 1 ? 1 : index / (clampedSampleCount - 1);
        const sampleTime = windowStartTime + duration * progress;

        while (after < frames.length - 1 && frames[after]!.timeOffset < sampleTime) {
            before = after;
            after += 1;
        }

        const hr = _interpolateHeartRateForGraph(frames[before]!, frames[after]!, sampleTime);
        if (hr !== undefined) result.push(hr);
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
    const gpxTime = _calculateGpxTime(videoTimeSeconds, syncOffsetSeconds, frames);
    if (gpxTime === null) return [];

    const clampedSampleCount = Math.max(0, Math.floor(sampleCount));
    if (clampedSampleCount === 0) return [];

    const clampedLookbackSeconds = Math.max(0, lookbackSeconds);
    const firstFrame = frames[0]!;
    const windowStartTime = Math.max(firstFrame.timeOffset, gpxTime - clampedLookbackSeconds);
    const duration = Math.max(0, gpxTime - windowStartTime);
    const result: number[] = [];

    let { before, after } = _findBracketingIndices(frames, windowStartTime);

    for (let index = 0; index < clampedSampleCount; index++) {
        const progress = clampedSampleCount === 1 ? 1 : index / (clampedSampleCount - 1);
        const sampleTime = windowStartTime + duration * progress;

        while (after < frames.length - 1 && frames[after]!.timeOffset < sampleTime) {
            before = after;
            after += 1;
        }

        const ele = _interpolateElevationForGraph(frames[before]!, frames[after]!, sampleTime);
        if (ele !== undefined) result.push(ele);
    }

    return result;
}

function _lerp(v0: number, v1: number, t: number): number {
    return v0 + t * (v1 - v0);
}

function _calculateGpxTime(
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

function _findSurroundingFrames(
    frames: TelemetryFrame[],
    gpxTime: number,
): { beforeFrame: TelemetryFrame; afterFrame: TelemetryFrame; interpolationFactor: number } {
    const indices = _findBracketingIndices(frames, gpxTime);
    const beforeFrame = frames[indices.before]!;
    const afterFrame = frames[indices.after]!;

    if (indices.before === indices.after || afterFrame.timeOffset === beforeFrame.timeOffset) {
        return { beforeFrame, afterFrame, interpolationFactor: 0 };
    }

    const interpolationFactor =
        (gpxTime - beforeFrame.timeOffset) / (afterFrame.timeOffset - beforeFrame.timeOffset);
    return { beforeFrame, afterFrame, interpolationFactor };
}

function _findBracketingIndices(frames: TelemetryFrame[], gpxTime: number): { before: number; after: number } {
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

function _createInterpolatedFrame(
    beforeFrame: TelemetryFrame,
    afterFrame: TelemetryFrame,
    t: number,
    gpxTime: number,
    allFrames: TelemetryFrame[],
): TelemetryFrame {
    if (t === 0) {
        return {
            ...beforeFrame,
            paceSecondsPerKm: _interpolatePace(allFrames, gpxTime) ?? beforeFrame.paceSecondsPerKm,
        };
    }

    const movingTimeSeconds = _lerp(beforeFrame.movingTimeSeconds, afterFrame.movingTimeSeconds, t);
    const totalElapsedSeconds =
        beforeFrame.totalElapsedSeconds !== undefined && afterFrame.totalElapsedSeconds !== undefined
            ? _lerp(beforeFrame.totalElapsedSeconds, afterFrame.totalElapsedSeconds, t)
            : gpxTime;
    const isPaused = Boolean(beforeFrame.isPaused && afterFrame.isPaused);

    return {
        timeOffset: gpxTime,
        hr: _interpolateHeartRate(beforeFrame, afterFrame, t),
        paceSecondsPerKm: _interpolatePace(allFrames, gpxTime),
        speedKmh: _interpolateMetric(beforeFrame.speedKmh, afterFrame.speedKmh, t, beforeFrame, afterFrame),
        gradePercent: _interpolateMetric(beforeFrame.gradePercent, afterFrame.gradePercent, t, beforeFrame, afterFrame),
        cadenceRpm: _interpolateDiscrete(beforeFrame.cadenceRpm, afterFrame.cadenceRpm, t, beforeFrame, afterFrame),
        powerWatts: _interpolateDiscrete(beforeFrame.powerWatts, afterFrame.powerWatts, t, beforeFrame, afterFrame),
        distanceKm: _lerp(beforeFrame.distanceKm, afterFrame.distanceKm, t),
        elevationM: _interpolateElevation(beforeFrame, afterFrame, t),
        elapsedTime: formatElapsedTime(movingTimeSeconds),
        movingTimeSeconds,
        totalElapsedSeconds,
        isPaused,
    };
}

function _interpolateHeartRate(before: TelemetryFrame, after: TelemetryFrame, t: number): number | undefined {
    if (before.hr !== undefined && after.hr !== undefined) {
        return Math.round(_lerp(before.hr, after.hr, t));
    }
    return before.hr ?? after.hr;
}

function _interpolateHeartRateForGraph(
    before: TelemetryFrame,
    after: TelemetryFrame,
    sampleTime: number,
): number | undefined {
    if (before.hr !== undefined && after.hr !== undefined) {
        if (after.timeOffset === before.timeOffset) return before.hr;
        const t = (sampleTime - before.timeOffset) / (after.timeOffset - before.timeOffset);
        return _lerp(before.hr, after.hr, Math.max(0, Math.min(1, t)));
    }
    return before.hr ?? after.hr;
}

function _interpolateElevationForGraph(
    before: TelemetryFrame,
    after: TelemetryFrame,
    sampleTime: number,
): number | undefined {
    if (before.elevationM !== undefined && after.elevationM !== undefined) {
        if (after.timeOffset === before.timeOffset) return before.elevationM;
        const t = (sampleTime - before.timeOffset) / (after.timeOffset - before.timeOffset);
        return _lerp(before.elevationM, after.elevationM, Math.max(0, Math.min(1, t)));
    }
    return before.elevationM ?? after.elevationM;
}

function _interpolateMetric(
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

function _interpolateDiscrete(
    before: number | undefined,
    after: number | undefined,
    t: number,
    beforeFrame: TelemetryFrame,
    afterFrame: TelemetryFrame,
): number | undefined {
    const value = _interpolateMetric(before, after, t, beforeFrame, afterFrame);
    return value === undefined ? undefined : Math.round(value);
}

function _interpolatePace(frames: TelemetryFrame[], gpxTime: number): number | undefined {
    const { beforeFrame, afterFrame, interpolationFactor } = _findSurroundingFrames(frames, gpxTime);
    const frameGapSeconds = afterFrame.timeOffset - beforeFrame.timeOffset;

    if (frameGapSeconds <= MAX_INTERPOLATED_PACE_GAP_SECONDS) {
        const backwardPaces = frames
            .filter((frame) =>
                frame.timeOffset <= gpxTime
                && frame.timeOffset >= gpxTime - PACE_DISPLAY_LOOKBACK_SECONDS
                && frame.paceSecondsPerKm !== undefined,
            )
            .map((frame) => frame.paceSecondsPerKm as number);

        if (backwardPaces.length >= 2) return median(backwardPaces);
        if (backwardPaces.length === 1) return backwardPaces[0];

        const backwardSpeeds = frames
            .filter((frame) =>
                frame.timeOffset <= gpxTime
                && frame.timeOffset >= gpxTime - PACE_DISPLAY_LOOKBACK_SECONDS
                && frame.speedKmh !== undefined,
            )
            .map((frame) => (frame.speedKmh as number) / 3.6);

        const speedMedian = median(backwardSpeeds);
        if (speedMedian !== undefined) return speedMsToPaceSecondsPerKm(speedMedian);

        return interpolateOptionalValue(
            beforeFrame.paceSecondsPerKm,
            afterFrame.paceSecondsPerKm,
            interpolationFactor,
        );
    }

    if (frameGapSeconds > MAX_INTERPOLATED_PACE_GAP_SECONDS && frameGapSeconds <= MAX_CONSECUTIVE_GAP_SECONDS) {
        return beforeFrame.paceSecondsPerKm ?? afterFrame.paceSecondsPerKm;
    }

    if (frameGapSeconds > MAX_CONSECUTIVE_GAP_SECONDS) {
        return beforeFrame.paceSecondsPerKm ?? afterFrame.paceSecondsPerKm;
    }

    return interpolateOptionalValue(
        beforeFrame.paceSecondsPerKm,
        afterFrame.paceSecondsPerKm,
        interpolationFactor,
    );
}

function _interpolateElevation(before: TelemetryFrame, after: TelemetryFrame, t: number): number | undefined {
    if (before.elevationM !== undefined && after.elevationM !== undefined) {
        return _lerp(before.elevationM, after.elevationM, t);
    }
    return before.elevationM ?? after.elevationM;
}