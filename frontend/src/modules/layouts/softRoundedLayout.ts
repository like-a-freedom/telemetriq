import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    clamp,
    drawTrackedText,
    fontWeightValue,
    measureTrackedTextWidth,
} from '../overlayUtils';
import { toStandardMetricItems, type MetricItemSpec, type MetricMap, type Orientation } from './shared';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

const VALUE_RESERVE: Record<MetricItemSpec['key'], string> = {
    pace: '120:59',
    heartRate: '199',
    distance: '12345.6',
    time: '123:59:59',
    power: '1999',
};

function finiteSetting(value: number | undefined, fallback: number, min: number, max: number): number {
    return Number.isFinite(value) ? clamp(value!, min, max) : fallback;
}

function getLabel(item: MetricItemSpec, config: ExtendedOverlayConfig): string {
    if (config.labelStyle === 'hidden') return '';
    return config.labelStyle === 'uppercase' ? item.label.toUpperCase() : item.label;
}

function getUnitText(item: MetricItemSpec): string {
    return item.unit ?? '';
}

function measureText(
    ctx: OverlayContext2D,
    text: string,
    family: string,
    size: number,
    weight: number,
    tracking: number,
): number {
    if (!text) return 0;
    ctx.font = `${weight} ${size}px ${family}`;
    return measureTrackedTextWidth(ctx, text, tracking, size);
}

export function drawSoftRounded(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number; labelTrackingScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 32) return;

    const items = toStandardMetricItems(
        data,
        {
            pace: { label: 'Pace', unit: 'min/km' },
            heartRate: { label: 'Heart rate', unit: 'bpm' },
            distance: { label: 'Distance', unit: 'km' },
            time: { label: 'Time', unit: '' },
        },
        ['pace', 'heartRate', 'distance', 'time'],
    );
    if (items.length === 0) return;

    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.12, h * 0.12));
    const availableWidth = Math.max(0, w - safePad * 2);
    const gap = clamp(orientation.shortSide * 0.01, 3, 12);
    const cardWidth = (availableWidth - gap * (items.length - 1)) / items.length;
    const horizontalInset = Math.min(cardWidth * 0.12, Math.max(4, orientation.shortSide * 0.018));
    const textWidth = Math.max(0, cardWidth - horizontalInset * 2);
    const maxCardHeight = Math.min(h * 0.42, orientation.shortSide * 0.32);
    const maxValueSize = Math.min(64, maxCardHeight * 0.58);
    if (cardWidth <= 0 || textWidth <= 0 || maxValueSize < 7) return;

    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.48, 0.25, 0.82);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.1, 0.8, 1.8);
    const lineGapFactor = Math.min(0.3, Math.max(0.08, (lineSpacing - 0.75) * 0.5));
    const tracking = clamp(
        finiteSetting(config.labelLetterSpacing, 0.08, 0, 0.24)
        * finiteSetting(tuning.labelTrackingScale, 1, 0.5, 1),
        0,
        0.24,
    );
    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const valueWeight = fontWeightValue(config.valueFontWeight || 'normal');
    const labelWeight = fontWeightValue('medium');
    const configuredValueSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2.8, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.1, 0.5, 4)
        * Math.max(0.5, tuning.textScale)
        / 100;
    const minValueSize = Math.min(16, maxValueSize);
    const startValueSize = Math.min(
        maxValueSize,
        Math.max(minValueSize, Math.round(configuredValueSize)),
    );

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        labelGap: number;
        unitGap: number;
        cardHeight: number;
        verticalPadding: number;
    } | undefined;

    const hasSupportingText = labelVisible || items.some((item) => item.unit);
    const minimumValueSize = hasSupportingText ? 8 : 7;
    for (let valueSize = Math.floor(startValueSize); valueSize >= minimumValueSize; valueSize -= 1) {
        const labelSize = labelVisible
            ? Math.min(valueSize - 1, Math.max(7, Math.round(valueSize * labelMultiplier)))
            : 0;
        const unitSize = Math.min(valueSize - 1, Math.max(7, Math.round(valueSize * labelMultiplier * 0.92)));
        const labelGap = labelVisible ? Math.max(1, Math.round(valueSize * lineGapFactor)) : 0;
        const unitGap = items.some((item) => item.unit) ? Math.max(1, Math.round(valueSize * lineGapFactor)) : 0;
        const contentHeight = labelSize + labelGap + valueSize + unitGap + (items.some((item) => item.unit) ? unitSize : 0);
        const verticalPadding = Math.max(4, Math.round(valueSize * 0.28));
        const cardHeight = contentHeight + verticalPadding * 2;
        if (cardHeight > maxCardHeight || cardHeight + safePad > h) continue;

        const fitsAllCards = items.every((item) => {
            const label = getLabel(item, config);
            const valueWidth = Math.max(
                measureText(ctx, item.value, fontFamily, valueSize, valueWeight, 0),
                measureText(ctx, VALUE_RESERVE[item.key], fontFamily, valueSize, valueWeight, 0),
            );
            const labelWidth = measureText(ctx, label, fontFamily, labelSize, labelWeight, tracking);
            const unitWidth = measureText(ctx, getUnitText(item), fontFamily, unitSize, labelWeight, tracking);
            return valueWidth <= textWidth && labelWidth <= textWidth && unitWidth <= textWidth;
        });
        if (!fitsAllCards) continue;

        selected = { valueSize, labelSize, unitSize, labelGap, unitGap, cardHeight, verticalPadding };
        break;
    }
    if (!selected) return;

    const backgroundOpacity = finiteSetting(config.backgroundOpacity, 0.9, 0, 1);
    const radius = Math.min(
        selected.cardHeight / 2,
        finiteSetting(config.cornerRadius, 16, 4, selected.cardHeight * 0.32),
    );
    const y = h - safePad - selected.cardHeight;
    const textColor = config.textColor || '#111827';

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        const x = safePad + index * (cardWidth + gap);

        if (backgroundOpacity > 0) {
            ctx.save();
            ctx.globalAlpha = backgroundOpacity;
            ctx.fillStyle = config.backgroundColor || 'rgba(255,255,255,0.94)';
            ctx.beginPath();
            ctx.roundRect(x, y, cardWidth, selected.cardHeight, radius);
            ctx.fill();
            ctx.restore();
        }

        if (item.key === 'pace' && config.accentColor) {
            ctx.save();
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = config.accentColor;
            ctx.beginPath();
            ctx.roundRect(x, y, cardWidth, selected.cardHeight, radius);
            ctx.fill();
            ctx.restore();
        }

        const label = getLabel(item, config);
        const hasUnit = Boolean(item.unit);
        const contentHeight = selected.labelSize + selected.labelGap + selected.valueSize
            + (hasUnit ? selected.unitGap + selected.unitSize : 0);
        const contentTop = y + (selected.cardHeight - contentHeight) / 2;
        const centerX = x + cardWidth / 2;
        let textY = contentTop;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        if (label) {
            const labelWidth = measureText(ctx, label, fontFamily, selected.labelSize, labelWeight, tracking);
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            drawTrackedText(ctx, label, centerX - labelWidth / 2, textY, tracking, selected.labelSize);
            textY += selected.labelSize + selected.labelGap;
        }

        ctx.textAlign = 'center';
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.fillText(item.value, centerX, textY, textWidth);
        textY += selected.valueSize;

        if (item.unit) {
            const unitWidth = measureText(ctx, item.unit, fontFamily, selected.unitSize, labelWeight, tracking);
            ctx.font = `${labelWeight} ${selected.unitSize}px ${fontFamily}`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            drawTrackedText(ctx, item.unit, centerX - unitWidth / 2, textY + selected.unitGap, tracking, selected.unitSize);
        }
    }
}
