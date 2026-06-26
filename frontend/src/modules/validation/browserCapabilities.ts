/**
 * Check if the browser supports WebCodecs API.
 */
export function isWebCodecsSupported(): boolean {
    return (
        typeof VideoDecoder !== 'undefined' &&
        typeof VideoEncoder !== 'undefined' &&
        typeof VideoFrame !== 'undefined'
    );
}

/**
 * Check if SharedArrayBuffer is available (needed for FFmpeg.wasm).
 */
export function isSharedArrayBufferSupported(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
}

/**
 * Check all required browser capabilities.
 */
export function checkBrowserCapabilities(): { supported: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!isWebCodecsSupported()) {
        missing.push('WebCodecs API');
    }

    if (!isSharedArrayBufferSupported()) {
        missing.push('SharedArrayBuffer');
    }

    if (typeof OffscreenCanvas === 'undefined') {
        missing.push('OffscreenCanvas');
    }

    return {
        supported: missing.length === 0,
        missing,
    };
}