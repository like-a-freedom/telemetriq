import type { ExtendedOverlayConfig, MetricItem } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    clamp,
    drawTrackedText,
    fontWeightValue,
    getStableMetricValue,
    measureTrackedTextWidth,
} from '../overlayUtils';

/** A bottom strip with balanced rows for dense portrait configurations. */
export function renderHorizonLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
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
    const padding = shortSide * 0.045;
    const rows = w <= h ? Math.ceil(metrics.length / 3) : Math.ceil(metrics.length / 6);
    const columns = Math.ceil(metrics.length / rows);
    const columnWidth = (w - padding * 2) / columns;
    const availableWidth = columnWidth * 0.84;
    const fontFamily = config.fontFamily;
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelWeight = 600;
    const unitWeight = 500;
    const labelsVisible = config.labelStyle !== 'hidden';
    const sizeScale = clamp((config.fontSizePercent || 2.4) / 2.4, 0.5, 2);
    const valueScale = clamp(config.valueSizeMultiplier / 2.5, 0.5, 2);
    const labelScale = clamp(config.labelSizeMultiplier / 0.52, 0.5, 1.5);
    const labelTracking = clamp(config.labelLetterSpacing, 0, 0.2);
    const lineSpacing = clamp(config.lineSpacing, 0.8, 1.8);
    let valueSize = Math.min(shortSide * 0.065 * sizeScale * valueScale, h * 0.13 / rows);
    let labelSize = labelsVisible ? Math.max(10, shortSide * 0.027 * sizeScale * labelScale) : 0;
    let unitSize = Math.max(9, labelSize * 0.84);

    // Reserve stable widths, but also measure actual long values and every label.
    let valueWidth = 0;
    let labelWidth = 0;
    let unitWidth = 0;
    for (const metric of metrics) {
        ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
        valueWidth = Math.max(valueWidth, ctx.measureText(metric.value).width,
            ctx.measureText(getStableMetricValue(metric.label)).width);
        if (labelsVisible) {
            ctx.font = `${labelWeight} ${labelSize}px ${fontFamily}`;
            labelWidth = Math.max(labelWidth, measureTrackedTextWidth(
                ctx,
                metric.label.toUpperCase(),
                labelTracking,
                labelSize,
            ));
        }
        ctx.font = `${unitWeight} ${unitSize}px ${fontFamily}`;
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
    const backgroundTop = Math.max(0, top - shortSide * 0.16);

    ctx.globalAlpha = Math.max(0, Math.min(1, config.backgroundOpacity));
    if (config.gradientBackground !== false) {
        const gradient = ctx.createLinearGradient(0, backgroundTop, 0, h);
        gradient.addColorStop(0, config.gradientStartColor || 'rgba(0,0,0,0)');
        gradient.addColorStop(0.5, config.gradientEndColor || 'rgba(0,0,0,0.9)');
        gradient.addColorStop(1, config.gradientEndColor || 'rgba(0,0,0,0.9)');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = config.backgroundColor || '#000000';
    }
    ctx.fillRect(0, backgroundTop, w, h - backgroundTop);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let row = 0; row < rows; row++) {
        const rowMetrics = metrics.slice(row * columns, (row + 1) * columns);
        const rowLeft = (w - rowMetrics.length * columnWidth) / 2;
        const y = top + row * (contentHeight + rowGap);
        for (let column = 0; column < rowMetrics.length; column++) {
            const metric = rowMetrics[column]!;
            const x = rowLeft + columnWidth * (column + 0.5);
            if (column > 0) {
                ctx.save();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = config.textColor;
                ctx.globalAlpha = 0.18;
                ctx.lineWidth = Math.max(1, shortSide / 1080);
                ctx.beginPath();
                ctx.moveTo(rowLeft + columnWidth * column, y);
                ctx.lineTo(rowLeft + columnWidth * column, y + contentHeight);
                ctx.stroke();
                ctx.restore();
            }
            ctx.fillStyle = config.textColor;
            if (labelsVisible) {
                const label = metric.label.toUpperCase();
                ctx.font = `${labelWeight} ${labelSize}px ${fontFamily}`;
                const labelWidthAtSize = measureTrackedTextWidth(ctx, label, labelTracking, labelSize);
                ctx.textAlign = 'left';
                drawTrackedText(ctx, label, x - labelWidthAtSize / 2, y, labelTracking, labelSize);
                ctx.textAlign = 'center';
            }
            ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
            ctx.fillText(metric.value, x, y + labelSize + labelGap);
            if (metric.unit) {
                ctx.font = `${unitWeight} ${unitSize}px ${fontFamily}`;
                ctx.fillText(metric.unit, x, y + labelSize + labelGap + valueSize + gap);
            }
        }
    }
    ctx.restore();
}
