export { parseGpx, readAndParseGpx, validateGpxFile } from './gpxParser';
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
} from './telemetryCore';
export { autoSync, clampSyncOffset, getGpxTimeRange, MANUAL_SYNC_RANGE_SECONDS } from './syncEngine';
export { renderOverlay, renderOverlayOnFrame, DEFAULT_OVERLAY_CONFIG } from './overlayRenderer';
export { validateVideoFile, extractVideoMeta, isWebCodecsSupported, checkBrowserCapabilities } from './fileValidation';
export { VideoProcessor } from './videoProcessor';
export type { VideoProcessorOptions } from './videoProcessor';
export { BrowserFileSystem } from './fileSystem';
export type { FileSystemInterface } from './fileSystem';
