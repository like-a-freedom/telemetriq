export interface BrowserEnvironmentLike {
    userAgent?: string;
    maxTouchPoints?: number;
}

export interface VideoProcessingDeviceProfile {
    maxInFlightFrameTasks: number;
    codecQueueHighWatermark: number;
    streamingMuxFileSizeBytes: number;
    streamingMuxMinFrameCount: number;
    allowFfmpegMuxRemux: boolean;
    profileName: 'default' | 'apple-mobile-webkit';
}

const DEFAULT_STREAMING_MUX_FILE_SIZE_BYTES = 512 * 1024 * 1024;
const DEFAULT_STREAMING_MUX_MIN_FRAME_COUNT = 2000;
const APPLE_MOBILE_STREAMING_MUX_FILE_SIZE_BYTES = 128 * 1024 * 1024;
const APPLE_MOBILE_STREAMING_MUX_MIN_FRAME_COUNT = 1000;

function getBrowserEnvironment(env?: BrowserEnvironmentLike): Required<BrowserEnvironmentLike> {
    return {
        userAgent: env?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        maxTouchPoints: env?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0),
    };
}

function isAppleMobileWebKit(env?: BrowserEnvironmentLike): boolean {
    const { userAgent, maxTouchPoints } = getBrowserEnvironment(env);

    const isIPhoneOrIPod = /iPhone|iPod/i.test(userAgent);
    const isIPad = /iPad/i.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1);
    const isAppleMobileDevice = isIPhoneOrIPod || isIPad;
    const isWebKit = /AppleWebKit/i.test(userAgent);

    return isAppleMobileDevice && isWebKit;
}

export function shouldAvoidInlineResultPreview(env?: BrowserEnvironmentLike): boolean {
    return isAppleMobileWebKit(env);
}

export function getVideoProcessingDeviceProfile(env?: BrowserEnvironmentLike): VideoProcessingDeviceProfile {
    if (isAppleMobileWebKit(env)) {
        return {
            maxInFlightFrameTasks: 2,
            codecQueueHighWatermark: 12,
            streamingMuxFileSizeBytes: APPLE_MOBILE_STREAMING_MUX_FILE_SIZE_BYTES,
            streamingMuxMinFrameCount: APPLE_MOBILE_STREAMING_MUX_MIN_FRAME_COUNT,
            allowFfmpegMuxRemux: false,
            profileName: 'apple-mobile-webkit',
        };
    }

    return {
        maxInFlightFrameTasks: 3,
        codecQueueHighWatermark: 24,
        streamingMuxFileSizeBytes: DEFAULT_STREAMING_MUX_FILE_SIZE_BYTES,
        streamingMuxMinFrameCount: DEFAULT_STREAMING_MUX_MIN_FRAME_COUNT,
        allowFfmpegMuxRemux: true,
        profileName: 'default',
    };
}