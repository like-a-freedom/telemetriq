import type { ExtendedOverlayConfig, MetricItem, TelemetryFrame } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { clamp, getStableMetricValue, measureTrackedTextWidth } from '../overlayUtils';

function drawTrackedLabel(
    ctx: OverlayContext2D,
    label: string,
    x: number,
    y: number,
    tracking: number,
    fontSize: number,
    outline: boolean,
): void {
    const spacing = fontSize * tracking;
    let cursorX = x;
    for (const character of label) {
        if (outline) ctx.strokeText(character, cursorX, y);
        ctx.fillText(character, cursorX, y);
        cursorX += ctx.measureText(character).width + spacing;
    }
}

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
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const shortSide = Math.min(w, h);
    const padding = shortSide * 0.065;
    const rows = w <= h ? Math.ceil(metrics.length / 3) : Math.ceil(metrics.length / 6);
    const columns = Math.ceil(metrics.length / rows);
    const columnWidth = (w - padding * 2) / columns;
    const availableWidth = columnWidth * 0.84;
    const fontFamily = config.fontFamily;
    const weight = config.valueFontWeight === 'bold' ? 600 : 500;
    const labelsVisible = config.labelStyle !== 'hidden';
    const sizeScale = clamp((config.fontSizePercent || 2) / 2, 0.5, 2);
    const valueScale = clamp(config.valueSizeMultiplier / 3, 0.5, 2);
    const labelScale = clamp(config.labelSizeMultiplier / 0.52, 0.5, 1.5);
    const labelTracking = clamp(config.labelLetterSpacing, 0, 0.2);
    const lineSpacing = clamp(config.lineSpacing, 0.8, 1.8);
    let valueSize = Math.min(shortSide * 0.065 * sizeScale * valueScale, h * 0.13 / rows);
    let labelSize = labelsVisible ? Math.max(10, shortSide * 0.028 * sizeScale * labelScale) : 0;
    let unitSize = Math.max(8, labelSize * 0.84);

    // Reserve stable widths, but also measure actual long values and every label.
    let valueWidth = 0;
    let labelWidth = 0;
    let unitWidth = 0;
    for (const metric of metrics) {
        ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
        valueWidth = Math.max(valueWidth, ctx.measureText(metric.value).width,
            ctx.measureText(getStableMetricValue(metric.label)).width);
        if (labelsVisible) {
            ctx.font = `600 ${labelSize}px ${fontFamily}`;
            labelWidth = Math.max(labelWidth, measureTrackedTextWidth(
                ctx,
                metric.label.toUpperCase(),
                labelTracking,
                labelSize,
            ));
        }
        ctx.font = `500 ${unitSize}px ${fontFamily}`;
        unitWidth = Math.max(unitWidth, ctx.measureText(metric.unit).width);
    }
    valueSize *= Math.min(1, availableWidth / Math.max(1, valueWidth));
    if (labelsVisible) labelSize *= Math.min(1, availableWidth / Math.max(1, labelWidth));
    unitSize *= Math.min(1, availableWidth / Math.max(1, unitWidth));

    const gap = Math.max(2, shortSide * 0.012 * lineSpacing);
    const labelGap = labelsVisible ? gap : 0;
    const rowGap = shortSide * 0.035 * lineSpacing;
    const contentHeight = labelSize + valueSize + unitSize + labelGap + gap;
    const totalHeight = rows * contentHeight + (rows - 1) * rowGap;
    const top = h - padding - totalHeight;
    ctx.strokeStyle = config.textShadowColor || 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(0.8, shortSide * 0.0013);
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
            if (labelsVisible) {
                const label = metric.label.toUpperCase();
                ctx.font = `600 ${labelSize}px ${fontFamily}`;
                const labelWidthAtSize = measureTrackedTextWidth(ctx, label, labelTracking, labelSize);
                ctx.textAlign = 'left';
                drawTrackedLabel(
                    ctx,
                    label,
                    x - labelWidthAtSize / 2,
                    y,
                    labelTracking,
                    labelSize,
                    config.textShadow,
                );
                ctx.textAlign = 'center';
            }
            ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
            if (config.textShadow) ctx.strokeText(metric.value, x, y + labelSize + labelGap);
            ctx.fillText(metric.value, x, y + labelSize + labelGap);
            if (metric.unit) {
                ctx.font = `500 ${unitSize}px ${fontFamily}`;
                if (config.textShadow) ctx.strokeText(metric.unit, x, y + labelSize + labelGap + valueSize + gap);
                ctx.fillText(metric.unit, x, y + labelSize + labelGap + valueSize + gap);
            }
        }
    }
    const inset = padding * 0.45;
    ctx.beginPath();
    ctx.moveTo(inset, top - gap);
    ctx.lineTo(inset, h - inset);
    ctx.lineTo(w - inset, h - inset);
    ctx.strokeStyle = config.accentColor || config.textColor;
    ctx.lineWidth = Math.max(0.7, shortSide * 0.001);
    ctx.stroke();
    ctx.restore();
}
