import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    clamp,
    drawTrackedText,
    fontWeightValue,
    getStableMetricValue,
    measureTrackedTextWidth,
} from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type MetricItemSpec, type Orientation } from './shared';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

const STABLE_KEY: Record<MetricItemSpec['key'], string> = {
    pace: 'pace',
    heartRate: 'heart rate',
    distance: 'distance',
    time: 'time',
    power: 'power',
};

const COMPACT_LABEL: Record<MetricItemSpec['key'], string> = {
    pace: 'PACE',
    heartRate: 'HR',
    distance: 'DIST',
    time: 'TIME',
    power: 'PWR',
};

type LabelMode = 'full' | 'compact' | 'none';

function labelFor(item: MetricItemSpec, mode: LabelMode, config: ExtendedOverlayConfig): string {
    if (mode === 'none' || (mode === 'compact' && item.key !== 'time')) return '';
    if (mode === 'compact') return COMPACT_LABEL[item.key];

    const label = item.label;
    return config.labelStyle === 'uppercase' ? label.toUpperCase() : label;
}

function fontSizes(valueSize: number, config: ExtendedOverlayConfig): {
    label: number;
    unit: number;
} {
    const labelMultiplier = Math.min(0.62, Math.max(0, config.labelSizeMultiplier ?? 0.55));
    return {
        label: Math.max(7, Math.round(valueSize * labelMultiplier)),
        unit: Math.max(7, Math.round(valueSize * 0.78)),
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

function measureValue(
    ctx: OverlayContext2D,
    value: string,
    fontFamily: string,
    valueSize: number,
    valueWeight: number,
): number {
    ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
    return ctx.measureText(value).width;
}

function measureUnit(
    ctx: OverlayContext2D,
    unit: string,
    fontFamily: string,
    unitSize: number,
): number {
    if (!unit) return 0;
    ctx.font = `500 ${unitSize}px ${fontFamily}`;
    return ctx.measureText(unit).width;
}

function measureMetrics(
    ctx: OverlayContext2D,
    items: MetricItemSpec[],
    config: ExtendedOverlayConfig,
    fontFamily: string,
    valueSize: number,
    mode: LabelMode,
    valueWeight: number,
    useStableWidth = true,
): number {
    const { label: labelSize, unit: unitSize } = fontSizes(valueSize, config);
    const tracking = clamp(config.labelLetterSpacing ?? 0, 0, 0.24);
    const labelValueGap = Math.max(2, Math.round(valueSize * 0.26));
    const valueUnitGap = Math.max(2, Math.round(valueSize * 0.2));
    const metricGap = Math.max(5, Math.round(valueSize * 0.76));
    let width = 0;

    for (const [index, item] of items.entries()) {
        if (index > 0) width += metricGap;

        const label = labelFor(item, mode, config);
        const stableValue = getStableMetricValue(STABLE_KEY[item.key]);
        const actualValueWidth = measureValue(ctx, item.value, fontFamily, valueSize, valueWeight);
        const valueWidth = useStableWidth
            ? Math.max(measureValue(ctx, stableValue, fontFamily, valueSize, valueWeight), actualValueWidth)
            : actualValueWidth;
        const labelWidth = measureLabel(ctx, label, fontFamily, labelSize, tracking);
        const unitWidth = measureUnit(ctx, item.unit ?? '', fontFamily, unitSize);

        width += labelWidth;
        if (labelWidth > 0) width += labelValueGap;
        width += valueWidth;
        if (unitWidth > 0) width += valueUnitGap + unitWidth;
    }

    return width;
}

export function drawTickerTape(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;

    const barH = Math.min(h, Math.max(40, Math.round(h * 0.075)));
    const y = h - barH;
    const centerY = y + barH / 2;
    const safePad = clamp(orientation.safePad, 0, w / 4);
    const accentColor = config.accentColor || '#ef4444';
    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const textColor = config.textColor || '#ffffff';
    const backgroundOpacity = clamp(config.backgroundOpacity ?? 0.95, 0, 1);

    ctx.fillStyle = `rgba(0,0,0,${backgroundOpacity})`;
    ctx.fillRect(0, y, w, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, y, w, 1);

    if (barH < 10 || w < 96) return;

    const maxValueSize = Math.min(72, barH * 0.72);
    const minValueSize = Math.min(22, maxValueSize);

    const baseValueSize = clamp(
        Math.round(
            h
            * (config.fontSizePercent ?? 4.2)
            / 100
            * tuning.textScale
            * (config.valueSizeMultiplier ?? 1),
        ),
        minValueSize,
        maxValueSize,
    );
    const baseLabelSize = fontSizes(baseValueSize, config).label;
    const liveSize = Math.max(8, Math.round(baseLabelSize * 1.08));
    const liveText = 'LIVE';
    const liveX = safePad + 8;
    const liveFontWeight = 700;

    ctx.beginPath();
    ctx.arc(liveX - 4, centerY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();
    ctx.font = `${liveFontWeight} ${liveSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accentColor;
    ctx.fillText(liveText, liveX, centerY);

    const items = toStandardMetricItems(
        data,
        {
            pace: { label: 'Pace', unit: 'min/km' },
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'Dist', unit: 'km' },
            time: { label: 'Time', unit: '' },
            power: { label: 'Power', unit: 'W' },
        },
        ['pace', 'heartRate', 'distance', 'time', 'power'],
    );
    if (items.length === 0) return;

    const liveWidth = ctx.measureText(liveText).width;
    const contentX = liveX + liveWidth + Math.max(10, Math.round(baseValueSize * 0.95));
    const maxContentWidth = Math.max(0, w - contentX - safePad);
    const valueWeight = fontWeightValue(config.valueFontWeight ?? 'bold');
    const requestedLabelMode: LabelMode = config.labelStyle === 'hidden' ? 'none' : 'full';
    const modes: LabelMode[] = requestedLabelMode === 'none'
        ? ['none']
        : ['full', 'compact', 'none'];
    let valueSize = baseValueSize;
    let labelMode: LabelMode = modes[modes.length - 1]!;
    let fitFound = false;

    for (let size = baseValueSize; size >= 7; size -= 1) {
        for (const mode of modes) {
            const measuredWidth = measureMetrics(ctx, items, config, fontFamily, size, mode, valueWeight);
            if (measuredWidth <= maxContentWidth) {
                valueSize = size;
                labelMode = mode;
                fitFound = true;
                break;
            }
        }
        if (fitFound) break;
    }

    const { label: labelSize, unit: unitSize } = fontSizes(valueSize, config);
    const tracking = clamp(config.labelLetterSpacing ?? 0, 0, 0.24);
    const labelValueGap = Math.max(2, Math.round(valueSize * 0.26));
    const valueUnitGap = Math.max(2, Math.round(valueSize * 0.2));
    const baseMetricGap = Math.max(5, Math.round(valueSize * 0.76));
    const actualContentWidth = measureMetrics(
        ctx,
        items,
        config,
        fontFamily,
        valueSize,
        labelMode,
        valueWeight,
        false,
    );
    const unusedWidth = Math.max(0, maxContentWidth - actualContentWidth);
    const metricGap = items.length >= 3
        ? baseMetricGap + unusedWidth / (items.length - 1)
        : baseMetricGap;
    let x = contentX;

    items.forEach((item, index) => {
        if (index > 0) {
            const dividerHeight = Math.max(7, Math.round(valueSize * 0.72));
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(x + Math.floor(metricGap / 2), centerY - dividerHeight / 2, 1, dividerHeight);
            x += metricGap;
        }

        const label = labelFor(item, labelMode, config);
        const labelWidth = measureLabel(ctx, label, fontFamily, labelSize, tracking);
        if (label) {
            ctx.font = `500 ${labelSize}px ${fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.68)';
            drawTrackedText(ctx, label, x, centerY, tracking, labelSize);
            x += labelWidth + labelValueGap;
        }

        ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.fillText(item.value, x, centerY);
        x += ctx.measureText(item.value).width;

        if (item.unit) {
            x += valueUnitGap;
            ctx.font = `500 ${unitSize}px ${fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.78)';
            ctx.fillText(item.unit, x, centerY);
            x += ctx.measureText(item.unit).width;
        }
    });
}
