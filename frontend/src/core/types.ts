/** A single GPS track point parsed from GPX */
export interface TrackPoint {
    /** Latitude in degrees */
    lat: number;
    /** Longitude in degrees */
    lon: number;
    /** Elevation in meters (optional) */
    ele?: number;
    /** UTC timestamp */
    time: Date;
    /** Heart rate in BPM (optional) */
    hr?: number;
    /** Cadence in steps/min (optional) */
    cadence?: number;
}

/** Result of GPX parsing */
export interface GpxData {
    /** Track name */
    name: string;
    /** Ordered array of track points */
    points: TrackPoint[];
    /** Metadata from GPX file */
    metadata: GpxMetadata;
}

export interface GpxMetadata {
    creator?: string;
    time?: Date;
    description?: string;
}

/** Telemetry snapshot at a specific moment */
export interface TelemetryFrame {
    /** Time offset from start in seconds */
    timeOffset: number;
    /** Heart rate in BPM */
    hr?: number;
    /** Pace in seconds per km */
    paceSecondsPerKm?: number;
    /** Distance in km */
    distanceKm: number;
    /** Elapsed time formatted (HH:MM:SS) */
    elapsedTime: string;
    /** Moving time in seconds */
    movingTimeSeconds: number;
}

/** Overlay configuration */
export interface OverlayConfig {
    /** Position on video */
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Background opacity (0-1) */
    backgroundOpacity: number;
    /** Font size as percentage of video height */
    fontSizePercent: number;
    /** Whether to show each metric */
    showHr: boolean;
    showPace: boolean;
    showDistance: boolean;
    showTime: boolean;
}

/** Sync configuration */
export interface SyncConfig {
    /** Manual offset in seconds (positive = GPX ahead of video) */
    offsetSeconds: number;
    /** Whether auto-sync was used */
    autoSynced: boolean;
    /** Optional warning message when sync is uncertain */
    warning?: string;
}

/** Video file metadata */
export interface VideoMeta {
    /** Duration in seconds */
    duration: number;
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
    /** Frame rate */
    fps: number;
    /** Video codec string */
    codec: string;
    /** File size in bytes */
    fileSize: number;
    /** File name */
    fileName: string;
    /** Approximate start time (local) */
    startTime?: Date;
    /** Video GPS location if available */
    gps?: { lat: number; lon: number };
    /** Timezone offset in minutes at capture time */
    timezoneOffsetMinutes?: number;
}

/** Processing progress */
export interface ProcessingProgress {
    /** Current phase */
    phase: 'demuxing' | 'processing' | 'encoding' | 'muxing' | 'complete';
    /** Progress in percent (0-100) */
    percent: number;
    /** Processed frames */
    framesProcessed: number;
    /** Total frames */
    totalFrames: number;
    /** Estimated remaining seconds */
    estimatedRemainingSeconds?: number;
}

/** Application screen state */
export type AppScreen = 'upload' | 'preview' | 'processing' | 'result';

/** File validation result */
export interface FileValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
