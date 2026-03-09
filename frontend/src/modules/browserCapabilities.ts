export interface BrowserEnvironmentLike {
    userAgent?: string;
    maxTouchPoints?: number;
}

export interface VideoProcessingDeviceProfile {
    maxInFlightFrameTasks: number;
    codecQueueHighWatermark: number;
    profileName: 'default' | 'apple-mobile-webkit';
}

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
            profileName: 'apple-mobile-webkit',
        };
    }

    return {
        maxInFlightFrameTasks: 3,
        codecQueueHighWatermark: 24,
        profileName: 'default',
    };
}