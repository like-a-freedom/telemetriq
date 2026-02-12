import type { TelemetryFrame, OverlayConfig } from '../core/types';
import { formatPace } from './telemetry-core';

type CachedOverlay = {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    width: number;
    height: number;
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
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let maxWidth = 0;
    for (const line of lines) {
        const metrics = ctx.measureText(line);
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
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${config.backgroundOpacity})`;
    ctx.beginPath();
    ctx.roundRect(x, y, bgWidth, bgHeight, borderRadius);
    ctx.fill();

    // Draw text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(
            lines[i]!,
            x + padding,
            y + padding + i * lineHeight,
        );
    }

    ctx.restore();

    cacheOverlay(cacheKey, videoWidth, videoHeight, ctx);
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
    width: number,
    height: number,
    sourceCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): void {
    if (overlayCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = overlayCache.keys().next().value as string | undefined;
        if (firstKey) overlayCache.delete(firstKey);
    }

    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const ctx = (canvas as OffscreenCanvas).getContext
        ? (canvas as OffscreenCanvas).getContext('2d')
        : (canvas as HTMLCanvasElement).getContext('2d');

    if (!ctx) return;
    ctx.drawImage(sourceCtx.canvas as CanvasImageSource, 0, 0);

    overlayCache.set(key, { canvas, width, height });
}
