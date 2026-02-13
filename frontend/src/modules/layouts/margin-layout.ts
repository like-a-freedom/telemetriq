import type { MetricItem } from '../overlay-renderer';
import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlay-utils';
import {
    getResolutionTuning,
    fontWeightValue,
    applyTextShadow,
    getMarginLabel,
} from '../overlay-utils';

export function renderMarginLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);

    drawEdgeGradients(ctx, w, h, config.backgroundOpacity);

    const fontFamily = config.fontFamily || 'Inter, sans-serif';
    const baseFontSize = Math.round(h * (config.fontSizePercent || 2.0) / 100 * tuning.textScale);

    const half = Math.ceil(metrics.length / 2);
    const leftMetrics = metrics.slice(0, half);
    const rightMetrics = metrics.slice(half);

    const marginX = w * 0.045 * tuning.spacingScale;

    ctx.save();
    applyTextShadow(ctx, config);

    renderSideMetrics(ctx, leftMetrics, {
        side: 'left',
        marginX,
        startY: h * 0.18,
        containerHeight: h * 0.72,
        fontFamily,
        baseFontSize,
        tuning,
        valueWeight: config.valueFontWeight || 'light',
        valueMultiplier: config.valueSizeMultiplier || 3.5,
        textColor: config.textColor || '#FFFFFF',
    });

    renderSideMetrics(ctx, rightMetrics, {
        side: 'right',
        marginX,
        startY: h * 0.18,
        containerHeight: h * 0.72,
        fontFamily,
        baseFontSize,
        tuning,
        valueWeight: config.valueFontWeight || 'light',
        valueMultiplier: config.valueSizeMultiplier || 3.5,
        textColor: config.textColor || '#FFFFFF',
        containerWidth: w,
    });

    ctx.restore();
}

function drawEdgeGradients(
    ctx: OverlayContext2D,
    w: number,
    h: number,
    opacity: number,
): void {
    const leftGrad = ctx.createLinearGradient(0, 0, w * 0.15, 0);
    leftGrad.addColorStop(0, `rgba(0,0,0,${opacity * 0.7})`);
    leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, w * 0.15, h);

    const rightGrad = ctx.createLinearGradient(w, 0, w * 0.85, 0);
    rightGrad.addColorStop(0, `rgba(0,0,0,${opacity * 0.7})`);
    rightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(w * 0.85, 0, w * 0.15, h);
}

interface SideMetricsConfig {
    side: 'left' | 'right';
    marginX: number;
    startY: number;
    containerHeight: number;
    containerWidth?: number;
    fontFamily: string;
    baseFontSize: number;
    tuning: { textScale: number };
    valueWeight: string;
    valueMultiplier: number;
    textColor: string;
}

function renderSideMetrics(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    config: SideMetricsConfig,
): void {
    if (metrics.length === 0) return;

    const { side, marginX, startY, containerHeight, containerWidth, fontFamily, baseFontSize, tuning, valueWeight, valueMultiplier, textColor } = config;

    const slotCount = metrics.length;
    const slotHeight = containerHeight / slotCount;

    for (let i = 0; i < metrics.length; i++) {
        const metric = metrics[i]!;
        const metricY = startY + i * slotHeight;

        const valueSize = calculateValueSize(baseFontSize, valueMultiplier, tuning.textScale, slotHeight);
        const labelSize = Math.max(8, Math.round(valueSize * 0.2 * tuning.textScale));
        const unitSize = Math.max(8, Math.round(valueSize * 0.22 * tuning.textScale));

        if (side === 'left') {
            renderLeftMetric(ctx, metric, {
                marginX, metricY, valueSize, labelSize, unitSize,
                fontFamily, valueWeight, textColor,
            });
        } else {
            renderRightMetric(ctx, metric, {
                marginX: (containerWidth || 0) - marginX, metricY, valueSize, unitSize,
                fontFamily, valueWeight, textColor,
            });
        }
    }
}

function calculateValueSize(
    baseFontSize: number,
    valueMultiplier: number,
    textScale: number,
    slotHeight: number,
): number {
    return Math.max(14, Math.min(
        Math.round(baseFontSize * valueMultiplier * textScale),
        Math.round(slotHeight * 0.42),
    ));
}

interface LeftMetricConfig {
    marginX: number;
    metricY: number;
    valueSize: number;
    labelSize: number;
    unitSize: number;
    fontFamily: string;
    valueWeight: string;
    textColor: string;
}

function renderLeftMetric(
    ctx: OverlayContext2D,
    metric: MetricItem,
    config: LeftMetricConfig,
): void {
    const { marginX, metricY, valueSize, labelSize, unitSize, fontFamily, valueWeight, textColor } = config;

    // Value - positioned with more space from left edge to avoid label overlap
    const valueX = marginX + labelSize * 1.5;
    const weight = fontWeightValue(valueWeight);
    ctx.fillStyle = textColor;
    ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(metric.value, valueX, metricY + valueSize);

    // Unit below value
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `300 ${unitSize}px ${fontFamily}`;
    ctx.fillText(metric.unit.toUpperCase(), valueX, metricY + valueSize + unitSize * 1.5);

    // Vertical label (rotated) - positioned to the left of the value
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `300 ${labelSize}px ${fontFamily}`;
    ctx.translate(marginX + labelSize * 0.8, metricY + valueSize * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(getMarginLabel(metric.label), 0, 0);
    ctx.restore();
}

interface RightMetricConfig {
    marginX: number;
    metricY: number;
    valueSize: number;
    unitSize: number;
    fontFamily: string;
    valueWeight: string;
    textColor: string;
}

function renderRightMetric(
    ctx: OverlayContext2D,
    metric: MetricItem,
    config: RightMetricConfig,
): void {
    const { marginX, metricY, valueSize, unitSize, fontFamily, valueWeight, textColor } = config;

    // Value
    const weight = fontWeightValue(valueWeight);
    ctx.fillStyle = textColor;
    ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(metric.value, marginX, metricY + valueSize);

    // Unit below value
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `300 ${unitSize}px ${fontFamily}`;
    ctx.textAlign = 'right';
    ctx.fillText(metric.unit.toUpperCase(), marginX, metricY + valueSize + unitSize * 1.5);
}
