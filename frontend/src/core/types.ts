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

/** Extended overlay configuration with template properties */
export interface ExtendedOverlayConfig extends OverlayConfig {
    /** Template identifier */
    templateId: string;
    /** Visual layout mode determining overlay shape/position */
    layoutMode?: OverlayLayoutMode;
    /** Font family selection */
    fontFamily?: string;
    /** Text color in hex/rgb format */
    textColor?: string;
    /** Background color in hex/rgb format */
    backgroundColor?: string;
    /** Border width in pixels */
    borderWidth?: number;
    /** Border color in hex/rgb format */
    borderColor?: string;
    /** Corner radius as percentage of overlay height */
    cornerRadius?: number;
    /** Enable/disable text shadow */
    textShadow?: boolean;
    /** Text shadow color */
    textShadowColor?: string;
    /** Text shadow blur radius */
    textShadowBlur?: number;
    /** Spacing multiplier between lines */
    lineSpacing?: number;
    /** Layout direction of telemetry items */
    layout?: 'vertical' | 'horizontal';
    /** Style of metric icons */
    iconStyle?: 'none' | 'filled' | 'outline';
    /** Enable gradient background */
    gradientBackground?: boolean;
    /** Gradient start color */
    gradientStartColor?: string;
    /** Gradient end color */
    gradientEndColor?: string;
    /** Show elevation metric */
    showElevation?: boolean;
    /** Show cadence metric */
    showCadence?: boolean;
    /** Label style: 'uppercase' for small caps labels, 'hidden' for no labels */
    labelStyle?: 'uppercase' | 'hidden';
    /** Value font weight: 'light' (300), 'normal' (400), 'bold' (700) */
    valueFontWeight?: 'light' | 'normal' | 'bold';
    /** Value font size multiplier relative to fontSizePercent */
    valueSizeMultiplier?: number;
    /** Label font size multiplier relative to fontSizePercent */
    labelSizeMultiplier?: number;
    /** Letter spacing for labels in em units */
    labelLetterSpacing?: number;
    /** Accent color for progress/highlight elements */
    accentColor?: string;
}

/** Available template IDs */
export type TemplateId = 
    | 'horizon'
    | 'margin'
    | 'l-frame'
    | 'classic'
    | 'custom';

/** Visual layout mode for the overlay */
export type OverlayLayoutMode = 
    | 'bottom-bar'     // Horizon: full-width gradient bar at bottom
    | 'side-margins'   // Margin: metrics on left/right margins
    | 'corner-frame'   // L-Frame: L-shaped frame at corner
    | 'box';           // Classic: positioned rounded rectangle

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
