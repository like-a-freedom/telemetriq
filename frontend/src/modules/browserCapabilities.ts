export interface BrowserEnvironmentLike {
    userAgent?: string;
    maxTouchPoints?: number;
}

export function shouldAvoidInlineResultPreview(env?: BrowserEnvironmentLike): boolean {
    const userAgent = env?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    const maxTouchPoints = env?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);

    const isIPhoneOrIPod = /iPhone|iPod/i.test(userAgent);
    const isIPad = /iPad/i.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1);
    const isAppleMobileDevice = isIPhoneOrIPod || isIPad;
    const isWebKit = /AppleWebKit/i.test(userAgent);

    return isAppleMobileDevice && isWebKit;
}