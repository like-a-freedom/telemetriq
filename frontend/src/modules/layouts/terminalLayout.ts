import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    clamp,
    fontWeightValue,
    getStableMetricValue,
    measureTrackedTextWidth,
} from '../overlayUtils';
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

function drawTracked(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    tracking: number,
    size: number,
): void {
    const spacing = size * tracking;
    let cursorX = x;
    for (const char of text) {
        ctx.fillText(char, cursorX, y);
        cursorX += ctx.measureText(char).width + spacing;
    }
}

function metricLabel(key: MetricItemSpec['key']): string {
    switch (key) {
        case 'heartRate': return 'HR';
        case 'distance': return 'DIST';
        case 'time': return 'TIME';
        case 'power': return 'POWER';
        default: return 'PACE';
    }
}

export function drawTerminal(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const rows = toStandardMetricItems(
        data,
        {
            pace: { label: 'PACE', unit: 'min/km' },
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DIST', unit: 'km' },
            time: { label: 'TIME', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['pace', 'heartRate', 'distance', 'time', 'power'],
    );
    if (rows.length === 0) return;

    const fontFamily = config.fontFamily || 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    const textColor = config.textColor || '#e9f5ee';
    const accentColor = config.accentColor || '#39d98a';
    const backgroundColor = config.backgroundColor || '#050907';
    const backgroundOpacity = finiteSetting(config.backgroundOpacity, 0.92, 0, 1);
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelWeight = 400;
    const headerWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.04, 0, 0.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.2, 0.9, 1.8);
    const valueMultiplier = finiteSetting(config.valueSizeMultiplier, 1.1, 0.5, 4);
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.78, 0.5, 1.4);
    const textScale = finiteSetting(tuning.textScale, 1, 0.5, 4);
    const requestedSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2, 0.5, 8)
        * valueMultiplier
        * textScale
        / 100;
    const startSize = clamp(requestedSize, 10, 56);
    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.08, h * 0.08));
    const maxPanelW = Math.max(0, w - safePad * 2);
    const maxPanelH = Math.max(0, h - safePad * 2);
    const innerPadX = clamp(startSize * 0.9, 8, 20);
    const innerPadY = clamp(startSize * 0.68, 7, 16);
    const labelColumnText = rows.map((row) => metricLabel(row.key));
    const headerText = '// GPS TELEMETRY';

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        headerSize: number;
        lineHeight: number;
        labelColumnWidth: number;
        promptWidth: number;
        separatorWidth: number;
        contentWidth: number;
        panelW: number;
        panelH: number;
    } | undefined;

    for (let valueSize = Math.floor(startSize); valueSize >= 7; valueSize -= 1) {
        const labelSize = labelVisible ? Math.max(8, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(8, Math.round(valueSize * 0.78));
        const headerSize = Math.max(8, Math.round(valueSize * 0.72));
        const lineHeight = Math.max(valueSize, labelSize, unitSize) * lineSpacing;
        const headerGap = Math.max(5, valueSize * 0.52);
        const panelH = innerPadY * 2 + headerSize + headerGap + rows.length * lineHeight;
        if (panelH > maxPanelH) continue;

        const promptWidth = measure(ctx, labelVisible ? '› ' : '› ', fontFamily, labelVisible ? labelSize : valueSize, labelVisible ? labelWeight : valueWeight);
        const labelColumnWidth = labelVisible
            ? Math.max(...labelColumnText.map((label) => measure(ctx, label, fontFamily, labelSize, labelWeight, labelTracking)))
            : 0;
        const separatorWidth = labelVisible ? measure(ctx, ' = ', fontFamily, labelSize, labelWeight) : 0;
        const widestRow = rows.reduce((maxWidth, row) => {
            const stableValue = getStableMetricValue(STABLE_KEY[row.key]);
            const actualWidth = measure(ctx, row.value, fontFamily, valueSize, valueWeight);
            const stableWidth = measure(ctx, stableValue, fontFamily, valueSize, valueWeight);
            const unitWidth = measure(ctx, row.unit ?? '', fontFamily, unitSize, 400);
            const unitGap = row.unit ? measure(ctx, ' ', fontFamily, unitSize, 400) : 0;
            const rowWidth = promptWidth + labelColumnWidth + separatorWidth
                + Math.max(actualWidth, stableWidth) + unitGap + unitWidth;
            return Math.max(maxWidth, rowWidth);
        }, 0);
        const headerWidth = measure(ctx, headerText, fontFamily, headerSize, headerWeight, 0.06);
        const contentWidth = Math.max(widestRow, headerWidth);
        const panelW = contentWidth + innerPadX * 2;
        if (panelW > maxPanelW) continue;

        selected = {
            valueSize,
            labelSize,
            unitSize,
            headerSize,
            lineHeight,
            labelColumnWidth,
            promptWidth,
            separatorWidth,
            contentWidth,
            panelW,
            panelH,
        };
        break;
    }

    if (!selected) return;

    const panelX = safePad;
    const panelY = safePad;
    const radius = clamp(finiteSetting(config.cornerRadius, 5, 0, orientation.shortSide * 0.06), 0, 24);
    ctx.save();
    ctx.globalAlpha = backgroundOpacity;
    ctx.fillStyle = backgroundColor;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, selected.panelW, selected.panelH, radius);
    ctx.fill();
    ctx.globalAlpha = 1;

    const borderWidth = finiteSetting(config.borderWidth, 1, 0, 8);
    if (borderWidth > 0 && config.borderColor && config.borderColor !== 'transparent') {
        ctx.strokeStyle = config.borderColor;
        ctx.lineWidth = borderWidth;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, selected.panelW, selected.panelH, radius);
        ctx.stroke();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const contentX = panelX + innerPadX;
    const headerY = panelY + innerPadY;
    ctx.fillStyle = accentColor;
    ctx.font = `${headerWeight} ${selected.headerSize}px ${fontFamily}`;
    drawTracked(ctx, headerText, contentX, headerY, 0.06, selected.headerSize);

    const rowsTop = headerY + selected.headerSize + Math.max(5, selected.valueSize * 0.52);
    const promptSize = labelVisible ? selected.labelSize : selected.valueSize;
    const promptX = contentX;
    const keyX = promptX + selected.promptWidth;
    const separatorX = keyX + selected.labelColumnWidth;
    const valueX = separatorX + selected.separatorWidth;

    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index]!;
        const y = rowsTop + index * selected.lineHeight;

        ctx.fillStyle = accentColor;
        ctx.font = `${labelVisible ? labelWeight : valueWeight} ${promptSize}px ${fontFamily}`;
        ctx.fillText('› ', promptX, y);

        if (labelVisible) {
            ctx.fillStyle = '#b7cdc0';
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            drawTracked(ctx, metricLabel(row.key), keyX, y, labelTracking, selected.labelSize);

            ctx.fillStyle = '#b7cdc0';
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            ctx.fillText(' = ', separatorX, y);
        }

        const unitGap = row.unit ? measure(ctx, ' ', fontFamily, selected.unitSize, 400) : 0;
        const valueWidth = measure(ctx, row.value, fontFamily, selected.valueSize, valueWeight);
        const unitWidth = measure(ctx, row.unit ?? '', fontFamily, selected.unitSize, 400);
        const valueMaxWidth = Math.max(0, Math.min(
            valueWidth,
            selected.contentWidth - (valueX - contentX) - unitGap - unitWidth,
        ));
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.fillText(row.value, valueX, y, valueMaxWidth);

        if (row.unit) {
            const unitX = valueX + valueMaxWidth + unitGap;
            ctx.fillStyle = '#8fb09e';
            ctx.font = `400 ${selected.unitSize}px ${fontFamily}`;
            const unitMaxWidth = Math.max(0, panelX + selected.panelW - innerPadX - unitX);
            ctx.fillText(row.unit, unitX, y + (selected.valueSize - selected.unitSize) * 0.15, unitMaxWidth);
        }
    }

    ctx.restore();
}
