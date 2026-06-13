import type { TelemetryFrame, ExtendedOverlayConfig } from '../core/types';
import { formatPace } from './telemetryCore';
import { getTemplateConfig } from './templates';
import type { OverlayContext2D } from './overlayUtils';
import { renderHorizonLayout } from './layouts/horizonLayout';
import { renderMarginLayout } from './layouts/marginLayout';
import { renderLFrameLayout } from './layouts/lframeLayout';
import { renderClassicLayout } from './layouts/classicLayout';
import { renderTrailRunLayout } from './layouts/trailRunLayout';
import { renderCyclingProLayout } from './layouts/cyclingProLayout';
import { renderExtendedLayout } from './layouts/extendedLayouts';
import { WebGPUAdapter } from './webgpu/webgpuAdapter';

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
const HIGH_RES_SINGLE_CACHE_MAX_PIXELS = 1920 * 1080;

let highResolutionOverlayCache: { key: string; overlay: CachedOverlay } | null = null;

/** Metric data prepared for rendering */
export interface MetricItem {
    label: string;
    value: string;
    unit: string;
}

export interface OverlayRenderContext {
    hrHistory?: number[];
    elevationHistory?: number[];
    destinationHasBaseFrame?: boolean;
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
    showSpeed: false,
    showGrade: false,
    showElevation: false,
    showCadence: false,
    showPower: false,
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
    renderContext: OverlayRenderContext = {},
): Promise<void> {
    const effectiveConfig = getEffectiveConfig(config);
    const metrics = buildMetrics(frame, effectiveConfig);
    const shouldRenderFixedTemplate = shouldRenderWithoutMetrics(effectiveConfig);

    if (metrics.length === 0 && !shouldRenderFixedTemplate) {
        return;
    }

    // Check cache first using display-level values (reduces unnecessary rerenders).
    const cacheStrategy = getCacheStrategy(videoWidth, videoHeight);
    const cacheKey = cacheStrategy !== 'none'
        ? buildCacheKey(metrics, effectiveConfig, videoWidth, videoHeight, renderContext)
        : undefined;

    if (cacheKey) {
        const cached = getCachedOverlay(cacheKey, cacheStrategy);
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
    renderLayout(overlayCtx, metrics, frame, videoWidth, videoHeight, effectiveConfig, layoutMode, renderContext);

    if (cacheKey) {
        cacheOverlay(cacheKey, overlayCanvas, videoWidth, videoHeight, cacheStrategy);
    }

    // Use WebGPU compositing only when the destination canvas already contains a
    // base frame. Preview overlays render into a transparent top-layer canvas,
    // so GPU compositing is unnecessary there and can produce visible blank-frame
    // flashes while async composition finishes.
    let composited = false;
    if (renderContext.destinationHasBaseFrame && WebGPUAdapter.isSupported()) {
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
        const templateConfig = getTemplateConfig(config.templateId);
        return { ...templateConfig, ...config };
    }
    return config;
}

const BASIC_LAYOUTS: Record<string, (ctx: OverlayContext2D, metrics: MetricItem[], w: number, h: number, config: ExtendedOverlayConfig) => void> = {
    'bottom-bar': renderHorizonLayout,
    'side-margins': renderMarginLayout,
    'box': renderClassicLayout,
};

function renderLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    layoutMode: string,
    renderContext: OverlayRenderContext,
): void {
    if (layoutMode === 'trail-run') {
        renderTrailRunLayout(ctx, frame, w, h, config, renderContext);
        return;
    }

    if (layoutMode === 'cycling-pro') {
        renderCyclingProLayout(ctx, frame, w, h, config);
        return;
    }

    if (layoutMode === 'corner-frame') {
        renderLFrameLayout(ctx, metrics, frame, w, h, config);
        return;
    }

    const basicRenderer = BASIC_LAYOUTS[layoutMode];
    if (basicRenderer) {
        basicRenderer(ctx, metrics, w, h, config);
        return;
    }

    renderExtendedLayout(ctx, metrics, w, h, config, layoutMode);
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
    if (config.showSpeed && frame.speedKmh !== undefined) {
        items.push({ label: 'Speed', value: frame.speedKmh.toFixed(frame.speedKmh >= 100 ? 0 : 1), unit: 'km/h' });
    }
    if (config.showGrade && frame.gradePercent !== undefined) {
        items.push({ label: 'Grade', value: frame.gradePercent.toFixed(1), unit: '%' });
    }
    if (config.showElevation && frame.elevationM !== undefined) {
        items.push({ label: 'Elevation', value: Math.round(frame.elevationM).toString(), unit: 'm' });
    }
    if (config.showCadence && frame.cadenceRpm !== undefined) {
        items.push({ label: 'Cadence', value: Math.round(frame.cadenceRpm).toString(), unit: 'rpm' });
    }
    if (config.showPower && frame.powerWatts !== undefined) {
        items.push({ label: 'Power', value: Math.round(frame.powerWatts).toString(), unit: 'W' });
    }

    return items;
}

function shouldRenderWithoutMetrics(config: ExtendedOverlayConfig): boolean {
    return config.layoutMode === 'trail-run' || config.layoutMode === 'cycling-pro';
}

function buildCacheKey(
    metrics: MetricItem[],
    config: ExtendedOverlayConfig,
    width: number,
    height: number,
    renderContext: OverlayRenderContext,
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
        showSpeed: config.showSpeed,
        showGrade: config.showGrade,
        showElevation: config.showElevation,
        showCadence: config.showCadence,
        showPower: config.showPower,
        templateId: config.templateId,
        layoutMode: config.layoutMode,
        fontFamily: config.fontFamily,
        textColor: config.textColor,
        backgroundColor: config.backgroundColor,
        valueFontWeight: config.valueFontWeight,
        valueSizeMultiplier: config.valueSizeMultiplier,
        accentColor: config.accentColor,
        trailRunHrHistory: config.templateId === 'trail-run'
            ? renderContext.hrHistory
            : undefined,
        width,
        height,
    });
}

function getCacheStrategy(
    width: number,
    height: number,
): 'standard' | 'high-resolution-single' | 'none' {
    const pixelCount = width * height;
    if (pixelCount <= MAX_CACHE_PIXELS) return 'standard';
    if (pixelCount <= HIGH_RES_SINGLE_CACHE_MAX_PIXELS) return 'high-resolution-single';
    return 'none';
}

function getCachedOverlay(
    key: string,
    strategy: 'standard' | 'high-resolution-single' | 'none',
): CachedOverlay | undefined {
    if (strategy === 'standard') {
        return overlayCache.get(key);
    }

    if (strategy === 'high-resolution-single' && highResolutionOverlayCache?.key === key) {
        return highResolutionOverlayCache.overlay;
    }

    return undefined;
}

function cacheOverlay(
    key: string,
    sourceCanvas: OffscreenCanvas | HTMLCanvasElement,
    width: number,
    height: number,
    strategy: 'standard' | 'high-resolution-single' | 'none',
): void {
    if (strategy === 'none') return;

    if (overlayCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = overlayCache.keys().next().value as string | undefined;
        if (firstKey) overlayCache.delete(firstKey);
    }

    const cacheCanvas = createCanvas(width, height);
    const cacheCtx = getCanvasContext(cacheCanvas);
    if (!cacheCtx) return;

    cacheCtx.drawImage(sourceCanvas as CanvasImageSource, 0, 0);

    if (strategy === 'high-resolution-single') {
        highResolutionOverlayCache = {
            key,
            overlay: { canvas: cacheCanvas },
        };
        return;
    }

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
    renderContext: OverlayRenderContext = {},
): Promise<VideoFrame> {
    const width = videoFrame.displayWidth;
    const height = videoFrame.displayHeight;

    const effectiveConfig = getEffectiveConfig(config);
    const metrics = buildMetrics(telemetryFrame, effectiveConfig);
    const shouldRenderFixedTemplate = shouldRenderWithoutMetrics(effectiveConfig);

    if (metrics.length > 0 || shouldRenderFixedTemplate) {
        const cacheStrategy = getCacheStrategy(width, height);
        const cacheKey = cacheStrategy !== 'none'
            ? buildCacheKey(metrics, effectiveConfig, width, height, renderContext)
            : undefined;

        let overlayCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;

        if (cacheKey) {
            const cached = getCachedOverlay(cacheKey, cacheStrategy);
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
                renderLayout(standaloneCtx, metrics, telemetryFrame, width, height, effectiveConfig, layoutMode, renderContext);
                overlayCanvas = standaloneCanvas;

                if (cacheKey) {
                    cacheOverlay(cacheKey, standaloneCanvas, width, height, cacheStrategy);
                    overlayCanvas = getCachedOverlay(cacheKey, cacheStrategy)?.canvas ?? standaloneCanvas;
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
    await renderOverlay(ctx, telemetryFrame, width, height, config, {
        ...renderContext,
        destinationHasBaseFrame: true,
    });

    return new VideoFrame(canvas, {
        timestamp: videoFrame.timestamp,
        duration: videoFrame.duration ?? undefined,
    });
}
