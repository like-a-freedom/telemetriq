import type { MetricItem } from '../overlayRenderer';
import type { TelemetryFrame, ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    getResolutionTuning,
    fontWeightValue,
    applyTextShadow,
    getStableMetricValue,
} from '../overlayUtils';

export function renderLFrameLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    _frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);

    drawBottomGradient(ctx, w, h);

    const fontFamily = config.fontFamily || 'Inter, sans-serif';
    const baseFontSize = Math.round(h * (config.fontSizePercent || 2.0) / 100 * tuning.textScale);
    const valueSizeBase = Math.round(baseFontSize * (config.valueSizeMultiplier || 3.0));

    const margin = w * 0.04 * tuning.spacingScale;
    const bottomMargin = h * 0.05;

    ctx.save();
    applyTextShadow(ctx, config);

    const metricsAreaWidth = w * 0.84 - margin * 0.9;
    const metricGap = metricsAreaWidth / Math.max(1, metrics.length);
    const renderedBlockWidth = metricGap * metrics.length;
    const metricsStartX = Math.max(margin, (w - renderedBlockWidth) / 2);
    const metricsY = h - bottomMargin - margin * 0.3;

    const { valueSize, labelSize, unitSize } = calculateOptimalFontSizes(ctx, metrics, metricGap, {
        valueSizeBase,
        h,
        fontFamily,
        valueWeight: config.valueFontWeight || 'light',
    });

    for (let i = 0; i < metrics.length; i++) {
        renderMetric(ctx, metrics[i]!, i, {
            metricsStartX,
            metricGap,
            metricsY,
            valueSize,
            labelSize,
            unitSize,
            fontFamily,
            valueWeight: config.valueFontWeight || 'light',
            textColor: config.textColor || '#FFFFFF',
        });
    }

    drawProgressBar(ctx, w, h);
    ctx.restore();
}

function drawBottomGradient(ctx: OverlayContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, h * 0.7, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
}



interface FontCalcConfig {
    valueSizeBase: number;
    h: number;
    fontFamily: string;
    valueWeight: string;
}

function calculateOptimalFontSizes(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    metricGap: number,
    config: FontCalcConfig,
): { valueSize: number; labelSize: number; unitSize: number } {
    let valueSize = Math.max(12, Math.min(
        config.valueSizeBase,
        Math.round(config.h * 0.09),
        Math.round(metricGap * 0.4),
    ));
    const minValueSize = Math.max(10, Math.round(config.h * 0.035));

    while (valueSize > minValueSize) {
        const labelSizeTry = Math.max(8, Math.round(valueSize * 0.2));
        const unitSizeTry = Math.max(8, Math.round(valueSize * 0.28));
        const weightTry = fontWeightValue(config.valueWeight);

        if (metricsFit(ctx, metrics, metricGap, valueSize, labelSizeTry, unitSizeTry, weightTry, config)) {
            break;
        }
        valueSize -= 1;
    }

    return {
        valueSize,
        labelSize: Math.max(8, Math.round(valueSize * 0.2)),
        unitSize: Math.max(8, Math.round(valueSize * 0.28)),
    };
}

function metricsFit(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    metricGap: number,
    valueSize: number,
    labelSize: number,
    unitSize: number,
    weight: number,
    config: FontCalcConfig,
): boolean {
    for (const metric of metrics) {
        ctx.font = `${weight} ${valueSize}px ${config.fontFamily}`;
        const valueWidth = ctx.measureText(getStableMetricValue(metric.label)).width;
        ctx.font = `300 ${unitSize}px ${config.fontFamily}`;
        const unitWidth = metric.unit ? ctx.measureText(metric.unit).width : 0;
        ctx.font = `300 ${labelSize}px ${config.fontFamily}`;
        const labelWidth = ctx.measureText(metric.label.toUpperCase()).width;

        if (Math.max(valueWidth, unitWidth, labelWidth) > metricGap * 0.84) {
            return false;
        }
    }
    return true;
}

interface MetricRenderConfig {
    metricsStartX: number;
    metricGap: number;
    metricsY: number;
    valueSize: number;
    labelSize: number;
    unitSize: number;
    fontFamily: string;
    valueWeight: string;
    textColor: string;
}

function renderMetric(
    ctx: OverlayContext2D,
    metric: MetricItem,
    index: number,
    config: MetricRenderConfig,
): void {
    const { metricsStartX, metricGap, metricsY, valueSize, labelSize, unitSize, fontFamily, valueWeight, textColor } = config;
    const mx = metricsStartX + index * metricGap + metricGap / 2;

    // Label - using regular fillText without letter spacing to avoid kerning issues
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `300 ${labelSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(metric.label.toUpperCase(), mx, metricsY - valueSize - labelSize * 0.2);

    // Value
    const weight = fontWeightValue(valueWeight);
    ctx.fillStyle = textColor;
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

function drawProgressBar(ctx: OverlayContext2D, w: number, h: number): void {
    const barH = Math.max(1, h * 0.002);
    ctx.fillStyle = 'rgba(128,128,128,0.3)';
    ctx.fillRect(0, h - barH * 2, w, barH * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(0, h - barH * 2, w * 0.33, barH * 2);
}
