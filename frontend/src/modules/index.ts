export { parseGpx, readAndParseGpx, validateGpxFile } from './gpx-parser';
export {
    haversineDistance,
    calculateCumulativeDistances,
    calculatePace,
    lerp,
    interpolateHr,
    formatElapsedTime,
    formatPace,
    buildTelemetryTimeline,
    getTelemetryAtTime,
} from './telemetry-core';
export { autoSync, clampSyncOffset, getGpxTimeRange, MANUAL_SYNC_RANGE_SECONDS } from './sync-engine';
export { renderOverlay, renderOverlayOnFrame, DEFAULT_OVERLAY_CONFIG } from './overlay-renderer';
export { validateVideoFile, extractVideoMeta, isWebCodecsSupported, checkBrowserCapabilities } from './file-validation';
export { VideoProcessor } from './video-processor';
export type { VideoProcessorOptions } from './video-processor';
export { BrowserFileSystem } from './file-system';
export type { FileSystemInterface } from './file-system';
