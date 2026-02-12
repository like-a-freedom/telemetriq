import type { TelemetryFrame, OverlayConfig, ExtendedOverlayConfig } from '../core/types';
import { formatPace } from './telemetry-core';
import { getTemplateConfig } from './template-configs';

type OverlayContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

type CachedOverlay = {
    canvas: OffscreenCanvas | HTMLCanvasElement;
};

const overlayCache = new Map<string, CachedOverlay>();
const MAX_CACHE_ENTRIES = 200;

/** Default overlay configuration */
export const DEFAULT_OVERLAY_CONFIG: ExtendedOverlayConfig = {
    templateId: 'minimalist',
    position: 'top-left',
    backgroundOpacity: 0.7,
    fontSizePercent: 2.5,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    borderWidth: 0,
    borderColor: '#FFFFFF',
    cornerRadius: 4,
    textShadow: false,
    textShadowColor: '#000000',
    textShadowBlur: 2,
    lineSpacing: 1.5,
    layout: 'vertical',
    iconStyle: 'outline',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
};

/**
 * Render the telemetry overlay onto a canvas.
 * This function draws the telemetry data as a semi-transparent overlay.
 */
export function renderOverlay(
    ctx: OverlayContext2D,
    frame: TelemetryFrame,
    videoWidth: number,
    videoHeight: number,
    config: ExtendedOverlayConfig = DEFAULT_OVERLAY_CONFIG,
): void {
    // If config has a templateId that differs from the current config, merge template properties
    let effectiveConfig = config;
    if (config.templateId && config.templateId !== 'custom') {
        const templateConfig = getTemplateConfig(config.templateId as any);
        // Merge template config with user overrides
        effectiveConfig = { ...templateConfig, ...config };
    }

    const cacheKey = buildCacheKey(frame, effectiveConfig, videoWidth, videoHeight);
    const cached = overlayCache.get(cacheKey);
    if (cached) {
        ctx.drawImage(cached.canvas as CanvasImageSource, 0, 0);
        return;
    }

    const overlayTarget = createOverlayTarget(videoWidth, videoHeight);
    if (!overlayTarget) return;
    const { canvas: overlayCanvas, ctx: overlayCtx } = overlayTarget;

    const fontSize = Math.round(videoHeight * (effectiveConfig.fontSizePercent / 100));
    const lineHeight = fontSize * (effectiveConfig.lineSpacing || 1.5);
    const padding = fontSize * 0.6;
    const borderRadius = effectiveConfig.cornerRadius !== undefined 
        ? Math.round(videoHeight * (effectiveConfig.cornerRadius / 100)) 
        : Math.round(videoHeight * 0.005);

    const lines = buildOverlayLines(frame, effectiveConfig);

    if (lines.length === 0) return;

    // Measure text
    const fontFamily = effectiveConfig.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    overlayCtx.font = `bold ${fontSize}px ${fontFamily}`;
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

    switch (effectiveConfig.position) {
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
    
    // Handle gradient background if enabled
    if (effectiveConfig.gradientBackground && effectiveConfig.gradientStartColor && effectiveConfig.gradientEndColor) {
        const gradient = overlayCtx.createLinearGradient(x, y, x, y + bgHeight);
        gradient.addColorStop(0, effectiveConfig.gradientStartColor);
        gradient.addColorStop(1, effectiveConfig.gradientEndColor);
        overlayCtx.fillStyle = gradient;
    } else {
        // Use solid background color if specified, otherwise fallback to original behavior
        const bgColor = effectiveConfig.backgroundColor || `rgba(0, 0, 0, ${effectiveConfig.backgroundOpacity})`;
        if (bgColor.startsWith('rgba')) {
            overlayCtx.fillStyle = bgColor;
        } else {
            // If it's a hex color, we need to incorporate the opacity
            overlayCtx.fillStyle = bgColor;
        }
    }
    
    overlayCtx.beginPath();
    overlayCtx.roundRect(x, y, bgWidth, bgHeight, borderRadius);
    overlayCtx.fill();

    // Draw border if specified
    if (effectiveConfig.borderWidth && effectiveConfig.borderColor) {
        overlayCtx.strokeStyle = effectiveConfig.borderColor;
        overlayCtx.lineWidth = effectiveConfig.borderWidth;
        overlayCtx.stroke();
    }

    // Draw text
    const textColor = effectiveConfig.textColor || '#FFFFFF';
    overlayCtx.fillStyle = textColor;
    
    // Apply text shadow if enabled
    if (effectiveConfig.textShadow && effectiveConfig.textShadowColor && effectiveConfig.textShadowBlur) {
        overlayCtx.shadowColor = effectiveConfig.textShadowColor;
        overlayCtx.shadowBlur = effectiveConfig.textShadowBlur;
        overlayCtx.shadowOffsetX = 0;
        overlayCtx.shadowOffsetY = 0;
    }
    
    overlayCtx.font = `bold ${fontSize}px ${fontFamily}`;
    overlayCtx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
        overlayCtx.fillText(
            lines[i]!,
            x + padding,
            y + padding + i * lineHeight,
        );
    }

    overlayCtx.restore();

    cacheOverlay(cacheKey, overlayCanvas, videoWidth, videoHeight);
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

function buildCacheKey(frame: TelemetryFrame, config: ExtendedOverlayConfig, width: number, height: number): string {
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
        templateId: config.templateId,
        fontFamily: config.fontFamily,
        textColor: config.textColor,
        backgroundColor: config.backgroundColor,
        borderWidth: config.borderWidth,
        borderColor: config.borderColor,
        cornerRadius: config.cornerRadius,
        textShadow: config.textShadow,
        textShadowColor: config.textShadowColor,
        textShadowBlur: config.textShadowBlur,
        lineSpacing: config.lineSpacing,
        layout: config.layout,
        iconStyle: config.iconStyle,
        gradientBackground: config.gradientBackground,
        gradientStartColor: config.gradientStartColor,
        gradientEndColor: config.gradientEndColor,
        width,
        height,
    });
}

function cacheOverlay(
    key: string,
    sourceCanvas: OffscreenCanvas | HTMLCanvasElement,
    width: number,
    height: number,
): void {
    if (overlayCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = overlayCache.keys().next().value as string | undefined;
        if (firstKey) overlayCache.delete(firstKey);
    }

    const cacheCanvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');

    cacheCanvas.width = width;
    cacheCanvas.height = height;

    const cacheCtx = (cacheCanvas as OffscreenCanvas).getContext
        ? (cacheCanvas as OffscreenCanvas).getContext('2d')
        : (cacheCanvas as HTMLCanvasElement).getContext('2d');

    if (!cacheCtx) return;

    cacheCtx.drawImage(sourceCanvas as CanvasImageSource, 0, 0);
    overlayCache.set(key, { canvas: cacheCanvas });
}

function buildOverlayLines(frame: TelemetryFrame, config: OverlayConfig): string[] {
    const lines: string[] = [];

    if (config.showHr && frame.hr !== undefined) {
        lines.push(`❤️ ${frame.hr} BPM`);
    }
    if (config.showPace && frame.paceSecondsPerKm !== undefined) {
        const paceStr = formatPace(frame.paceSecondsPerKm);
        if (paceStr) lines.push(`🏃 ${paceStr} /km`);
    }
    if (config.showDistance) {
        lines.push(`📏 ${frame.distanceKm.toFixed(2)} km`);
    }
    if (config.showTime) {
        lines.push(`⏱️ ${frame.elapsedTime}`);
    }

    return lines;
}

function createOverlayTarget(
    width: number,
    height: number,
): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: OverlayContext2D } | null {
    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const ctx = (canvas as OffscreenCanvas).getContext
        ? (canvas as OffscreenCanvas).getContext('2d')
        : (canvas as HTMLCanvasElement).getContext('2d');

    if (!ctx) return null;
    return {
        canvas,
        ctx,
    };
}
