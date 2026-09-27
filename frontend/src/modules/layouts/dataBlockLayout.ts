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

function drawOutlined(ctx: OverlayContext2D, text: string, x: number, y: number, maxWidth?: number): void {
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

function labelFor(item: MetricItemSpec): string {
    switch (item.key) {
        case 'pace': return 'PACE';
        case 'distance': return 'DISTANCE';
        case 'time': return 'ELAPSED';
        case 'power': return 'POWER';
        default: return 'HEART RATE';
    }
}

export function drawDataBlock(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const hasHeartRate = Boolean(data.heartRate);
    const supportItems = toStandardMetricItems(
        data,
        {
            pace: { label: 'PACE', unit: 'min/km' },
            distance: { label: 'DISTANCE', unit: 'km' },
            time: { label: 'ELAPSED', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['pace', 'distance', 'time', 'power'],
    );
    if (!hasHeartRate && supportItems.length === 0) return;

    const fontFamily = config.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const textColor = config.textColor || '#f8fafc';
    const accent = config.accentColor || '#f97316';
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.48, 0.3, 1.2);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.06, 0, 0.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.9, 1.8);
    const textScale = finiteSetting(tuning.textScale, 1, 0.5, 4);
    const requestedSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2.2, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.4, 0.5, 4)
        * textScale
        / 100;
    const startSize = clamp(requestedSize, 12, 64);
    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.08, h * 0.08));
    const availableW = Math.max(0, w - safePad * 2);
    const blockW = Math.min(availableW, Math.max(orientation.shortSide * 0.8, w * 0.55));
    const blockLeft = w - safePad - blockW;
    const columns = supportItems.length === 0
        ? 1
        : orientation.isPortrait || w < 560
            ? Math.min(2, supportItems.length)
            : supportItems.length;
    const rowCount = Math.ceil(supportItems.length / columns);
    const cellW = supportItems.length > 0 ? blockW / columns : 0;
    const cellInset = clamp(orientation.shortSide * 0.007, 2, 10);
    const cellTextW = Math.max(0, cellW - cellInset * 2);
    const supportRowGap = clamp(orientation.shortSide * 0.014, 3, 16);
    const unitGap = 5;
    const strokeColor = 'rgba(2,8,16,0.9)';

    let selected: {
        valueSize: number;
        heroSize: number;
        heroLabelSize: number;
        heroUnitSize: number;
        labelSize: number;
        unitSize: number;
        labelGap: number;
        heroGap: number;
        supportHeight: number;
        rowHeight: number;
        supportRowGap: number;
        blockTop: number;
        heroValueWidth: number;
        heroUnitWidth: number;
        heroGroupWidth: number;
        dividerGap: number;
    } | undefined;

    for (let valueSize = Math.floor(startSize); valueSize >= 7; valueSize -= 1) {
        const heroSize = hasHeartRate ? Math.max(20, Math.round(valueSize * 1.75)) : 0;
        const heroLabelSize = hasHeartRate && labelVisible ? Math.max(8, Math.round(valueSize * 0.48)) : 0;
        const heroUnitSize = hasHeartRate ? Math.max(9, Math.round(heroSize * 0.34)) : 0;
        const labelSize = labelVisible ? Math.max(8, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(8, Math.round(valueSize * 0.62));
        const rowLabelGap = labelVisible ? Math.max(3, Math.round(valueSize * 0.18 * lineSpacing)) : 0;
        const rowHeight = (labelVisible ? labelSize + rowLabelGap : 0) + valueSize;
        const supportHeight = rowCount > 0
            ? rowCount * rowHeight + Math.max(0, rowCount - 1) * supportRowGap
            : 0;
        const heroGap = hasHeartRate ? Math.max(5, Math.round(valueSize * 0.32)) : 0;
        const dividerGap = hasHeartRate && supportItems.length > 0 ? Math.max(8, Math.round(valueSize * 0.48)) : 0;
        const heroHeight = hasHeartRate
            ? (labelVisible ? heroLabelSize + Math.max(3, Math.round(valueSize * 0.2)) : 0) + heroSize
            : 0;
        const totalHeight = heroHeight + dividerGap + supportHeight;
        if (totalHeight > h - safePad * 2) continue;

        const heroValueWidth = hasHeartRate
            ? Math.max(
                measure(ctx, data.heartRate ?? '', fontFamily, heroSize, valueWeight),
                measure(ctx, getStableMetricValue(STABLE_KEY.heartRate), fontFamily, heroSize, valueWeight),
            )
            : 0;
        const heroUnitWidth = hasHeartRate ? measure(ctx, 'BPM', fontFamily, heroUnitSize, 600) : 0;
        const heroGroupWidth = heroValueWidth + (hasHeartRate ? unitGap + heroUnitWidth : 0);
        if (heroGroupWidth > blockW) continue;

        const fitsCells = supportItems.every((item) => {
            const labelWidth = labelVisible
                ? measure(ctx, labelFor(item), fontFamily, labelSize, labelWeight, labelTracking)
                : 0;
            const actualValueWidth = measure(ctx, item.value, fontFamily, valueSize, valueWeight);
            const stableValueWidth = measure(ctx, getStableMetricValue(STABLE_KEY[item.key]), fontFamily, valueSize, valueWeight);
            const valueWidth = Math.max(actualValueWidth, stableValueWidth);
            const unitWidth = measure(ctx, (item.unit ?? '').toUpperCase(), fontFamily, unitSize, 500);
            return labelWidth <= cellTextW && valueWidth + (item.unit ? unitGap + unitWidth : 0) <= cellTextW;
        });
        if (!fitsCells) continue;

        const blockTop = h - safePad - totalHeight;
        selected = {
            valueSize,
            heroSize,
            heroLabelSize,
            heroUnitSize,
            labelSize,
            unitSize,
            labelGap: rowLabelGap,
            heroGap,
            supportHeight,
            rowHeight,
            supportRowGap,
            blockTop,
            heroValueWidth,
            heroUnitWidth,
            heroGroupWidth,
            dividerGap,
        };
        break;
    }

    if (!selected) return;

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.strokeStyle = strokeColor;
    ctx.lineJoin = 'round';

    let supportTop = selected.blockTop;
    if (hasHeartRate) {
        if (labelVisible) {
            const labelY = supportTop;
            ctx.textAlign = 'left';
            ctx.fillStyle = accent;
            ctx.font = `${labelWeight} ${selected.heroLabelSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.heroLabelSize * 0.1, 1, 1.8);
            drawTrackedOutlined(ctx, 'HEART RATE', w - safePad - measure(ctx, 'HEART RATE', fontFamily,
                selected.heroLabelSize, labelWeight, labelTracking) / 2, labelY, labelTracking, selected.heroLabelSize);
            supportTop += selected.heroLabelSize + Math.max(3, Math.round(selected.valueSize * 0.2));
        }

        const heroValueY = supportTop;
        const actualValueWidth = measure(ctx, data.heartRate ?? '', fontFamily, selected.heroSize, valueWeight);
        const actualGroupWidth = actualValueWidth + unitGap + selected.heroUnitWidth;
        const heroLeft = w - safePad - actualGroupWidth;

        ctx.textAlign = 'left';
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${selected.heroSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.heroSize * 0.08, 1.5, 3.4);
        drawOutlined(ctx, data.heartRate ?? '', heroLeft, heroValueY, actualValueWidth);

        ctx.fillStyle = accent;
        ctx.font = `600 ${selected.heroUnitSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.heroUnitSize * 0.13, 1.2, 2.4);
        drawOutlined(ctx, 'BPM', heroLeft + actualValueWidth + unitGap,
            heroValueY + (selected.heroSize - selected.heroUnitSize) * 0.12, selected.heroUnitWidth);

        supportTop += selected.heroSize + selected.dividerGap;
        if (supportItems.length > 0) {
            const dividerY = supportTop - selected.dividerGap / 2;
            ctx.strokeStyle = 'rgba(249,115,22,0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(blockLeft, dividerY);
            ctx.lineTo(w - safePad, dividerY);
            ctx.stroke();
            ctx.strokeStyle = strokeColor;
        }
    }

    for (let index = 0; index < supportItems.length; index += 1) {
        const item = supportItems[index]!;
        const row = Math.floor(index / columns);
        const column = index % columns;
        const itemsInRow = Math.min(columns, supportItems.length - row * columns);
        const rowWidth = itemsInRow * cellW;
        const rowLeft = blockLeft + (blockW - rowWidth) / 2;
        const cellLeft = rowLeft + column * cellW;
        const centerX = cellLeft + cellW / 2;
        const rowTop = supportTop + row * (selected.rowHeight + selected.supportRowGap);

        if (labelVisible) {
            ctx.fillStyle = accent;
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.labelSize * 0.12, 1, 1.8);
            drawTrackedOutlined(ctx, labelFor(item), centerX, rowTop, labelTracking, selected.labelSize);
        }

        const valueY = rowTop + (labelVisible ? selected.labelSize + selected.labelGap : 0);
        const unit = (item.unit ?? '').toUpperCase();
        const valueWidth = measure(ctx, item.value, fontFamily, selected.valueSize, valueWeight);
        const unitWidth = measure(ctx, unit, fontFamily, selected.unitSize, 500);
        const actualGroupWidth = valueWidth + (unit ? unitGap + unitWidth : 0);
        const groupLeft = centerX - actualGroupWidth / 2;
        const valueMaxWidth = Math.max(0, Math.min(valueWidth, cellTextW - (unit ? unitGap + unitWidth : 0)));

        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.valueSize * 0.1, 1.2, 2.6);
        drawOutlined(ctx, item.value, groupLeft, valueY, valueMaxWidth);

        if (unit) {
            ctx.fillStyle = accent;
            ctx.font = `500 ${selected.unitSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.unitSize * 0.13, 1, 1.9);
            drawOutlined(ctx, unit, groupLeft + valueMaxWidth + unitGap,
                valueY + (selected.valueSize - selected.unitSize) * 0.12, unitWidth);
        }
    }

    ctx.restore();
}
