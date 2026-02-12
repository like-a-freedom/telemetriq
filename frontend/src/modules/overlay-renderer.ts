import type { TelemetryFrame, ExtendedOverlayConfig } from '../core/types';
import { formatPace } from './telemetry-core';
import { getTemplateConfig } from './template-configs';

type OverlayContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

type CachedOverlay = {
    canvas: OffscreenCanvas | HTMLCanvasElement;
};

const overlayCache = new Map<string, CachedOverlay>();
const MAX_CACHE_ENTRIES = 200;

/** Metric data prepared for rendering */
interface MetricItem {
    label: string;
    value: string;
    unit: string;
}

type ResolutionTuning = {
    textScale: number;
    spacingScale: number;
    labelTrackingScale: number;
};

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
    let effectiveConfig = config;
    if (config.templateId && config.templateId !== 'custom') {
        const templateConfig = getTemplateConfig(config.templateId as any);
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

    const metrics = buildMetrics(frame, effectiveConfig);
    if (metrics.length === 0) return;

    const layoutMode = effectiveConfig.layoutMode || 'box';

    switch (layoutMode) {
        case 'bottom-bar':
            renderHorizonLayout(overlayCtx, metrics, videoWidth, videoHeight, effectiveConfig);
            break;
        case 'side-margins':
            renderMarginLayout(overlayCtx, metrics, videoWidth, videoHeight, effectiveConfig);
            break;
        case 'corner-frame':
            renderLFrameLayout(overlayCtx, metrics, frame, videoWidth, videoHeight, effectiveConfig);
            break;
        case 'box':
        default:
            renderClassicLayout(overlayCtx, metrics, videoWidth, videoHeight, effectiveConfig);
            break;
    }

    cacheOverlay(cacheKey, overlayCanvas, videoWidth, videoHeight);
    ctx.drawImage(overlayCanvas as CanvasImageSource, 0, 0);
}

// ──────────────────────────────────────────────
// Horizon Layout (Bottom bar with gradient)
// ──────────────────────────────────────────────

function renderHorizonLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);
    const barHeight = h * 0.16;
    const barY = h - barHeight;

    // Gradient background: transparent → dark
    const grad = ctx.createLinearGradient(0, barY - barHeight * 0.5, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.4, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, `rgba(0,0,0,${config.backgroundOpacity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY - barHeight * 0.5, w, barHeight * 1.5);

    // Progress line at very bottom
    const accent = config.accentColor || '#ef4444';
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - Math.max(2, h * 0.003), w * 0.35, Math.max(2, h * 0.003));

    // Layout metrics horizontally
    const fontFamily = config.fontFamily || 'Inter, sans-serif';
    const baseFontSize = Math.round(h * (config.fontSizePercent || 2.4) / 100 * tuning.textScale);
    const labelSize = Math.max(8, Math.round(baseFontSize * (config.labelSizeMultiplier || 0.4)));

    const padding = w * 0.04 * tuning.spacingScale;
    const metricCount = metrics.length;
    const availableWidth = w - padding * 2;
    const columnWidth = availableWidth / metricCount;

    ctx.save();
    applyTextShadow(ctx, config);

    for (let i = 0; i < metricCount; i++) {
        const metric = metrics[i]!;
        const colX = padding + columnWidth * i;
        const centerX = colX + columnWidth / 2;
        const baselineY = h - barHeight * 0.22;

        let valueSize = Math.min(
            Math.round(baseFontSize * (config.valueSizeMultiplier || 2.5) * tuning.textScale),
            Math.round(barHeight * 0.43),
        );
        const minValueSize = Math.max(12, Math.round(barHeight * 0.22));
        while (valueSize > minValueSize) {
            const unitSizeTry = Math.max(8, Math.round(valueSize * 0.42 * tuning.textScale));
            const weightTry = fontWeightValue(config.valueFontWeight || 'bold');
            ctx.font = `${weightTry} ${valueSize}px ${fontFamily}`;
            const valueWidth = ctx.measureText(metric.value).width;
            ctx.font = `300 ${unitSizeTry}px ${fontFamily}`;
            const unitWidthTry = metric.unit ? ctx.measureText(metric.unit).width + unitSizeTry * 0.35 : 0;
            if (valueWidth + unitWidthTry <= columnWidth * 0.82) break;
            valueSize -= 1;
        }
        const unitSize = Math.max(8, Math.round(valueSize * 0.42 * tuning.textScale));

        // Separator line (except first)
        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colX, baselineY - valueSize * 0.95);
            ctx.lineTo(colX, baselineY + labelSize * 0.5);
            ctx.stroke();
        }

        // Label (uppercase, compact, center-aligned)
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${labelSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(metric.label.toUpperCase(), centerX, baselineY - valueSize - labelSize * 0.3);

        // Value (large, bold)
        const weight = fontWeightValue(config.valueFontWeight || 'bold');
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        // Measure value for placing unit without changing value center
        const valueMetrics = ctx.measureText(metric.value);
        const totalValueWidth = valueMetrics.width;

        // Keep all values centered in their columns for vertical consistency
        ctx.fillText(metric.value, centerX, baselineY);

        // Unit (small, dimmed)
        if (metric.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `300 ${unitSize}px ${fontFamily}`;
            ctx.textAlign = 'left';
            ctx.fillText(metric.unit, centerX + totalValueWidth / 2 + unitSize * 0.15, baselineY);
        }
    }

    ctx.restore();
}

// ──────────────────────────────────────────────
// Margin Layout (Large typography on side margins)
// ──────────────────────────────────────────────

function renderMarginLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);
    // Subtle edge gradients
    const leftGrad = ctx.createLinearGradient(0, 0, w * 0.15, 0);
    leftGrad.addColorStop(0, `rgba(0,0,0,${config.backgroundOpacity * 0.7})`);
    leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, w * 0.15, h);

    const rightGrad = ctx.createLinearGradient(w, 0, w * 0.85, 0);
    rightGrad.addColorStop(0, `rgba(0,0,0,${config.backgroundOpacity * 0.7})`);
    rightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(w * 0.85, 0, w * 0.15, h);

    const fontFamily = config.fontFamily || 'Inter, sans-serif';
    const baseFontSize = Math.round(h * (config.fontSizePercent || 2.0) / 100 * tuning.textScale);

    // Split metrics into left and right columns
    const half = Math.ceil(metrics.length / 2);
    const leftMetrics = metrics.slice(0, half);
    const rightMetrics = metrics.slice(half);

    const marginX = w * 0.045 * tuning.spacingScale;
    const leftSlots = Math.max(1, leftMetrics.length);
    const rightSlots = Math.max(1, rightMetrics.length);
    const leftSlotHeight = (h * 0.72) / leftSlots;
    const rightSlotHeight = (h * 0.72) / rightSlots;

    ctx.save();
    applyTextShadow(ctx, config);

    // Left side metrics (aligned left)
    const leftStartY = h * 0.18;
    for (let i = 0; i < leftMetrics.length; i++) {
        const metric = leftMetrics[i]!;
        const metricY = leftStartY + i * leftSlotHeight;
        const valueSize = Math.max(14, Math.min(
            Math.round(baseFontSize * (config.valueSizeMultiplier || 3.5) * tuning.textScale),
            Math.round(leftSlotHeight * 0.42),
        ));
        const labelSize = Math.max(8, Math.round(valueSize * 0.2 * tuning.textScale));
        const unitSize = Math.max(8, Math.round(valueSize * 0.22 * tuning.textScale));

        // Vertical label (rotated, compact abbreviation to avoid overflow)
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `300 ${labelSize}px ${fontFamily}`;
        ctx.translate(marginX + labelSize * 0.8, metricY + valueSize);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(getMarginLabel(metric.label), 0, 0);
        ctx.restore();

        // Value
        const weight = fontWeightValue(config.valueFontWeight || 'light');
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(metric.value, marginX, metricY + valueSize);

        // Unit below value
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `300 ${unitSize}px ${fontFamily}`;
        ctx.fillText(metric.unit.toUpperCase(), marginX, metricY + valueSize + unitSize * 1.5);
    }

    // Right side metrics (aligned right)
    const rightStartY = h * 0.18;
    for (let i = 0; i < rightMetrics.length; i++) {
        const metric = rightMetrics[i]!;
        const metricY = rightStartY + i * rightSlotHeight;
        const rightX = w - marginX;
        const valueSize = Math.max(14, Math.min(
            Math.round(baseFontSize * (config.valueSizeMultiplier || 3.5) * tuning.textScale),
            Math.round(rightSlotHeight * 0.42),
        ));
        const unitSize = Math.max(8, Math.round(valueSize * 0.22 * tuning.textScale));

        // Value
        const weight = fontWeightValue(config.valueFontWeight || 'light');
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(metric.value, rightX, metricY + valueSize);

        // Unit below value
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `300 ${unitSize}px ${fontFamily}`;
        ctx.textAlign = 'right';
        ctx.fillText(metric.unit.toUpperCase(), rightX, metricY + valueSize + unitSize * 1.5);
    }

    // Left vertical progress line
    const lineX = Math.round(w * 0.005);
    const lineW = Math.max(1, Math.round(w * 0.002));
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(lineX, 0, lineW, h);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(lineX, 0, lineW, h * 0.33);

    ctx.restore();
}

// ──────────────────────────────────────────────
// L-Frame Layout (Corner frame with metrics)
// ──────────────────────────────────────────────

function renderLFrameLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    _frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);
    // Subtle bottom gradient
    const grad = ctx.createLinearGradient(0, h * 0.7, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);

    const fontFamily = config.fontFamily || 'Inter, sans-serif';
    const baseFontSize = Math.round(h * (config.fontSizePercent || 2.0) / 100 * tuning.textScale);
    const valueSizeBase = Math.round(baseFontSize * (config.valueSizeMultiplier || 3.0) * tuning.textScale);

    const margin = w * 0.04 * tuning.spacingScale;
    const bottomMargin = h * 0.05;
    const frameX = margin + valueSizeBase * 0.2;
    const frameBottom = h - bottomMargin;

    ctx.save();
    applyTextShadow(ctx, config);

    // Draw L-frame lines
    const lineColor = 'rgba(255,255,255,0.5)';
    const lineW = Math.max(1, Math.round(h * 0.001));
    const verticalLineHeight = h * 0.18;
    const horizontalLineWidth = w * 0.84;

    // Vertical line of L
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(frameX, frameBottom - verticalLineHeight);
    ctx.lineTo(frameX, frameBottom);
    ctx.stroke();

    // Horizontal line of L
    ctx.beginPath();
    ctx.moveTo(frameX, frameBottom);
    ctx.lineTo(frameX + horizontalLineWidth, frameBottom);
    ctx.stroke();

    // Corner dot
    const dotRadius = Math.max(2, h * 0.003);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(frameX, frameBottom, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Metrics along horizontal line
    const metricsStartX = frameX + margin * 0.45;
    const metricsAreaWidth = horizontalLineWidth - margin * 0.9;
    const metricGap = metricsAreaWidth / Math.max(1, metrics.length);
    const metricsY = frameBottom - margin * 0.3;

    for (let i = 0; i < metrics.length; i++) {
        const metric = metrics[i]!;
        const mx = metricsStartX + i * metricGap + metricGap / 2;
        const valueSize = Math.max(14, Math.min(valueSizeBase, Math.round(h * 0.09)));
        const labelSize = Math.max(8, Math.round(valueSize * 0.2 * tuning.textScale));
        const unitSize = Math.max(8, Math.round(valueSize * 0.28 * tuning.textScale));

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = `300 ${labelSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const labelStartX = mx - (ctx.measureText(metric.label.toUpperCase()).width / 2);
        drawTrackedText(
            ctx,
            metric.label.toUpperCase(),
            labelStartX,
            metricsY - valueSize - labelSize * 0.2,
            (config.labelLetterSpacing || 0.15) * tuning.labelTrackingScale,
            labelSize,
        );

        // Value
        const weight = fontWeightValue(config.valueFontWeight || 'light');
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(metric.value, mx, metricsY);

        // Unit
        if (metric.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `300 ${unitSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(metric.unit, mx, metricsY + unitSize * 1.25);
        }
    }

    // Progress bar at very bottom
    const barH = Math.max(1, h * 0.002);
    ctx.fillStyle = 'rgba(128,128,128,0.3)';
    ctx.fillRect(0, h - barH * 2, w, barH * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(0, h - barH * 2, w * 0.33, barH * 2);

    ctx.restore();
}

// ──────────────────────────────────────────────
// Classic Layout (Original box overlay)
// ──────────────────────────────────────────────

function renderClassicLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);
    const fontSize = Math.round(h * (config.fontSizePercent / 100) * tuning.textScale);
    const lineHeight = fontSize * (config.lineSpacing || 1.5);
    const padding = fontSize * 0.6 * tuning.spacingScale;
    const borderRadius = config.cornerRadius !== undefined
        ? Math.round(h * (config.cornerRadius / 100))
        : Math.round(h * 0.005);

    const lines = buildOverlayLines(metrics);
    if (lines.length === 0) return;

    const fontFamily = config.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    let maxWidth = 0;
    for (const line of lines) {
        const m = ctx.measureText(line);
        if (m.width > maxWidth) maxWidth = m.width;
    }

    const bgWidth = maxWidth + padding * 2;
    const bgHeight = lines.length * lineHeight + padding * 2;

    let x: number;
    let y: number;
    const margin = fontSize;

    switch (config.position) {
        case 'top-left':
            x = margin; y = margin; break;
        case 'top-right':
            x = w - bgWidth - margin; y = margin; break;
        case 'bottom-left':
            x = margin; y = h - bgHeight - margin; break;
        case 'bottom-right':
            x = w - bgWidth - margin; y = h - bgHeight - margin; break;
    }

    ctx.save();

    const hasVisibleBackground =
        (config.gradientBackground && !!config.gradientStartColor && !!config.gradientEndColor)
        || (!!config.backgroundColor && config.backgroundColor !== 'transparent' && config.backgroundColor !== 'rgba(0, 0, 0, 0)')
        || ((config.backgroundOpacity || 0) > 0);

    if (hasVisibleBackground) {
        if (config.gradientBackground && config.gradientStartColor && config.gradientEndColor) {
            const gradient = ctx.createLinearGradient(x, y, x, y + bgHeight);
            gradient.addColorStop(0, config.gradientStartColor);
            gradient.addColorStop(1, config.gradientEndColor);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = config.backgroundColor || `rgba(0, 0, 0, ${config.backgroundOpacity})`;
        }

        ctx.beginPath();
        ctx.roundRect(x, y, bgWidth, bgHeight, borderRadius);
        ctx.fill();
    }

    if (config.borderWidth && config.borderColor) {
        ctx.strokeStyle = config.borderColor;
        ctx.lineWidth = config.borderWidth;
        ctx.stroke();
    }

    ctx.fillStyle = config.textColor || '#FFFFFF';
    applyTextShadow(ctx, config);
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i]!, x + padding, y + padding + i * lineHeight);
    }

    ctx.restore();
}

// ──────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────

function applyTextShadow(ctx: OverlayContext2D, config: ExtendedOverlayConfig): void {
    if (config.textShadow && config.textShadowColor) {
        ctx.shadowColor = config.textShadowColor;
        ctx.shadowBlur = config.textShadowBlur || 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
}

function drawTrackedText(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    letterSpacingEm: number,
    fontSize: number,
): void {
    const spacing = fontSize * letterSpacingEm;
    let curX = x;
    for (const char of text) {
        ctx.fillText(char, curX, y);
        curX += ctx.measureText(char).width + spacing;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function getResolutionTuning(width: number, height: number): ResolutionTuning {
    const shortSide = Math.min(width, height);
    const textScale = clamp(shortSide / 1080, 0.86, 1.18);
    const spacingScale = clamp(shortSide / 1080, 0.92, 1.1);
    const labelTrackingScale = shortSide < 900 ? 0.82 : 1;
    return {
        textScale,
        spacingScale,
        labelTrackingScale,
    };
}

function fontWeightValue(weight: string): number {
    switch (weight) {
        case 'light': return 300;
        case 'normal': return 400;
        case 'bold': return 700;
        default: return 400;
    }
}

function getMarginLabel(label: string): string {
    switch (label.toLowerCase()) {
        case 'heart rate':
            return 'HR';
        case 'distance':
            return 'DIST';
        default:
            return label.toUpperCase();
    }
}

function buildMetrics(frame: TelemetryFrame, config: ExtendedOverlayConfig): MetricItem[] {
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

function buildOverlayLines(metrics: MetricItem[]): string[] {
    return metrics.map(m => {
        const icon = metricIcon(m.label);
        return `${icon} ${m.value} ${m.unit}`.trim();
    });
}

function metricIcon(label: string): string {
    switch (label.toLowerCase()) {
        case 'heart rate': return '❤️';
        case 'pace': return '🏃';
        case 'distance': return '📏';
        case 'time': return '⏱️';
        default: return '';
    }
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
    return { canvas, ctx };
}
