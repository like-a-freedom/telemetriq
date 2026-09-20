import type { ExtendedOverlayConfig, MetricItem } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { getMarginLabel, getStableMetricValue } from '../overlayUtils';

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
    const shortSide = Math.min(w, h);
    const margin = shortSide * 0.045;
    const half = Math.ceil(metrics.length / 2);
    const slotHeight = h * 0.68 / half;
    const scale = Math.max(0.5, Math.min(2, (config.fontSizePercent || 2) / 2));
    const family = config.fontFamily;
    const weight = config.valueFontWeight === 'bold' ? 600 : 500;
    const labelSize = Math.min(Math.max(9, shortSide * 0.023 * scale), slotHeight * 0.1);
    const gap = shortSide * 0.015;
    const rail = labelSize + gap;
    const availableWidth = w * 0.43 - margin - rail;
    let valueSize = Math.min(shortSide * 0.085 * scale, slotHeight * 0.34);
    let widest = 1;
    for (const metric of metrics) {
        ctx.font = `${weight} ${valueSize}px ${family}`;
        widest = Math.max(widest, ctx.measureText(metric.value).width,
            ctx.measureText(getStableMetricValue(metric.label)).width);
    }
    const fit = Math.min(1, availableWidth / widest);
    valueSize *= fit;
    let unitSize = labelSize;
    ctx.font = `500 ${unitSize}px ${family}`;
    const unitWidth = Math.max(1, ...metrics.map(metric => ctx.measureText(metric.unit).width));
    unitSize *= Math.min(1, availableWidth / unitWidth);

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = config.textShadowColor || 'rgba(0,0,0,0.7)';
    ctx.lineWidth = Math.max(1.2, shortSide * 0.003);
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

        ctx.save();
        const label = getMarginLabel(metric.label);
        ctx.font = `600 ${labelSize}px ${family}`;
        const labelWidth = ctx.measureText(label).width;
        const fittedLabelSize = labelSize * Math.min(1, (slotHeight - gap) / Math.max(1, labelWidth));
        ctx.font = `600 ${fittedLabelSize}px ${family}`;
        ctx.translate(right ? w - margin : margin, y);
        ctx.rotate(right ? Math.PI / 2 : -Math.PI / 2);
        ctx.textAlign = right ? 'left' : 'right';
        ctx.textBaseline = 'top';
        if (config.textShadow) ctx.strokeText(label, 0, 0);
        ctx.fillText(label, 0, 0);
        ctx.restore();
    });
    ctx.restore();
}
