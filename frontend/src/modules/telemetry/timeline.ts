import type { TrackPoint, TelemetryFrame } from '../../core/types';
import { calculateCumulativeDistances } from './distance';
import { detectPausedPoints } from './pauseDetection';
import { buildResponsiveMetricProfiles, updateMovingTime, computeCurrentGradePercent } from './pace';
import { formatElapsedTime } from './interpolation';

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

    return _buildRawFrames(
        points,
        distances,
        pausedPoints,
        startTime,
        paceValues,
        speedKmhValues,
    );
}

function _buildRawFrames(
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

        frames.push(_createTelemetryFrame(
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

function _createTelemetryFrame(
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