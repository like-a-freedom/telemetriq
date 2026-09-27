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

const WIDTH_RESERVE: Record<MetricItemSpec['key'], string> = {
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
    const label: Record<MetricItemSpec['key'], string> = {
        pace: 'Pace · min/km',
        heartRate: 'HR · bpm',
        distance: 'Dist · km',
        time: 'Time',
        power: 'Power',
    };
    const value = label[item.key];
    return config.labelStyle === 'uppercase' ? value.toUpperCase() : value;
}

function getValueText(item: MetricItemSpec, config: ExtendedOverlayConfig): string {
    return config.labelStyle === 'hidden' && item.unit
        ? `${item.value} ${item.unit}`
        : item.value;
}

function getStableValueText(item: MetricItemSpec, config: ExtendedOverlayConfig): string {
    const stableValue = WIDTH_RESERVE[item.key];
    return config.labelStyle === 'hidden' && item.unit
        ? `${stableValue} ${item.unit}`
        : stableValue;
}

function measureLabel(
    ctx: OverlayContext2D,
    label: string,
    fontFamily: string,
    fontSize: number,
    tracking: number,
): number {
    if (!label) return 0;
    ctx.font = `500 ${fontSize}px ${fontFamily}`;
    return measureTrackedTextWidth(ctx, label, tracking, fontSize);
}

function measureValue(
    ctx: OverlayContext2D,
    value: string,
    fontFamily: string,
    fontSize: number,
    weight: number,
): number {
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    return ctx.measureText(value).width;
}

export function drawCondensedStrip(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number; labelTrackingScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 24) return;

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

    const barHeight = Math.min(
        h,
        Math.max(30, Math.round(h * (orientation.isPortrait ? 0.06 : 0.05))),
    );
    const barY = h - barHeight;
    const segmentWidth = w / items.length;
    const horizontalInset = Math.min(18, Math.max(2, segmentWidth * 0.02));
    const textWidth = Math.max(0, segmentWidth - horizontalInset * 2);
    const verticalInset = Math.min(6, barHeight * 0.08);
    const availableTextHeight = Math.max(0, barHeight - verticalInset * 2);
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.48, 0.25, 0.82);
    const lineSpacing = finiteSetting(config.lineSpacing, 1, 0.8, 1.8);
    const tracking = clamp(
        finiteSetting(config.labelLetterSpacing, 0.08, 0, 0.24)
        * finiteSetting(tuning.labelTrackingScale, 1, 0.5, 1),
        0,
        0.24,
    );
    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const configuredValueSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2.8, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.15, 0.5, 4)
        * Math.max(0.5, tuning.textScale)
        / 100;
    const maxValueSize = Math.min(64, availableTextHeight);
    if (maxValueSize < 7) return;
    const startValueSize = Math.min(
        maxValueSize,
        Math.max(Math.min(12, maxValueSize), Math.round(configuredValueSize)),
    );

    let selected: { valueSize: number; labelSize: number; labelGap: number; blockHeight: number } | undefined;
    for (let valueSize = Math.floor(startValueSize); valueSize >= 7; valueSize -= 1) {
        const labelSize = labelVisible
            ? Math.max(7, Math.round(valueSize * labelMultiplier))
            : 0;
        const labelGap = labelVisible
            ? Math.max(1, Math.round(valueSize * Math.min(0.3, Math.max(0.08, lineSpacing - 0.75))))
            : 0;
        const blockHeight = labelSize + labelGap + valueSize;
        if (blockHeight > availableTextHeight) continue;

        const fitsEverySegment = items.every((item) => {
            const labelWidth = measureLabel(ctx, getLabel(item, config), fontFamily, labelSize, tracking);
            const valueWidth = Math.max(
                measureValue(ctx, getValueText(item, config), fontFamily, valueSize, valueWeight),
                measureValue(ctx, getStableValueText(item, config), fontFamily, valueSize, valueWeight),
            );
            return labelWidth <= textWidth && valueWidth <= textWidth;
        });
        if (!fitsEverySegment) continue;

        selected = { valueSize, labelSize, labelGap, blockHeight };
        break;
    }
    if (!selected) return;

    const opacity = finiteSetting(config.backgroundOpacity, 1, 0, 1);
    if (opacity > 0) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = config.backgroundColor || '#FFFFFF';
        ctx.fillRect(0, barY, w, barHeight);
        ctx.restore();
    }

    const textColor = config.textColor || '#111111';
    const labelColor = textColor;
    const contentTop = barY + (barHeight - selected.blockHeight) / 2;
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        const centerX = segmentWidth * (index + 0.5);

        if (index > 0) {
            ctx.strokeStyle = 'rgba(17,17,17,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(segmentWidth * index, barY + 2);
            ctx.lineTo(segmentWidth * index, barY + barHeight - 2);
            ctx.stroke();
        }

        const label = getLabel(item, config);
        if (label) {
            const labelWidth = measureLabel(ctx, label, fontFamily, selected.labelSize, tracking);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = `500 ${selected.labelSize}px ${fontFamily}`;
            ctx.fillStyle = labelColor;
            drawTrackedText(
                ctx,
                label,
                centerX - labelWidth / 2,
                contentTop,
                tracking,
                selected.labelSize,
            );
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.fillText(getValueText(item, config), centerX, contentTop + selected.labelSize + selected.labelGap, textWidth);
    }
}
