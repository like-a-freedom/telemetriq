import type { ExtendedOverlayConfig, MetricItem } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    clamp,
    getMarginLabel,
    getStableMetricValue,
    measureTrackedTextWidth,
} from '../overlayUtils';

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

export function renderMarginLayout(
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
    const margin = shortSide * 0.045;
    const half = Math.ceil(metrics.length / 2);
    const slotHeight = h * 0.68 / half;
    const sizeScale = clamp((config.fontSizePercent || 2) / 2, 0.5, 2);
    const valueScale = clamp(config.valueSizeMultiplier / 3.5, 0.5, 2);
    const labelScale = clamp(config.labelSizeMultiplier / 0.5, 0.5, 1.5);
    const labelTracking = clamp(config.labelLetterSpacing, 0, 0.2);
    const lineSpacing = clamp(config.lineSpacing, 0.8, 1.8);
    const family = config.fontFamily;
    const weight = config.valueFontWeight === 'bold' ? 600 : 500;
    const labelsVisible = config.labelStyle !== 'hidden';
    const labelSize = labelsVisible
        ? Math.min(Math.max(10, shortSide * 0.028 * sizeScale * labelScale), slotHeight * 0.16)
        : 0;
    let unitSize = Math.max(8, labelSize * 0.9);
    const gap = Math.max(2, shortSide * 0.015 * lineSpacing);
    const rail = labelsVisible ? labelSize + gap : 0;
    const availableWidth = Math.max(0, w * 0.43 - margin - rail);
    let valueSize = Math.min(shortSide * 0.085 * sizeScale * valueScale, slotHeight * 0.34);
    let widest = 1;
    for (const metric of metrics) {
        ctx.font = `${weight} ${valueSize}px ${family}`;
        widest = Math.max(widest, ctx.measureText(metric.value).width,
            ctx.measureText(getStableMetricValue(metric.label)).width);
    }
    const fit = Math.min(1, availableWidth / widest);
    valueSize *= fit;
    ctx.font = `500 ${unitSize}px ${family}`;
    const unitWidth = Math.max(1, ...metrics.map(metric => ctx.measureText(metric.unit).width));
    unitSize *= Math.min(1, availableWidth / unitWidth);

    ctx.globalAlpha = 1;
    ctx.strokeStyle = config.textShadowColor || 'rgba(0,0,0,0.7)';
    ctx.lineWidth = Math.max(0.8, shortSide * 0.0013);
    ctx.lineJoin = 'round';
    ctx.fillStyle = config.textColor;

    metrics.forEach((metric, index) => {
        const right = index >= half;
        const slot = right ? index - half : index;
        const y = h * 0.16 + slot * slotHeight;
        const x = right ? w - margin - rail : margin + rail;
        ctx.textAlign = right ? 'right' : 'left';
        ctx.textBaseline = 'top';
        ctx.font = `${weight} ${valueSize}px ${family}`;
        if (config.textShadow) ctx.strokeText(metric.value, x, y);
        ctx.fillText(metric.value, x, y);
        if (metric.unit) {
            ctx.font = `500 ${unitSize}px ${family}`;
            if (config.textShadow) ctx.strokeText(metric.unit, x, y + valueSize + gap);
            ctx.fillText(metric.unit, x, y + valueSize + gap);
        }

        if (labelsVisible) {
            ctx.save();
            const label = getMarginLabel(metric.label);
            ctx.font = `600 ${labelSize}px ${family}`;
            const labelWidth = measureTrackedTextWidth(ctx, label, labelTracking, labelSize);
            const fittedLabelSize = labelSize * Math.min(1, Math.max(0, slotHeight - gap) / Math.max(1, labelWidth));
            ctx.font = `600 ${fittedLabelSize}px ${family}`;
            const fittedLabelWidth = measureTrackedTextWidth(ctx, label, labelTracking, fittedLabelSize);
            ctx.translate(right ? w - margin : margin, y);
            ctx.rotate(right ? Math.PI / 2 : -Math.PI / 2);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            drawTrackedLabel(
                ctx,
                label,
                right ? 0 : -fittedLabelWidth,
                0,
                labelTracking,
                fittedLabelSize,
                config.textShadow,
            );
            ctx.restore();
        }
    });
    ctx.restore();
}
