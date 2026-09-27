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

export function drawGlassPanel(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number; labelTrackingScale?: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const items = toStandardMetricItems(
        data,
        {
            pace: { label: 'PACE', unit: 'min/km' },
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DISTANCE', unit: 'km' },
            time: { label: 'ELAPSED', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['pace', 'heartRate', 'distance', 'time', 'power'],
    );
    if (items.length === 0) return;

    const fontFamily = config.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const textColor = config.textColor || '#f7fbff';
    const accentColor = config.accentColor || '#8fd3ff';
    const panelColor = config.backgroundColor || 'rgba(255,255,255,0.12)';
    const backgroundOpacity = finiteSetting(config.backgroundOpacity, 0.62, 0, 1);
    const borderColor = config.borderColor || 'rgba(225,242,255,0.62)';
    const borderWidth = finiteSetting(config.borderWidth, 1, 0, 4);
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.48, 0.3, 1.2);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.06, 0, 0.1)
        * finiteSetting(tuning.labelTrackingScale, 1, 0.5, 1.5);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.9, 1.8);
    const textScale = finiteSetting(tuning.textScale, 1, 0.5, 4);
    const requestedSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2.2, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.5, 0.5, 4)
        * textScale
        / 100;
    const startSize = clamp(requestedSize, 12, 56);
    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.08, h * 0.08));
    const availableW = Math.max(0, w - safePad * 2);
    const columns = w < 560
        ? Math.min(2, items.length)
        : h < 240
            ? Math.min(3, items.length)
            : orientation.isPortrait
                ? Math.min(3, items.length)
                : items.length;
    const rowCount = Math.ceil(items.length / columns);
    const colGap = clamp(orientation.shortSide * 0.018, 4, 18);
    const rowGap = clamp(orientation.shortSide * 0.014, 3, 16);
    const innerPadX = clamp(orientation.shortSide * 0.028, 9, 22);
    const innerPadY = clamp(orientation.shortSide * 0.025, 8, 20);
    const unitGap = 5;
    const outline = 'rgba(3,9,16,0.86)';

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        labelGap: number;
        itemHeight: number;
        rowGap: number;
        colGap: number;
        innerPadX: number;
        innerPadY: number;
        panelW: number;
        panelH: number;
        panelX: number;
        panelY: number;
        panelRadius: number;
        cellW: number;
        cellTextW: number;
    } | undefined;

    for (let valueSize = Math.floor(startSize); valueSize >= 7; valueSize -= 1) {
        const labelSize = labelVisible ? Math.max(8, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(8, Math.round(valueSize * 0.62));
        const labelGap = labelVisible ? Math.max(3, Math.round(valueSize * 0.18 * lineSpacing)) : 0;
        const itemHeight = (labelVisible ? labelSize + labelGap : 0) + Math.max(valueSize, unitSize);
        const rowLabelWidths = items.map((item) => labelVisible
            ? measure(ctx, item.label, fontFamily, labelSize, labelWeight, labelTracking)
            : 0);
        const rowValueWidths = items.map((item) => {
            const valueWidth = Math.max(
                measure(ctx, item.value, fontFamily, valueSize, valueWeight),
                measure(ctx, getStableMetricValue(STABLE_KEY[item.key]), fontFamily, valueSize, valueWeight),
            );
            const unit = (item.unit ?? '').toUpperCase();
            const unitWidth = measure(ctx, unit, fontFamily, unitSize, 500);
            return valueWidth + (unit ? unitGap + unitWidth : 0);
        });
        const cellTextW = Math.max(...rowLabelWidths.map((width, index) => Math.max(width, rowValueWidths[index] ?? 0)));
        const minimumPanelW = Math.min(availableW, Math.max(orientation.shortSide * 0.42, columns * 52));
        const panelW = Math.min(availableW, Math.max(
            minimumPanelW,
            (cellTextW + 10) * columns + colGap * (columns - 1) + innerPadX * 2,
        ));
        const cellW = Math.max(0, (panelW - innerPadX * 2 - colGap * (columns - 1)) / columns);
        const effectiveCellTextW = Math.max(0, cellW - Math.min(8, cellW * 0.08));
        if (cellTextW > effectiveCellTextW) continue;

        const panelH = innerPadY * 2
            + rowCount * itemHeight
            + Math.max(0, rowCount - 1) * rowGap;
        if (panelH > h - safePad * 2) continue;

        const panelX = (w - panelW) / 2;
        const panelY = h - safePad - panelH;
        const panelRadius = clamp(finiteSetting(config.cornerRadius, 18, 0, 48), 0, Math.min(panelH * 0.24, 34));
        selected = {
            valueSize,
            labelSize,
            unitSize,
            labelGap,
            itemHeight,
            rowGap,
            colGap,
            innerPadX,
            innerPadY,
            panelW,
            panelH,
            panelX,
            panelY,
            panelRadius,
            cellW,
            cellTextW: effectiveCellTextW,
        };
        break;
    }

    if (!selected) return;

    ctx.save();
    ctx.globalAlpha = backgroundOpacity;
    ctx.fillStyle = panelColor;
    ctx.beginPath();
    ctx.roundRect(selected.panelX, selected.panelY, selected.panelW, selected.panelH, selected.panelRadius);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (borderWidth > 0) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.beginPath();
        ctx.roundRect(selected.panelX, selected.panelY, selected.panelW, selected.panelH, selected.panelRadius);
        ctx.stroke();
    }

    const rowCounts = Array.from({ length: rowCount }, (_, row) => Math.min(columns, items.length - row * columns));
    ctx.textBaseline = 'top';
    ctx.strokeStyle = outline;
    ctx.lineJoin = 'round';

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        const row = Math.floor(index / columns);
        const column = index % columns;
        const itemsInRow = rowCounts[row] ?? columns;
        const rowWidth = itemsInRow * selected.cellW + (itemsInRow - 1) * selected.colGap;
        const rowLeft = selected.panelX + (selected.panelW - rowWidth) / 2;
        const cellLeft = rowLeft + column * (selected.cellW + selected.colGap);
        const centerX = cellLeft + selected.cellW / 2;
        const rowTop = selected.panelY + selected.innerPadY + row * (selected.itemHeight + selected.rowGap);

        if (labelVisible) {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#dcecf7';
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.labelSize * 0.1, 0.9, 1.6);
            drawTrackedOutlined(ctx, item.label, centerX, rowTop, labelTracking, selected.labelSize);
        }

        const valueY = rowTop + (labelVisible ? selected.labelSize + selected.labelGap : 0);
        const unit = (item.unit ?? '').toUpperCase();
        const valueWidth = measure(ctx, item.value, fontFamily, selected.valueSize, valueWeight);
        const unitWidth = measure(ctx, unit, fontFamily, selected.unitSize, 500);
        const groupWidth = valueWidth + (unit ? unitGap + unitWidth : 0);
        const groupLeft = centerX - groupWidth / 2;
        const valueMaxWidth = Math.max(0, Math.min(valueWidth, selected.cellTextW - (unit ? unitGap + unitWidth : 0)));

        ctx.textAlign = 'left';
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.valueSize * 0.1, 1, 2.4);
        drawOutlined(ctx, item.value, groupLeft, valueY, valueMaxWidth);

        if (unit) {
            ctx.fillStyle = accentColor;
            ctx.font = `500 ${selected.unitSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.unitSize * 0.11, 0.9, 1.8);
            drawOutlined(ctx, unit, groupLeft + valueMaxWidth + unitGap,
                valueY + (selected.valueSize - selected.unitSize) * 0.12, unitWidth);
        }
    }

    ctx.restore();
}
