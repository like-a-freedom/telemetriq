import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    clamp,
    drawTrackedText,
    fontWeightValue,
    measureTrackedTextWidth,
} from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type MetricItemSpec, type Orientation } from './shared';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

const WIDTH_RESERVE: Record<MetricItemSpec['key'], string> = {
    pace: '120:59',
    heartRate: '199',
    distance: '12345.6',
    time: '123:59:59',
    power: '1999',
};

const COMPACT_LABEL: Record<MetricItemSpec['key'], string> = {
    pace: 'PACE',
    heartRate: 'HR',
    distance: 'DIST',
    time: 'TIME',
    power: 'PWR',
};

type LabelMode = 'full' | 'compact' | 'none';

function getLabel(item: MetricItemSpec, mode: LabelMode, config: ExtendedOverlayConfig): string {
    if (mode === 'none') return '';
    if (mode === 'compact') return COMPACT_LABEL[item.key];
    return config.labelStyle === 'uppercase' ? item.label.toUpperCase() : item.label;
}

function getRowSizes(valueSize: number, mode: LabelMode, config: ExtendedOverlayConfig): {
    labelSize: number;
    labelGap: number;
    rowGap: number;
    rowHeight: number;
} {
    const labelSize = mode === 'none'
        ? 0
        : Math.max(7, Math.round(valueSize * clamp(config.labelSizeMultiplier ?? 0.62, 0.4, 0.82)));
    const labelGap = mode === 'none' ? 0 : Math.max(2, Math.round(valueSize * 0.22));
    const rowGap = Math.max(2, Math.round(valueSize * Math.max(0.25, (config.lineSpacing ?? 1.05) - 0.8)));
    return {
        labelSize,
        labelGap,
        rowGap,
        rowHeight: labelSize + labelGap + valueSize + rowGap,
    };
}

function measureLabel(
    ctx: OverlayContext2D,
    label: string,
    fontFamily: string,
    labelSize: number,
    tracking: number,
): number {
    if (!label) return 0;
    ctx.font = `500 ${labelSize}px ${fontFamily}`;
    return measureTrackedTextWidth(ctx, label, tracking, labelSize);
}

function unitFontSize(valueSize: number): number {
    return Math.max(7, Math.round(valueSize * 0.78));
}

function measureValueLine(
    ctx: OverlayContext2D,
    value: string,
    unit: string | undefined,
    fontFamily: string,
    valueSize: number,
    valueWeight: number,
): number {
    ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
    const valueWidth = ctx.measureText(value).width;
    if (!unit) return valueWidth;

    ctx.font = `500 ${unitFontSize(valueSize)}px ${fontFamily}`;
    return valueWidth + ctx.measureText(` ${unit}`).width;
}

function measureStackWidth(
    ctx: OverlayContext2D,
    items: MetricItemSpec[],
    config: ExtendedOverlayConfig,
    fontFamily: string,
    valueSize: number,
    mode: LabelMode,
    valueWeight: number,
): number {
    const { labelSize } = getRowSizes(valueSize, mode, config);
    const tracking = clamp(config.labelLetterSpacing ?? 0, 0, 0.24);
    return Math.max(...items.map((item) => {
        const label = getLabel(item, mode, config);
        const reservedValue = WIDTH_RESERVE[item.key];
        const labelWidth = measureLabel(ctx, label, fontFamily, labelSize, tracking);
        const valueWidth = Math.max(
            measureValueLine(ctx, item.value, item.unit, fontFamily, valueSize, valueWeight),
            measureValueLine(ctx, reservedValue, item.unit, fontFamily, valueSize, valueWeight),
        );
        return Math.max(labelWidth, valueWidth);
    }));
}

export function drawWhisper(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 24) return;

    const items = toStandardMetricItems(
        data,
        {
            pace: { label: 'Pace', unit: 'min/km' },
            heartRate: { label: 'Heart rate', unit: 'bpm' },
            distance: { label: 'Distance', unit: 'km' },
            time: { label: 'Time', unit: '' },
            power: { label: 'Power', unit: 'W' },
        },
        ['pace', 'heartRate', 'distance', 'time', 'power'],
    );
    if (items.length === 0) return;

    const shadowBlur = config.textShadow ? clamp(config.textShadowBlur ?? 2, 1, 4) : 0;
    const shadowPad = shadowBlur > 0 ? shadowBlur * 2 + 1 : 0;
    const safePad = clamp(Math.max(orientation.safePad, shadowPad), 0, Math.min(w / 4, h / 4));
    const availableWidth = Math.max(0, w - safePad * 2);
    const availableHeight = Math.max(0, h - safePad * 2);
    const maxSizeByHeight = Math.min(72, availableHeight / Math.max(1, items.length * 1.9));
    if (maxSizeByHeight < 7) return;

    const minValueSize = Math.min(22, maxSizeByHeight);
    const baseValueSize = clamp(
        Math.round(
            orientation.shortSide
            * (config.fontSizePercent ?? 4.2)
            / 100
            * tuning.textScale
            * (config.valueSizeMultiplier ?? 1),
        ),
        minValueSize,
        maxSizeByHeight,
    );
    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const valueWeight = fontWeightValue(config.valueFontWeight ?? 'normal');
    const modes: LabelMode[] = config.labelStyle === 'hidden' ? ['none'] : ['full', 'compact', 'none'];
    let valueSize = baseValueSize;
    let labelMode: LabelMode = modes[modes.length - 1]!;
    let fitFound = false;

    for (const mode of modes) {
        for (let size = Math.floor(baseValueSize); size >= 7; size -= 1) {
            const row = getRowSizes(size, mode, config);
            const fitsWidth = measureStackWidth(ctx, items, config, fontFamily, size, mode, valueWeight) <= availableWidth;
            const fitsHeight = row.rowHeight * items.length <= availableHeight;
            if (fitsWidth && fitsHeight) {
                valueSize = size;
                labelMode = mode;
                fitFound = true;
                break;
            }
        }
        if (fitFound) break;
    }
    if (!fitFound) return;

    const { labelSize, labelGap, rowHeight } = getRowSizes(valueSize, labelMode, config);
    const tracking = clamp(config.labelLetterSpacing ?? 0, 0, 0.24);
    const valueColor = config.textColor || 'rgba(255,255,255,0.94)';
    const top = h - safePad - rowHeight * items.length;

    ctx.save();
    if (config.textShadow) {
        ctx.shadowColor = config.textShadowColor || 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
    }
    ctx.textBaseline = 'top';
    items.forEach((item, index) => {
        const y = top + index * rowHeight;
        const label = getLabel(item, labelMode, config);
        if (label) {
            const labelWidth = measureLabel(ctx, label, fontFamily, labelSize, tracking);
            ctx.textAlign = 'left';
            ctx.font = `500 ${labelSize}px ${fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.78)';
            drawTrackedText(ctx, label, w - safePad - labelWidth, y, tracking, labelSize);
        }

        ctx.textAlign = 'right';
        ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
        ctx.fillStyle = valueColor;
        const valueY = y + labelSize + labelGap;
        const unitSize = unitFontSize(valueSize);
        const unitText = item.unit ? ` ${item.unit}` : '';
        let unitWidth = 0;
        if (item.unit) {
            ctx.font = `500 ${unitSize}px ${fontFamily}`;
            unitWidth = ctx.measureText(unitText).width;
        }
        ctx.textAlign = 'right';
        ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
        ctx.fillText(item.value, w - safePad - unitWidth, valueY);
        if (item.unit) {
            ctx.font = `500 ${unitSize}px ${fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.78)';
            ctx.fillText(unitText, w - safePad, valueY + valueSize - unitSize);
        }
    });
    ctx.restore();
}
