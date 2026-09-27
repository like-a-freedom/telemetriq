import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { clamp, fontWeightValue, getStableMetricValue, measureTrackedTextWidth } from '../overlayUtils';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';
import { toStandardMetricItems, type MetricItemSpec, type MetricMap, type Orientation } from './shared';

const STABLE_KEY: Record<MetricItemSpec['key'], string> = {
    pace: 'pace',
    heartRate: 'heart rate',
    distance: 'distance',
    time: 'time',
    power: 'power',
};

function finiteSetting(value: number | undefined, fallback: number, min: number, max: number): number {
    return Number.isFinite(value) ? clamp(value!, min, max) : fallback;
}

function measureText(
    ctx: OverlayContext2D,
    text: string,
    family: string,
    size: number,
    weight: number,
    tracking = 0,
): number {
    if (!text) return 0;
    ctx.font = `${weight} ${size}px ${family}`;
    return measureTrackedTextWidth(ctx, text, tracking, size);
}

function drawTrackedLabel(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    trackingEm: number,
    fontSize: number,
    outline: boolean,
): void {
    let cursorX = x;
    const spacing = fontSize * trackingEm;
    for (const char of text) {
        if (outline) ctx.strokeText(char, cursorX, y);
        ctx.fillText(char, cursorX, y);
        cursorX += ctx.measureText(char).width + spacing;
    }
}

export function drawThinLine(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 40) return;

    const items = toStandardMetricItems(
        data,
        {
            pace: { label: 'PACE', unit: 'min/km' },
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DIST', unit: 'km' },
            time: { label: 'TIME', unit: '' },
        },
        ['pace', 'heartRate', 'distance', 'time'],
    );
    if (items.length === 0) return;

    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.12, h * 0.12));
    const availableWidth = Math.max(0, w - safePad * 2);
    const cellWidth = availableWidth / items.length;
    const horizontalInset = Math.min(cellWidth * 0.12, Math.max(3, orientation.shortSide * 0.015));
    const textWidth = Math.max(0, cellWidth - horizontalInset * 2);
    if (textWidth <= 0) return;

    const maxRowHeight = Math.min(h * 0.34, orientation.shortSide * 0.32);
    const maxValueSize = Math.min(64, maxRowHeight * 0.58);
    if (maxValueSize < 7) return;

    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const valueWeight = fontWeightValue(config.valueFontWeight || 'semibold');
    const labelWeight = 500;
    const unitWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.52, 0.25, 1.2);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.06, 0, 0.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.8, 1.8);
    const configuredSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1, 0.5, 4)
        * Math.max(0.5, tuning.textScale)
        / 100;
    const minValueSize = Math.min(12, maxValueSize);
    const startValueSize = Math.min(maxValueSize, Math.max(minValueSize, Math.round(configuredSize)));
    const lineY = h - safePad;

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        labelGap: number;
        unitGap: number;
        inlineGap: number;
        inlineUnits: boolean;
        contentHeight: number;
        baselineGap: number;
    } | undefined;

    for (let valueSize = Math.floor(startValueSize); valueSize >= 7; valueSize -= 1) {
        const labelSize = labelVisible ? Math.max(7, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(8, Math.round(valueSize * labelMultiplier * 0.9));
        const labelGap = labelVisible ? Math.max(1, Math.round(valueSize * (lineSpacing - 0.9) * 0.18)) : 0;
        const unitGap = Math.max(1, Math.round(valueSize * (lineSpacing - 0.8) * 0.14));
        const inlineGap = Math.max(3, Math.round(valueSize * 0.24));
        const fittedWidths = items.map((item) => {
            const stableValue = getStableMetricValue(STABLE_KEY[item.key]);
            const valueWidth = Math.max(
                measureText(ctx, item.value, fontFamily, valueSize, valueWeight),
                measureText(ctx, stableValue, fontFamily, valueSize, valueWeight),
            );
            const labelWidth = measureText(ctx, item.label, fontFamily, labelSize, labelWeight, labelTracking);
            const unitWidth = measureText(ctx, item.unit ?? '', fontFamily, unitSize, unitWeight);
            return { valueWidth, labelWidth, unitWidth };
        });
        if (fittedWidths.some(({ valueWidth, labelWidth, unitWidth }) =>
            valueWidth > textWidth || (labelVisible && labelWidth > textWidth) || unitWidth > textWidth,
        )) continue;

        const inlineUnits = items.every((item, index) =>
            !item.unit || fittedWidths[index]!.valueWidth + inlineGap + fittedWidths[index]!.unitWidth <= textWidth,
        );
        const contentHeight = (labelVisible ? labelSize + labelGap : 0)
            + valueSize
            + (inlineUnits ? 0 : items.some((item) => item.unit) ? unitGap + unitSize : 0);
        const baselineGap = Math.max(3, Math.round(valueSize * 0.22));
        const top = lineY - baselineGap - contentHeight;
        if (contentHeight > maxRowHeight || top < safePad) continue;

        selected = {
            valueSize,
            labelSize,
            unitSize,
            labelGap,
            unitGap,
            inlineGap,
            inlineUnits,
            contentHeight,
            baselineGap,
        };
        break;
    }
    if (!selected) return;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = config.accentColor || '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.moveTo(safePad, lineY);
    ctx.lineTo(w - safePad, lineY);
    ctx.stroke();

    if (items.length > 1) {
        ctx.globalAlpha = 0.72;
        for (let index = 1; index < items.length; index += 1) {
            const tickX = safePad + cellWidth * index;
            ctx.beginPath();
            ctx.moveTo(tickX, lineY - 3);
            ctx.lineTo(tickX, lineY + 3);
            ctx.stroke();
        }
    }
    ctx.restore();

    const textColor = config.textColor || '#ffffff';
    const labelColor = config.accentColor || textColor;
    const outlined = Boolean(config.textShadow && config.textShadowColor);
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    if (config.textShadow && config.textShadowColor) {
        ctx.shadowColor = config.textShadowColor;
        ctx.shadowBlur = config.textShadowBlur || 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(1, selected.valueSize * 0.06);
    } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    const top = lineY - selected.baselineGap - selected.contentHeight;
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        const centerX = safePad + cellWidth * (index + 0.5);
        let valueY = top;

        if (labelVisible) {
            const labelWidth = measureText(ctx, item.label, fontFamily, selected.labelSize, labelWeight, labelTracking);
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            ctx.fillStyle = labelColor;
            ctx.strokeStyle = 'rgba(0,0,0,0.72)';
            ctx.lineWidth = Math.max(1, Math.min(1.5, selected.labelSize * 0.1));
            drawTrackedLabel(ctx, item.label, centerX - labelWidth / 2, valueY, labelTracking, selected.labelSize, outlined);
            valueY += selected.labelSize + selected.labelGap;
        }

        const valueFont = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        const valueWidth = measureText(ctx, item.value, fontFamily, selected.valueSize, valueWeight);
        ctx.fillStyle = textColor;
        if (selected.inlineUnits && item.unit) {
            const unitSize = selected.unitSize;
            const unitWidth = measureText(ctx, item.unit, fontFamily, unitSize, unitWeight);
            const groupWidth = valueWidth + selected.inlineGap + unitWidth;
            const groupLeft = centerX - groupWidth / 2;
            ctx.textAlign = 'left';
            ctx.font = valueFont;
            ctx.strokeStyle = 'rgba(0,0,0,0.72)';
            ctx.lineWidth = Math.max(1, Math.min(1.5, selected.valueSize * 0.09));
            if (outlined) ctx.strokeText(item.value, groupLeft, valueY, textWidth);
            ctx.fillText(item.value, groupLeft, valueY, textWidth);
            ctx.font = `${unitWeight} ${unitSize}px ${fontFamily}`;
            ctx.fillStyle = textColor;
            ctx.lineWidth = Math.max(1, Math.min(1.5, unitSize * 0.1));
            if (outlined) ctx.strokeText(item.unit, groupLeft + valueWidth + selected.inlineGap, valueY + (selected.valueSize - unitSize) * 0.45, textWidth);
            ctx.fillText(item.unit, groupLeft + valueWidth + selected.inlineGap, valueY + (selected.valueSize - unitSize) * 0.45, textWidth);
        } else {
            ctx.textAlign = 'center';
            ctx.font = valueFont;
            ctx.strokeStyle = 'rgba(0,0,0,0.72)';
            ctx.lineWidth = Math.max(1, Math.min(1.5, selected.valueSize * 0.09));
            if (outlined) ctx.strokeText(item.value, centerX, valueY, textWidth);
            ctx.fillText(item.value, centerX, valueY, textWidth);
            if (item.unit) {
                measureText(ctx, item.unit, fontFamily, selected.unitSize, unitWeight);
                ctx.font = `${unitWeight} ${selected.unitSize}px ${fontFamily}`;
                ctx.fillStyle = textColor;
                ctx.lineWidth = Math.max(1, Math.min(1.5, selected.unitSize * 0.1));
                if (outlined) ctx.strokeText(item.unit, centerX, valueY + selected.valueSize + selected.unitGap, textWidth);
                ctx.fillText(item.unit, centerX, valueY + selected.valueSize + selected.unitGap, textWidth);
            }
        }
    }
}
