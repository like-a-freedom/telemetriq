import type { ExtendedOverlayConfig, MetricItem, TelemetryFrame } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { getStableMetricValue } from '../overlayUtils';

/** A transparent corner frame with measured, responsive metric rows. */
export function renderLFrameLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    _frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    if (!metrics.length || w <= 0 || h <= 0) return;

    ctx.save();
    ctx.letterSpacing = '0px';
    const shortSide = Math.min(w, h);
    const padding = shortSide * 0.065;
    const rows = w <= h ? Math.ceil(metrics.length / 3) : Math.ceil(metrics.length / 6);
    const columns = Math.ceil(metrics.length / rows);
    const columnWidth = (w - padding * 2) / columns;
    const availableWidth = columnWidth * 0.84;
    const fontFamily = config.fontFamily;
    const weight = config.valueFontWeight === 'bold' ? 600 : 500;
    const scale = Math.max(0.5, Math.min(2, (config.fontSizePercent || 2.4) / 2));
    let valueSize = Math.min(shortSide * 0.065 * scale, h * 0.13 / rows);
    let labelSize = Math.max(9, shortSide * 0.023 * scale);
    let unitSize = labelSize;

    // Reserve stable widths, but also measure actual long values and every label.
    let valueWidth = 0;
    let labelWidth = 0;
    let unitWidth = 0;
    for (const metric of metrics) {
        ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
        valueWidth = Math.max(valueWidth, ctx.measureText(metric.value).width,
            ctx.measureText(getStableMetricValue(metric.label)).width);
        ctx.font = `600 ${labelSize}px ${fontFamily}`;
        labelWidth = Math.max(labelWidth, ctx.measureText(metric.label.toUpperCase()).width);
        ctx.font = `500 ${unitSize}px ${fontFamily}`;
        unitWidth = Math.max(unitWidth, ctx.measureText(metric.unit).width);
    }
    valueSize *= Math.min(1, availableWidth / Math.max(1, valueWidth));
    labelSize *= Math.min(1, availableWidth / Math.max(1, labelWidth));
    unitSize *= Math.min(1, availableWidth / Math.max(1, unitWidth));

    const gap = shortSide * 0.012;
    const rowGap = shortSide * 0.035;
    const contentHeight = labelSize + valueSize + unitSize + gap * 2;
    const totalHeight = rows * contentHeight + (rows - 1) * rowGap;
    const top = h - padding - totalHeight;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = config.textShadowColor || 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(1.2, shortSide * 0.003);
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let row = 0; row < rows; row++) {
        const rowMetrics = metrics.slice(row * columns, (row + 1) * columns);
        const rowLeft = (w - rowMetrics.length * columnWidth) / 2;
        const y = top + row * (contentHeight + rowGap);
        for (let column = 0; column < rowMetrics.length; column++) {
            const metric = rowMetrics[column]!;
            const x = rowLeft + columnWidth * (column + 0.5);
            ctx.fillStyle = config.textColor;
            ctx.font = `600 ${labelSize}px ${fontFamily}`;
            if (config.textShadow) ctx.strokeText(metric.label.toUpperCase(), x, y);
            ctx.fillText(metric.label.toUpperCase(), x, y);
            ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
            if (config.textShadow) ctx.strokeText(metric.value, x, y + labelSize + gap);
            ctx.fillText(metric.value, x, y + labelSize + gap);
            if (metric.unit) {
                ctx.font = `500 ${unitSize}px ${fontFamily}`;
                if (config.textShadow) ctx.strokeText(metric.unit, x, y + labelSize + valueSize + gap * 2);
                ctx.fillText(metric.unit, x, y + labelSize + valueSize + gap * 2);
            }
        }
    }
    const inset = padding * 0.45;
    ctx.beginPath();
    ctx.moveTo(inset, top - gap);
    ctx.lineTo(inset, h - inset);
    ctx.lineTo(w - inset, h - inset);
    if (config.textShadow) ctx.stroke();
    ctx.strokeStyle = config.accentColor || config.textColor;
    ctx.lineWidth = Math.max(0.7, shortSide * 0.001);
    ctx.stroke();
    ctx.restore();
}
