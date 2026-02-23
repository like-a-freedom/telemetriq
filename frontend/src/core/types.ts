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
    /** Elevation in meters (if available) */
    elevationM?: number;
    /** Elapsed time formatted (HH:MM:SS) */
    elapsedTime: string;
    /** Moving time in seconds */
    movingTimeSeconds: number;
}

// ── Overlay configuration types ──────────────────────────────────────────

/** Template identifier */
export type TemplateId =
    | 'horizon'
    | 'margin'
    | 'l-frame'
    | 'classic'
    | 'arc-gauge'
    | 'hero-number'
    | 'cinematic-bar'
    | 'editorial'
    | 'ticker-tape'
    | 'whisper'
    | 'two-tone'
    | 'condensed-strip'
    | 'soft-rounded'
    | 'thin-line'
    | 'swiss-grid'
    | 'garmin-style'
    | 'sports-broadcast'
    | 'cockpit-hud'
    | 'terminal'
    | 'night-runner'
    | 'data-block'
    | 'race-tag'
    | 'glass-panel'
    | 'minimal-ring'
    | 'stretched-bar'
    | 'focus-type'
    | 'custom';

/** Visual layout mode for the overlay */
export type OverlayLayoutMode =
    | 'bottom-bar'     // Horizon: full-width gradient bar at bottom
    | 'side-margins'   // Margin: metrics on left/right margins
    | 'corner-frame'   // L-Frame: L-shaped frame at corner
    | 'arc-gauge'
    | 'hero-number'
    | 'cinematic-bar'
    | 'editorial'
    | 'ticker-tape'
    | 'whisper'
    | 'two-tone'
    | 'condensed-strip'
    | 'soft-rounded'
    | 'thin-line'
    | 'swiss-grid'
    | 'garmin-style'
    | 'sports-broadcast'
    | 'cockpit-hud'
    | 'terminal'
    | 'night-runner'
    | 'data-block'
    | 'race-tag'
    | 'glass-panel'
    | 'minimal-ring'
    | 'stretched-bar'
    | 'focus-type'
    | 'box';           // Classic: positioned rounded rectangle

/** Overlay position on video */
export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Font weight for values: 'light' (300), 'normal' (400), 'bold' (700) */
export type ValueFontWeight = 'light' | 'normal' | 'bold';

/** Label visibility style */
export type LabelStyle = 'uppercase' | 'hidden';

/** Icon display style */
export type IconStyle = 'none' | 'filled' | 'outline';

/** Layout direction */
export type LayoutDirection = 'vertical' | 'horizontal';

/** Metric visibility configuration */
export interface OverlayFeatures {
    showHr: boolean;
    showPace: boolean;
    showDistance: boolean;
    showTime: boolean;
}

/** Visual styling configuration */
export interface OverlayStyle {
    fontFamily: string;
    textColor: string;
    backgroundColor: string;
    valueFontWeight: ValueFontWeight;
    valueSizeMultiplier: number;
    labelSizeMultiplier: number;
    labelLetterSpacing: number;
    accentColor: string;
    textShadow: boolean;
    textShadowColor: string;
    textShadowBlur: number;
    gradientBackground: boolean;
    gradientStartColor: string;
    gradientEndColor: string;
}

/** Layout and positioning configuration */
export interface OverlayLayout {
    position: OverlayPosition;
    layoutMode: OverlayLayoutMode;
    layout: LayoutDirection;
    backgroundOpacity: number;
    fontSizePercent: number;
    borderWidth: number;
    borderColor: string;
    cornerRadius: number;
    lineSpacing: number;
    iconStyle: IconStyle;
    labelStyle: LabelStyle;
}

/** Simple overlay configuration for backward compatibility */
export interface OverlayConfig {
    position: OverlayPosition;
    backgroundOpacity: number;
    fontSizePercent: number;
    showHr: boolean;
    showPace: boolean;
    showDistance: boolean;
    showTime: boolean;
}

/** Complete overlay configuration - composed from focused interfaces */
export interface ExtendedOverlayConfig extends OverlayFeatures, OverlayStyle, OverlayLayout {
    templateId: TemplateId;
}

/** Sync configuration */
export interface SyncConfig {
    /**
     * Offset in seconds to align GPX timeline with video.
     * Calculated as: videoStartTime - gpxStartTime
     * - Positive: video started AFTER GPX (GPX data exists before video)
     * - Negative: video started BEFORE GPX (video has no GPX data initially)
     * - Zero: video and GPX started at the same time
     * To get GPX time: gpxTime = videoTime + offsetSeconds
     */
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
