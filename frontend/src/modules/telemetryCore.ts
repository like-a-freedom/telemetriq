export { haversineDistance, calculateCumulativeDistances, calculatePace } from './telemetry/distance';

export { lerp, interpolateHr, interpolateOptionalValue, formatElapsedTime, formatPace } from './telemetry/interpolation';

export {
    fillMissingPaceValues,
    gapContainsPausedPoint,
    computeMedianPace,
    speedMsToPaceSecondsPerKm,
    buildResponsiveMetricProfiles,
    computeCurrentGradePercent,
    updateMovingTime,
} from './telemetry/pace';
export { detectPausedPoints } from './telemetry/pauseDetection';
export { buildTelemetryTimeline } from './telemetry/timeline';

export {
    getTelemetryAtTime,
    getTelemetryWindow,
    getInterpolatedHeartRateHistory,
    getInterpolatedElevationHistory,
    TRAIL_RUN_GRAPH_LOOKBACK_SECONDS,
    TRAIL_RUN_GRAPH_SAMPLE_COUNT,
} from './telemetry/lookups';

export { MAX_CONSECUTIVE_GAP_SECONDS, PACE_DISPLAY_LOOKBACK_SECONDS, MAX_INTERPOLATED_PACE_GAP_SECONDS } from './telemetry/pace';