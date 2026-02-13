import type { TelemetryFrame, ExtendedOverlayConfig } from '../core/types';
import { formatPace } from './telemetry-core';
import { getTemplateConfig } from './template-configs';
import type { OverlayContext2D } from './overlay-utils';
import { renderHorizonLayout } from './layouts/horizon-layout';
import { renderMarginLayout } from './layouts/margin-layout';
import { renderLFrameLayout } from './layouts/lframe-layout';
import { renderClassicLayout } from './layouts/classic-layout';

type CachedOverlay = {
    canvas: OffscreenCanvas | HTMLCanvasElement;
};

const overlayCache = new Map<string, CachedOverlay>();
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHE_PIXELS = 1280 * 720;

/** Metric data prepared for rendering */
export interface MetricItem {
    label: string;
    value: string;
    unit: string;
}

/** Default overlay configuration */
export const DEFAULT_OVERLAY_CONFIG: ExtendedOverlayConfig = {
    templateId: 'horizon',
    layoutMode: 'bottom-bar',
    position: 'bottom-left',
    backgroundOpacity: 0.85,
    fontSizePercent: 2.4,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    borderWidth: 0,
    borderColor: 'transparent',
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: '#000000',
    textShadowBlur: 0,
    lineSpacing: 1.2,
    layout: 'horizontal',
    iconStyle: 'none',
    gradientBackground: true,
    gradientStartColor: 'rgba(0,0,0,0)',
    gradientEndColor: 'rgba(0,0,0,0.9)',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.5,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.15,
    accentColor: '#ef4444',
};

/**
 * Render the telemetry overlay onto a canvas.
 * Dispatches to the appropriate layout renderer based on template config.
 */
export function renderOverlay(
    ctx: OverlayContext2D,
    frame: TelemetryFrame,
    videoWidth: number,
    videoHeight: number,
    config: ExtendedOverlayConfig = DEFAULT_OVERLAY_CONFIG,
): void {
    const effectiveConfig = getEffectiveConfig(config);

    const shouldUseCache = videoWidth * videoHeight <= MAX_CACHE_PIXELS;
    const cacheKey = shouldUseCache
        ? buildCacheKey(frame, effectiveConfig, videoWidth, videoHeight)
        : undefined;

    if (cacheKey) {
        const cached = overlayCache.get(cacheKey);
        if (cached) {
            ctx.drawImage(cached.canvas as CanvasImageSource, 0, 0);
            return;
        }
    }

    const overlayTarget = createOverlayTarget(videoWidth, videoHeight);
    if (!overlayTarget) return;

    const { canvas: overlayCanvas, ctx: overlayCtx } = overlayTarget;
    const metrics = buildMetrics(frame, effectiveConfig);

    if (metrics.length === 0) return;

    const layoutMode = effectiveConfig.layoutMode || 'box';
    renderLayout(overlayCtx, metrics, frame, videoWidth, videoHeight, effectiveConfig, layoutMode);

    if (cacheKey) {
        cacheOverlay(cacheKey, overlayCanvas, videoWidth, videoHeight);
    }
    ctx.drawImage(overlayCanvas as CanvasImageSource, 0, 0);
}

function getEffectiveConfig(config: ExtendedOverlayConfig): ExtendedOverlayConfig {
    if (config.templateId && config.templateId !== 'custom') {
        const templateConfig = getTemplateConfig(config.templateId as any);
        return { ...templateConfig, ...config };
    }
    return config;
}

function renderLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    layoutMode: string,
): void {
    switch (layoutMode) {
        case 'bottom-bar':
            renderHorizonLayout(ctx, metrics, w, h, config);
            break;
        case 'side-margins':
            renderMarginLayout(ctx, metrics, w, h, config);
            break;
        case 'corner-frame':
            renderLFrameLayout(ctx, metrics, frame, w, h, config);
            break;
        case 'box':
        default:
            renderClassicLayout(ctx, metrics, w, h, config);
            break;
    }
}

export function buildMetrics(frame: TelemetryFrame, config: ExtendedOverlayConfig): MetricItem[] {
    const items: MetricItem[] = [];

    if (config.showPace && frame.paceSecondsPerKm !== undefined) {
        const paceStr = formatPace(frame.paceSecondsPerKm);
        if (paceStr) items.push({ label: 'Pace', value: paceStr, unit: 'min/km' });
    }
    if (config.showHr && frame.hr !== undefined) {
        items.push({ label: 'Heart Rate', value: String(frame.hr), unit: 'bpm' });
    }
    if (config.showDistance) {
        items.push({ label: 'Distance', value: frame.distanceKm.toFixed(1), unit: 'km' });
    }
    if (config.showTime) {
        items.push({ label: 'Time', value: frame.elapsedTime, unit: '' });
    }

    return items;
}

function buildCacheKey(
    frame: TelemetryFrame,
    config: ExtendedOverlayConfig,
    width: number,
    height: number,
): string {
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
        layoutMode: config.layoutMode,
        fontFamily: config.fontFamily,
        textColor: config.textColor,
        backgroundColor: config.backgroundColor,
        valueFontWeight: config.valueFontWeight,
        valueSizeMultiplier: config.valueSizeMultiplier,
        accentColor: config.accentColor,
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

    const cacheCanvas = createCanvas(width, height);
    const cacheCtx = getCanvasContext(cacheCanvas);
    if (!cacheCtx) return;

    cacheCtx.drawImage(sourceCanvas as CanvasImageSource, 0, 0);
    overlayCache.set(key, { canvas: cacheCanvas });
}

function createOverlayTarget(
    width: number,
    height: number,
): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: OverlayContext2D } | null {
    const canvas = createCanvas(width, height);
    const ctx = getCanvasContext(canvas);

    if (!ctx) return null;
    return { canvas, ctx };
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function getCanvasContext(
    canvas: OffscreenCanvas | HTMLCanvasElement,
): OverlayContext2D | null {
    if (canvas instanceof OffscreenCanvas) {
        return canvas.getContext('2d');
    }
    return canvas.getContext('2d');
}

/**
 * Render overlay onto a VideoFrame and return a new frame with overlay.
 */
export function renderOverlayOnFrame(
    videoFrame: VideoFrame,
    telemetryFrame: TelemetryFrame,
    config: ExtendedOverlayConfig = DEFAULT_OVERLAY_CONFIG,
): VideoFrame {
    const width = videoFrame.displayWidth;
    const height = videoFrame.displayHeight;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(videoFrame, 0, 0, width, height);
    renderOverlay(ctx, telemetryFrame, width, height, config);

    return new VideoFrame(canvas, {
        timestamp: videoFrame.timestamp,
        duration: videoFrame.duration ?? undefined,
    });
}
