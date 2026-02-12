import type { TelemetryFrame, OverlayConfig } from '../core/types';
import { formatPace } from './telemetry-core';

type CachedOverlay = {
    canvas: OffscreenCanvas | HTMLCanvasElement;
};

const overlayCache = new Map<string, CachedOverlay>();
const MAX_CACHE_ENTRIES = 200;

/** Default overlay configuration */
export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
    position: 'top-left',
    backgroundOpacity: 0.7,
    fontSizePercent: 2.5,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
};

/**
 * Render the telemetry overlay onto a canvas.
 * This function draws the telemetry data as a semi-transparent overlay.
 */
export function renderOverlay(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    frame: TelemetryFrame,
    videoWidth: number,
    videoHeight: number,
    config: OverlayConfig = DEFAULT_OVERLAY_CONFIG,
): void {
    const cacheKey = buildCacheKey(frame, config, videoWidth, videoHeight);
    const cached = overlayCache.get(cacheKey);
    if (cached) {
        ctx.drawImage(cached.canvas as CanvasImageSource, 0, 0);
        return;
    }

    const overlayCanvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(videoWidth, videoHeight)
        : document.createElement('canvas');

    overlayCanvas.width = videoWidth;
    overlayCanvas.height = videoHeight;

    const overlayCtx = (overlayCanvas as OffscreenCanvas).getContext
        ? (overlayCanvas as OffscreenCanvas).getContext('2d')
        : (overlayCanvas as HTMLCanvasElement).getContext('2d');

    if (!overlayCtx) return;

    const fontSize = Math.round(videoHeight * (config.fontSizePercent / 100));
    const lineHeight = fontSize * 1.5;
    const padding = fontSize * 0.6;
    const borderRadius = Math.round(videoHeight * 0.005);

    // Build text lines
    const lines: string[] = [];
    if (config.showHr && frame.hr !== undefined) {
        lines.push(`❤️ ${frame.hr} BPM`);
    }
    if (config.showPace && frame.paceSecondsPerKm !== undefined) {
        const paceStr = formatPace(frame.paceSecondsPerKm);
        if (paceStr) {
            lines.push(`🏃 ${paceStr} /km`);
        }
    }
    if (config.showDistance) {
        lines.push(`📏 ${frame.distanceKm.toFixed(2)} km`);
    }
    if (config.showTime) {
        lines.push(`⏱️ ${frame.elapsedTime}`);
    }

    if (lines.length === 0) return;

    // Measure text
    overlayCtx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let maxWidth = 0;
    for (const line of lines) {
        const metrics = overlayCtx.measureText(line);
        if (metrics.width > maxWidth) {
            maxWidth = metrics.width;
        }
    }

    // Background dimensions
    const bgWidth = maxWidth + padding * 2;
    const bgHeight = lines.length * lineHeight + padding * 2;

    // Position
    let x: number;
    let y: number;
    const margin = fontSize;

    switch (config.position) {
        case 'top-left':
            x = margin;
            y = margin;
            break;
        case 'top-right':
            x = videoWidth - bgWidth - margin;
            y = margin;
            break;
        case 'bottom-left':
            x = margin;
            y = videoHeight - bgHeight - margin;
            break;
        case 'bottom-right':
            x = videoWidth - bgWidth - margin;
            y = videoHeight - bgHeight - margin;
            break;
    }

    // Draw background with rounded corners
    overlayCtx.save();
    overlayCtx.fillStyle = `rgba(0, 0, 0, ${config.backgroundOpacity})`;
    overlayCtx.beginPath();
    overlayCtx.roundRect(x, y, bgWidth, bgHeight, borderRadius);
    overlayCtx.fill();

    // Draw text
    overlayCtx.fillStyle = '#FFFFFF';
    overlayCtx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    overlayCtx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
        overlayCtx.fillText(
            lines[i]!,
            x + padding,
            y + padding + i * lineHeight,
        );
    }

    overlayCtx.restore();

    cacheOverlay(cacheKey, overlayCanvas);
    ctx.drawImage(overlayCanvas as CanvasImageSource, 0, 0);
}

/**
 * Render overlay onto a VideoFrame and return a new frame with overlay.
 * Uses OffscreenCanvas for rendering.
 */
export function renderOverlayOnFrame(
    videoFrame: VideoFrame,
    telemetryFrame: TelemetryFrame,
    config: OverlayConfig = DEFAULT_OVERLAY_CONFIG,
): VideoFrame {
    const width = videoFrame.displayWidth;
    const height = videoFrame.displayHeight;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    // Draw the video frame
    ctx.drawImage(videoFrame, 0, 0, width, height);

    // Draw overlay
    renderOverlay(ctx, telemetryFrame, width, height, config);

    // Create a new VideoFrame from the canvas
    const newFrame = new VideoFrame(canvas, {
        timestamp: videoFrame.timestamp,
        duration: videoFrame.duration ?? undefined,
    });

    return newFrame;
}

function buildCacheKey(frame: TelemetryFrame, config: OverlayConfig, width: number, height: number): string {
    return JSON.stringify({
        hr: frame.hr,
        pace: frame.paceSecondsPerKm,
        dist: frame.distanceKm.toFixed(2),
        time: frame.elapsedTime,
        pos: config.position,
        opacity: config.backgroundOpacity,
        font: config.fontSizePercent,
        showHr: config.showHr,
        showPace: config.showPace,
        showDistance: config.showDistance,
        showTime: config.showTime,
        width,
        height,
    });
}

function cacheOverlay(
    key: string,
    sourceCanvas: OffscreenCanvas | HTMLCanvasElement,
): void {
    if (overlayCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = overlayCache.keys().next().value as string | undefined;
        if (firstKey) overlayCache.delete(firstKey);
    }

    overlayCache.set(key, { canvas: sourceCanvas });
}
