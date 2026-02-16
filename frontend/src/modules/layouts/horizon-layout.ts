import type { MetricItem } from '../overlay-renderer';
import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlay-utils';
import {
    getResolutionTuning,
    fontWeightValue,
    applyTextShadow,
    getStableMetricValue,
} from '../overlay-utils';

export function renderHorizonLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);
    const isLandscape = w > h;
    // Make the bottom bar slightly taller on wide (landscape) videos so numeric values remain readable
    const barHeight = h * (isLandscape ? 0.20 : 0.16);
    const barY = h - barHeight;

    drawGradientBackground(ctx, w, h, barY, barHeight, config.backgroundOpacity);
    drawProgressLine(ctx, w, h, config.accentColor);

    const fontFamily = config.fontFamily || 'Inter, sans-serif';
    // Base font scales with video height, but boost it in landscape using a clamped w/h ratio
    const landscapeBoost = isLandscape ? Math.min(1.5, w / h) : 1;
    const baseFontSize = Math.round(h * (config.fontSizePercent || 2.4) / 100 * tuning.textScale * landscapeBoost);
    // Keep labels proportional but give a little extra on landscape for balance
    const labelSize = Math.max(8, Math.round(baseFontSize * (config.labelSizeMultiplier || 0.4) * (isLandscape ? 1.05 : 1)));

    // Add slightly more horizontal padding on wide layouts so columns have breathing room
    const padding = w * 0.04 * tuning.spacingScale * (isLandscape ? 1.08 : 1);
    const columnWidth = (w - padding * 2) / metrics.length;

    const { valueSize, unitSize } = calculateOptimalFontSizes(ctx, metrics, columnWidth, {
        baseFontSize,
        labelSize,
        barHeight,
        fontFamily,
        valueWeight: config.valueFontWeight || 'bold',
        valueMultiplier: config.valueSizeMultiplier || 2.5,
    });

    // Compute baselineY so value/label/unit sit visually inside the bottom bar.
    const barTop = barY;
    const barBottom = barY + barHeight;
    // Prefer a slightly-above-center baseline, but clamp so the unit remains inside the bar.
    let baselineY = Math.round(barTop + barHeight * 0.55);
    baselineY = Math.min(baselineY, Math.round(barBottom - unitSize * 1.28 - 6));
    // Ensure label won't be pushed above the bar top; if it would, bring baseline down.
    const labelTopIfBaseline = baselineY - valueSize - labelSize * 0.35;
    if (labelTopIfBaseline < barTop + 6) {
        baselineY = Math.round(barTop + 6 + valueSize + labelSize * 0.35);
    }

    ctx.save();
    applyTextShadow(ctx, config);

    for (let i = 0; i < metrics.length; i++) {
        renderMetricColumn(ctx, metrics[i]!, i, {
            padding,
            columnWidth,
            centerX: padding + columnWidth * i + columnWidth / 2,
            baselineY,
            labelSize,
            valueSize,
            unitSize,
            fontFamily,
            valueWeight: config.valueFontWeight || 'bold',
            textColor: config.textColor || '#FFFFFF',
        });
    }

    ctx.restore();
}

function drawGradientBackground(
    ctx: OverlayContext2D,
    w: number,
    h: number,
    barY: number,
    barHeight: number,
    opacity: number,
): void {
    const grad = ctx.createLinearGradient(0, barY - barHeight * 0.5, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.4, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, `rgba(0,0,0,${opacity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY - barHeight * 0.5, w, barHeight * 1.5);
}

function drawProgressLine(
    ctx: OverlayContext2D,
    w: number,
    h: number,
    accentColor?: string,
): void {
    const accent = accentColor || '#ef4444';
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - Math.max(2, h * 0.003), w * 0.35, Math.max(2, h * 0.003));
}

interface FontCalcConfig {
    baseFontSize: number;
    labelSize: number;
    barHeight: number;
    fontFamily: string;
    valueWeight: string;
    valueMultiplier: number;
}

function calculateOptimalFontSizes(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    columnWidth: number,
    config: FontCalcConfig,
): { valueSize: number; unitSize: number } {
    // Allow the value font to grow either by the configured multiplier or when column width permits (fixes tiny text in wide videos)
    // Keep value size bounded by bar height (primary) and available column width (secondary).
    let valueSize = Math.min(
        Math.round(config.baseFontSize * config.valueMultiplier),
        Math.round(config.barHeight * 0.43),
        Math.round(columnWidth * 0.22),
    );
    const minValueSize = Math.max(12, Math.round(config.barHeight * 0.22));

    while (valueSize > minValueSize) {
        const unitSizeTry = Math.max(8, Math.round(valueSize * 0.42));
        const weightTry = fontWeightValue(config.valueWeight);

        if (metricsFitInColumns(ctx, metrics, columnWidth, valueSize, unitSizeTry, weightTry, config.fontFamily)) {
            break;
        }
        valueSize -= 1;
    }

    return { valueSize, unitSize: Math.max(8, Math.round(valueSize * 0.42)) };
}

function metricsFitInColumns(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    columnWidth: number,
    valueSize: number,
    unitSize: number,
    weight: number,
    fontFamily: string,
): boolean {
    for (const metric of metrics) {
        ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
        const valueWidth = ctx.measureText(getStableMetricValue(metric.label)).width;
        ctx.font = `300 ${unitSize}px ${fontFamily}`;
        const unitWidth = metric.unit ? ctx.measureText(metric.unit).width : 0;

        if (Math.max(valueWidth, unitWidth) > columnWidth * 0.82) {
            return false;
        }
    }
    return true;
}

interface ColumnRenderConfig {
    padding: number;
    columnWidth: number;
    centerX: number;
    baselineY: number;
    labelSize: number;
    valueSize: number;
    unitSize: number;
    fontFamily: string;
    valueWeight: string;
    textColor: string;
}

function renderMetricColumn(
    ctx: OverlayContext2D,
    metric: MetricItem,
    index: number,
    config: ColumnRenderConfig,
): void {
    const { padding, columnWidth, centerX, baselineY, labelSize, valueSize, unitSize, fontFamily, valueWeight, textColor } = config;
    const labelY = baselineY - valueSize - labelSize * 0.35;
    const valueY = baselineY;
    const unitY = baselineY + unitSize * 1.28;

    // Separator line (except first)
    if (index > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding + columnWidth * index, labelY - labelSize * 0.3);
        ctx.lineTo(padding + columnWidth * index, unitY + unitSize * 0.35);
        ctx.stroke();
    }

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `500 ${labelSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(metric.label.toUpperCase(), centerX, labelY);

    // Value
    const weight = fontWeightValue(valueWeight);
    ctx.fillStyle = textColor;
    ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(metric.value, centerX, valueY);

    // Unit
    if (metric.unit) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `300 ${unitSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(metric.unit, centerX, unitY);
    }
}
