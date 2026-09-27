import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { clamp, fontWeightValue, getStableMetricValue, measureTrackedTextWidth } from '../overlayUtils';
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

function measure(
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

function drawOutlined(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth?: number,
): void {
    ctx.strokeText(text, x, y, maxWidth);
    ctx.fillText(text, x, y, maxWidth);
}

function drawTrackedOutlined(
    ctx: OverlayContext2D,
    text: string,
    centerX: number,
    y: number,
    tracking: number,
    size: number,
): void {
    const width = measureTrackedTextWidth(ctx, text, tracking, size);
    const spacing = size * tracking;
    let cursorX = centerX - width / 2;
    for (const char of text) {
        drawOutlined(ctx, char, cursorX, y);
        cursorX += ctx.measureText(char).width + spacing;
    }
}

function displayLabel(key: MetricItemSpec['key']): string {
    switch (key) {
        case 'heartRate': return 'HR';
        case 'distance': return 'DIST';
        case 'time': return 'ELAPSED';
        case 'power': return 'POWER';
        default: return 'PACE';
    }
}

export function drawNightRunner(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const items = toStandardMetricItems(
        data,
        {
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DIST', unit: 'km' },
            time: { label: 'ELAPSED', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['heartRate', 'distance', 'time', 'power'],
    );
    if (!data.pace && items.length === 0) return;

    const fontFamily = config.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const textColor = config.textColor || '#f8fafc';
    const accentColor = config.accentColor || '#fbbf24';
    const valueWeight = fontWeightValue(config.valueFontWeight || 'normal');
    const labelWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.1, 0, 0.2);
    const valueMultiplier = finiteSetting(config.valueSizeMultiplier, 1.9, 0.5, 4);
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.68, 0.35, 1.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.9, 1.8);
    const textScale = finiteSetting(tuning.textScale, 1, 0.5, 4);
    const requestedSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 3.2, 0.5, 8)
        * valueMultiplier
        * textScale
        / 100;
    const maximumHeroSize = Math.max(12, Math.min(144, orientation.shortSide * 0.2));
    const startSize = clamp(requestedSize, 20, maximumHeroSize);
    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.08, h * 0.08));
    const availableWidth = Math.max(0, w - safePad * 2);
    const columns = items.length === 0 ? 1 : (orientation.isPortrait || w < 560 ? Math.min(2, items.length) : items.length);
    const rowCount = Math.ceil(items.length / columns);
    const cellWidth = availableWidth / columns;
    const cellInset = clamp(orientation.shortSide * 0.008, 2, 10);
    const cellTextWidth = Math.max(0, cellWidth - cellInset * 2);
    const rowGap = clamp(orientation.shortSide * 0.016, 3, 18);
    const heroUnit = 'MIN / KM';
    const strokeColor = 'rgba(3,9,16,0.9)';

    let selected: {
        paceSize: number;
        paceUnitSize: number;
        supportValueSize: number;
        supportUnitSize: number;
        labelSize: number;
        rowHeight: number;
        supportHeight: number;
        supportTop: number;
        paceBaseline: number;
        heroGroupWidth: number;
    } | undefined;

    for (let paceSize = Math.floor(startSize); paceSize >= 7; paceSize -= 1) {
        const paceUnitSize = Math.max(10, Math.round(paceSize * 0.24));
        const supportValueSize = Math.max(13, Math.round(paceSize * 0.52));
        const supportUnitSize = Math.max(10, Math.round(supportValueSize * 0.62));
        const labelSize = labelVisible ? Math.max(9, Math.round(supportValueSize * labelMultiplier)) : 0;
        const rowLabelGap = labelVisible ? Math.max(3, Math.round(supportValueSize * 0.18 * lineSpacing)) : 0;
        const rowHeight = (labelVisible ? labelSize + rowLabelGap : 0) + supportValueSize;
        const supportHeight = rowCount * rowHeight + Math.max(0, rowCount - 1) * rowGap;
        const supportTop = h - safePad - supportHeight;
        const paceBaseline = safePad + paceSize;
        const paceBottom = paceBaseline + paceSize * 0.2;
        const verticalGap = Math.max(8, orientation.shortSide * 0.045);
        if (supportTop < safePad || paceBottom + verticalGap > supportTop) continue;

        const paceWidth = measure(ctx, data.pace ?? '', fontFamily, paceSize, valueWeight);
        const paceUnitWidth = measure(ctx, heroUnit, fontFamily, paceUnitSize, 600, 0.04);
        const heroGap = Math.max(4, paceSize * 0.14);
        const heroGroupWidth = paceWidth + heroGap + paceUnitWidth;
        if (heroGroupWidth > availableWidth) continue;

        const fitsSupport = items.every((item) => {
            const labelWidth = labelVisible
                ? measure(ctx, displayLabel(item.key), fontFamily, labelSize, labelWeight, labelTracking)
                : 0;
            const stableValue = getStableMetricValue(STABLE_KEY[item.key]);
            const valueWidth = Math.max(
                measure(ctx, item.value, fontFamily, supportValueSize, valueWeight),
                measure(ctx, stableValue, fontFamily, supportValueSize, valueWeight),
            );
            const unit = (item.unit ?? '').toUpperCase();
            const unitWidth = measure(ctx, unit, fontFamily, supportUnitSize, 500);
            const unitGap = unit ? Math.max(3, supportUnitSize * 0.28) : 0;
            return labelWidth <= cellTextWidth && valueWidth + unitGap + unitWidth <= cellTextWidth;
        });
        if (!fitsSupport) continue;

        selected = {
            paceSize,
            paceUnitSize,
            supportValueSize,
            supportUnitSize,
            labelSize,
            rowHeight,
            supportHeight,
            supportTop,
            paceBaseline,
            heroGroupWidth,
        };
        break;
    }

    if (!selected) return;

    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.strokeStyle = strokeColor;
    ctx.lineJoin = 'round';

    if (data.pace) {
        const paceWidth = measure(ctx, data.pace, fontFamily, selected.paceSize, valueWeight);
        const heroGap = Math.max(4, selected.paceSize * 0.14);
        const groupLeft = w / 2 - selected.heroGroupWidth / 2;
        ctx.font = `${valueWeight} ${selected.paceSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.paceSize * 0.16, 1.6, 4.4);
        ctx.fillStyle = accentColor;
        drawOutlined(ctx, data.pace, groupLeft, selected.paceBaseline, paceWidth);

        const unitX = groupLeft + paceWidth + heroGap;
        ctx.font = `600 ${selected.paceUnitSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.paceUnitSize * 0.18, 1.5, 2.5);
        ctx.fillStyle = textColor;
        drawTrackedOutlined(ctx, heroUnit, unitX + measure(ctx, heroUnit, fontFamily, selected.paceUnitSize, 600, 0.04) / 2,
            selected.paceBaseline - selected.paceSize * 0.06, 0.04, selected.paceUnitSize);
    }

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        const row = Math.floor(index / columns);
        const column = index % columns;
        const itemsInRow = Math.min(columns, items.length - row * columns);
        const rowWidth = itemsInRow * cellWidth;
        const rowLeft = safePad + (availableWidth - rowWidth) / 2;
        const centerX = rowLeft + cellWidth * (column + 0.5);
        const rowTop = selected.supportTop + row * (selected.rowHeight + rowGap);
        const labelRowGap = labelVisible ? Math.max(3, Math.round(selected.supportValueSize * 0.18 * lineSpacing)) : 0;
        const valueBaseline = rowTop + (labelVisible ? selected.labelSize + labelRowGap : 0) + selected.supportValueSize;

        if (labelVisible) {
            ctx.textAlign = 'left';
            ctx.fillStyle = accentColor;
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.labelSize * 0.18, 1.4, 2);
            drawTrackedOutlined(ctx, displayLabel(item.key), centerX, rowTop + selected.labelSize,
                labelTracking, selected.labelSize);
        }

        const unit = (item.unit ?? '').toUpperCase();
        const valueWidth = measure(ctx, item.value, fontFamily, selected.supportValueSize, valueWeight);
        const unitWidth = measure(ctx, unit, fontFamily, selected.supportUnitSize, 500);
        const unitGap = unit ? Math.max(3, selected.supportUnitSize * 0.28) : 0;
        const valueMaxWidth = Math.max(0, Math.min(valueWidth, cellTextWidth - unitWidth - unitGap));
        const groupWidth = valueMaxWidth + unitGap + unitWidth;
        const groupLeft = centerX - groupWidth / 2;

        ctx.textAlign = 'left';
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${selected.supportValueSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.supportValueSize * 0.16, 1.6, 3);
        drawOutlined(ctx, item.value, groupLeft, valueBaseline, valueMaxWidth);

        if (unit) {
            const unitX = groupLeft + valueMaxWidth + unitGap;
            ctx.fillStyle = textColor;
            ctx.font = `500 ${selected.supportUnitSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.supportUnitSize * 0.18, 1.4, 2);
            drawOutlined(ctx, unit, unitX, valueBaseline - (selected.supportValueSize - selected.supportUnitSize) * 0.12,
                unitWidth);
        }
    }

    ctx.restore();
}
