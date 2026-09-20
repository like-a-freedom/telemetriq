import type { ExtendedOverlayConfig } from '../../core/types';
import { fontWeightValue, getStableMetricValue } from '../overlayUtils';
import type { OverlayContext2D } from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type Orientation } from './shared';

export function drawHeroNumber(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const shortSide = orientation.shortSide;
    const family = config.fontFamily || 'sans-serif';
    const accent = config.accentColor || '#00E676';
    const textColor = config.textColor || '#FFFFFF';
    const outlineWidth = Math.max(1.2, shortSide * 0.003);
    const fontScale = Math.max(0.7, Math.min(1.4, (config.fontSizePercent || 2.3) / 2.3));
    const valueScale = Math.max(0.75, Math.min(1.3, (config.valueSizeMultiplier || 2.8) / 2.8));
    const labelScale = Math.max(0.75, Math.min(1.3, (config.labelSizeMultiplier || 0.5) / 0.5));
    const lineSpacing = Math.max(0.9, Math.min(1.4, config.lineSpacing || 1.1));
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const safeWidth = Math.max(1, w - orientation.safePad * 2);

    const secondary = toStandardMetricItems(
        data,
        {
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DIST', unit: 'km' },
            time: { label: 'ELAPSED' },
        },
        ['heartRate', 'distance', 'time'],
    );
    const columnWidth = secondary.length ? safeWidth / secondary.length : safeWidth;
    const maxColumnTextWidth = Math.max(1, columnWidth * 0.84);
    const labelBaseSize = Math.max(9, Math.round(shortSide * 0.025 * tuning.textScale * fontScale * labelScale));
    const unitBaseSize = Math.max(8, Math.round(shortSide * 0.02 * tuning.textScale * fontScale * labelScale));
    const valueBaseSize = Math.max(12, Math.round(shortSide * 0.068 * tuning.textScale * fontScale * valueScale));

    const labelSize = fitCommonTextSize(ctx, secondary.map((item) => item.label), family,
        labelBaseSize, maxColumnTextWidth, 600);
    const secondaryValueSize = fitCommonValueSize(ctx, secondary, family,
        valueBaseSize, maxColumnTextWidth, valueWeight);
    const unitSize = fitCommonTextSize(ctx, secondary.map((item) => item.unit ?? '').filter(Boolean),
        family, unitBaseSize, maxColumnTextWidth, 500);
    const labelValueGap = Math.max(3, Math.round(labelSize * 0.38 * lineSpacing));
    const valueUnitGap = Math.max(2, Math.round(unitSize * 0.28 * lineSpacing));
    const secondaryHeight = secondary.length
        ? labelSize + labelValueGap + secondaryValueSize + valueUnitGap + unitSize
        : 0;
    const secondaryTop = h - orientation.safePad - secondaryHeight;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    if (data.pace) {
        const paceTop = Math.max(orientation.safePad, Math.round(h * (orientation.isPortrait ? 0.25 : 0.22)));
        const paceBaseSize = Math.max(14, Math.round(shortSide * (orientation.isPortrait ? 0.23 : 0.18)
            * tuning.textScale * fontScale * valueScale));
        ctx.font = `${valueWeight} ${paceBaseSize}px ${family}`;
        const paceTextWidth = Math.max(
            ctx.measureText(data.pace).width,
            ctx.measureText(getStableMetricValue('pace')).width,
        );
        const paceMaxWidth = safeWidth * 0.94;
        const lineHeightRatio = 1 + 0.1 + 0.16 * labelScale;
        const freeHeight = Math.max(1, secondaryTop - paceTop - shortSide * 0.03);
        const paceSize = Math.max(12, Math.min(
            paceBaseSize * Math.min(1, paceMaxWidth / Math.max(1, paceTextWidth)),
            freeHeight / lineHeightRatio,
        ));
        const paceLabelSize = Math.max(8, Math.round(paceSize * 0.16 * labelScale));
        const paceGap = Math.max(4, Math.round(paceSize * 0.1 * lineSpacing));

        drawHeroText(ctx, data.pace, w * 0.5, paceTop,
            `${valueWeight} ${paceSize}px ${family}`, textColor, 1, outlineWidth, config);
        drawHeroText(ctx, 'MIN / KM', w * 0.5, paceTop + paceSize + paceGap,
            `600 ${paceLabelSize}px ${family}`, textColor, 0.78, outlineWidth, config);
    }

    if (secondary.length) {
        secondary.forEach((item, index) => {
            const x = orientation.safePad + columnWidth * (index + 0.5);
            drawHeroText(ctx, item.label.toUpperCase(), x, secondaryTop,
                `600 ${labelSize}px ${family}`, accent, 1, outlineWidth, config);
            drawHeroText(ctx, item.value, x, secondaryTop + labelSize + labelValueGap,
                `${valueWeight} ${secondaryValueSize}px ${family}`, textColor, 1, outlineWidth, config);
            if (item.unit) {
                drawHeroText(ctx, item.unit, x,
                    secondaryTop + labelSize + labelValueGap + secondaryValueSize + valueUnitGap,
                    `500 ${unitSize}px ${family}`, textColor, 0.72, outlineWidth, config);
            }
        });
    }

    ctx.restore();
}

function fitCommonTextSize(
    ctx: OverlayContext2D,
    texts: string[],
    family: string,
    size: number,
    maxWidth: number,
    weight: number,
): number {
    if (texts.length === 0) return size;
    ctx.font = `${weight} ${size}px ${family}`;
    const width = Math.max(...texts.map((text) => ctx.measureText(text).width));
    return size * Math.min(1, maxWidth / Math.max(1, width));
}

function fitCommonValueSize(
    ctx: OverlayContext2D,
    items: ReturnType<typeof toStandardMetricItems>,
    family: string,
    size: number,
    maxWidth: number,
    weight: number,
): number {
    if (items.length === 0) return size;
    ctx.font = `${weight} ${size}px ${family}`;
    const width = Math.max(...items.flatMap((item) => [
        ctx.measureText(item.value).width,
        ctx.measureText(getStableMetricValue(item.key)).width,
    ]));
    return size * Math.min(1, maxWidth / Math.max(1, width));
}

function drawHeroText(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    opacity: number,
    outlineWidth: number,
    config: ExtendedOverlayConfig,
): void {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.strokeStyle = config.textShadowColor || 'rgba(0,0,0,0.7)';
    ctx.lineWidth = outlineWidth;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;
    if (config.textShadow) ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
}
