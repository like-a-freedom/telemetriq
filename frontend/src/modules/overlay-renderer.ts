import type { TelemetryFrame, ExtendedOverlayConfig } from '../core/types';
import { formatPace } from './telemetry-core';
import { getTemplateConfig } from './template-configs';
import type { OverlayContext2D } from './overlay-utils';
import { renderHorizonLayout } from './layouts/horizon-layout';
import { renderMarginLayout } from './layouts/margin-layout';
import { renderLFrameLayout } from './layouts/lframe-layout';
import { renderClassicLayout } from './layouts/classic-layout';
import { renderExtendedLayout } from './layouts/extended-layouts';
import { WebGPUAdapter } from './webgpu/webgpu-adapter';

type CachedOverlay = {
    canvas: OffscreenCanvas | HTMLCanvasElement;
};

type ScratchOverlay = {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    ctx: OverlayContext2D;
    width: number;
    height: number;
};

const overlayCache = new Map<string, CachedOverlay>();
const scratchOverlays = new WeakMap<object, ScratchOverlay>();
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
 * Uses WebGPU acceleration when available, falls back to Canvas 2D.
 */
export async function renderOverlay(
    ctx: OverlayContext2D,
    frame: TelemetryFrame,
    videoWidth: number,
    videoHeight: number,
    config: ExtendedOverlayConfig = DEFAULT_OVERLAY_CONFIG,
): Promise<void> {
    const effectiveConfig = getEffectiveConfig(config);
    const metrics = buildMetrics(frame, effectiveConfig);

    if (metrics.length === 0) {
        return;
    }

    // Check cache first using display-level values (reduces unnecessary rerenders).
    const shouldUseCache = videoWidth * videoHeight <= MAX_CACHE_PIXELS;
    const cacheKey = shouldUseCache
        ? buildCacheKey(metrics, effectiveConfig, videoWidth, videoHeight)
        : undefined;

    if (cacheKey) {
        const cached = overlayCache.get(cacheKey);
        if (cached) {
            ctx.drawImage(cached.canvas as CanvasImageSource, 0, 0);
            return;
        }
    }

    // Always build overlay with canonical CPU layout engine (template reference rendering).
    const overlayTarget = createOverlayTarget(ctx, videoWidth, videoHeight);
    if (!overlayTarget) return;

    const { canvas: overlayCanvas, ctx: overlayCtx } = overlayTarget;
    if (typeof overlayCtx.clearRect === 'function') {
        overlayCtx.clearRect(0, 0, videoWidth, videoHeight);
    }

    const layoutMode = effectiveConfig.layoutMode || 'box';
    renderLayout(overlayCtx, metrics, frame, videoWidth, videoHeight, effectiveConfig, layoutMode);

    if (cacheKey) {
        cacheOverlay(cacheKey, overlayCanvas, videoWidth, videoHeight);
    }

    // Use WebGPU only for compositing base frame + already-rendered overlay.
    let composited = false;
    if (WebGPUAdapter.isSupported()) {
        try {
            const adapter = WebGPUAdapter.getInstance();
            if (adapter.isEnabled()) {
                composited = await adapter.compositeOverlay(
                    ctx,
                    overlayCanvas as CanvasImageSource,
                    videoWidth,
                    videoHeight,
                    cacheKey,
                );
            }
        } catch (error) {
            console.warn('WebGPU compositing failed, falling back to Canvas 2D:', error);
        }
    }

    if (!composited) {
        ctx.drawImage(overlayCanvas as CanvasImageSource, 0, 0);
    }

}

function getEffectiveConfig(config: ExtendedOverlayConfig): ExtendedOverlayConfig {
    if (config.templateId && config.templateId !== 'custom') {
        const templateConfig = getTemplateConfig(config.templateId as any);
        return { ...templateConfig, ...config };
    }
    return config;
}

const BASIC_LAYOUTS: Record<string, (ctx: OverlayContext2D, metrics: MetricItem[], w: number, h: number, config: ExtendedOverlayConfig) => void> = {
    'bottom-bar': renderHorizonLayout,
    'side-margins': renderMarginLayout,
    'box': renderClassicLayout,
};

const EXTENDED_LAYOUTS = new Set([
    'arc-gauge', 'hero-number',
    'cinematic-bar', 'editorial',
    'ticker-tape', 'whisper', 'two-tone', 'condensed-strip',
    'soft-rounded', 'thin-line', 'swiss-grid',
    'garmin-style', 'sports-broadcast', 'cockpit-hud',
    'terminal', 'night-runner', 'data-block', 'race-tag',
    'glass-panel', 'minimal-ring', 'stretched-bar',
    'focus-type',
]);

function renderLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    layoutMode: string,
): void {
    if (layoutMode === 'corner-frame') {
        renderLFrameLayout(ctx, metrics, frame, w, h, config);
        return;
    }

    if (EXTENDED_LAYOUTS.has(layoutMode)) {
        renderExtendedLayout(ctx, metrics, w, h, config, layoutMode);
        return;
    }

    const basicRenderer = BASIC_LAYOUTS[layoutMode] ?? renderClassicLayout;
    basicRenderer(ctx, metrics, w, h, config);
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
    metrics: MetricItem[],
    config: ExtendedOverlayConfig,
    width: number,
    height: number,
): string {
    return JSON.stringify({
        metrics,
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
    destinationCtx: OverlayContext2D,
    width: number,
    height: number,
): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: OverlayContext2D } | null {
    const key = destinationCtx.canvas as unknown as object;
    const cached = scratchOverlays.get(key);
    if (cached && cached.width === width && cached.height === height) {
        return { canvas: cached.canvas, ctx: cached.ctx };
    }

    const canvas = createCanvas(width, height);
    const ctx = getCanvasContext(canvas);

    if (!ctx) return null;
    scratchOverlays.set(key, { canvas, ctx, width, height });
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
 * Uses WebGPU acceleration when available.
 */
export async function renderOverlayOnFrame(
    videoFrame: VideoFrame,
    telemetryFrame: TelemetryFrame,
    config: ExtendedOverlayConfig = DEFAULT_OVERLAY_CONFIG,
): Promise<VideoFrame> {
    const width = videoFrame.displayWidth;
    const height = videoFrame.displayHeight;

    const effectiveConfig = getEffectiveConfig(config);
    const metrics = buildMetrics(telemetryFrame, effectiveConfig);

    if (metrics.length > 0) {
        const shouldUseCache = width * height <= MAX_CACHE_PIXELS;
        const cacheKey = shouldUseCache
            ? buildCacheKey(metrics, effectiveConfig, width, height)
            : undefined;

        let overlayCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;

        if (cacheKey) {
            const cached = overlayCache.get(cacheKey);
            if (cached) {
                overlayCanvas = cached.canvas;
            }
        }

        if (!overlayCanvas) {
            const standaloneCanvas = createCanvas(width, height);
            const standaloneCtx = getCanvasContext(standaloneCanvas);
            if (standaloneCtx) {
                if (typeof standaloneCtx.clearRect === 'function') {
                    standaloneCtx.clearRect(0, 0, width, height);
                }
                const layoutMode = effectiveConfig.layoutMode || 'box';
                renderLayout(standaloneCtx, metrics, telemetryFrame, width, height, effectiveConfig, layoutMode);
                overlayCanvas = standaloneCanvas;

                if (cacheKey) {
                    cacheOverlay(cacheKey, standaloneCanvas, width, height);
                    overlayCanvas = overlayCache.get(cacheKey)?.canvas ?? standaloneCanvas;
                }
            }
        }

        if (overlayCanvas && WebGPUAdapter.isSupported()) {
            try {
                const adapter = WebGPUAdapter.getInstance();
                if (adapter.isEnabled()) {
                    const gpuFrame = await adapter.compositeVideoFrame(
                        videoFrame,
                        overlayCanvas as CanvasImageSource,
                        width,
                        height,
                        cacheKey,
                    );
                    if (gpuFrame) return gpuFrame;
                }
            } catch (error) {
                console.warn('WebGPU VideoFrame compositing failed, using Canvas fallback:', error);
            }
        }
    }

    // Canvas 2D fallback
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(videoFrame, 0, 0, width, height);
    await renderOverlay(ctx, telemetryFrame, width, height, config);

    return new VideoFrame(canvas, {
        timestamp: videoFrame.timestamp,
        duration: videoFrame.duration ?? undefined,
    });
}
