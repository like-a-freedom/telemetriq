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

function displayLabel(key: MetricItemSpec['key']): string {
    switch (key) {
        case 'heartRate': return 'HR';
        case 'distance': return 'DIST';
        case 'time': return 'TIME';
        case 'power': return 'POWER';
        default: return 'PACE';
    }
}

function contrastingTagInk(background: string): string {
    let channels: number[] | undefined;
    const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(background.trim());
    if (hex) {
        const digits = hex[1]!;
        channels = digits.length === 3
            ? digits.split('').map((digit) => Number.parseInt(digit + digit, 16))
            : [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16));
    } else {
        const rgb = /^rgba?\(([^)]+)\)$/i.exec(background.trim());
        if (rgb) channels = rgb[1]!.split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number);
    }
    if (!channels || channels.length < 3 || channels.some((channel) => !Number.isFinite(channel))) return '#111923';

    const luminance = channels.slice(0, 3).reduce((total, channel, index) => {
        const value = channel / 255;
        const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        return total + linear * [0.2126, 0.7152, 0.0722][index]!;
    }, 0);
    return luminance > 0.42 ? '#111923' : '#f8fafc';
}

export function drawRaceTag(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const supportItems = toStandardMetricItems(
        data,
        {
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DIST', unit: 'km' },
            time: { label: 'TIME', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['heartRate', 'distance', 'time', 'power'],
    );
    if (!data.pace && supportItems.length === 0) return;

    const fontFamily = config.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const textColor = config.textColor || '#f8fafc';
    const accentColor = config.accentColor || '#f97316';
    const backgroundColor = config.backgroundColor || '#fffaf2';
    const backgroundOpacity = finiteSetting(config.backgroundOpacity, 0.98, 0, 1);
    const tagTextColor = backgroundOpacity < 0.45 ? '#f8fafc' : contrastingTagInk(backgroundColor);
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.46, 0.3, 1.2);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.06, 0, 0.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.9, 1.8);
    const textScale = finiteSetting(tuning.textScale, 1, 0.5, 4);
    const requestedSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2.6, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.9, 0.5, 4)
        * textScale
        / 100;
    const startSize = clamp(requestedSize, 12, 72);
    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.08, h * 0.08));
    const availableW = Math.max(0, w - safePad * 2);
    const badgePadXBase = clamp(orientation.shortSide * 0.022, 7, 22);
    const badgePadY = clamp(orientation.shortSide * 0.018, 7, 18);
    const columns = supportItems.length === 0
        ? 1
        : orientation.isPortrait || w < 560
            ? Math.min(2, supportItems.length)
            : supportItems.length;
    const rowCount = Math.ceil(supportItems.length / columns);
    const blockW = Math.min(availableW, Math.max(orientation.shortSide * 0.82, w * 0.72));
    const blockLeft = w - safePad - blockW;
    const cellW = supportItems.length > 0 ? blockW / columns : 0;
    const cellInset = clamp(orientation.shortSide * 0.008, 2, 10);
    const cellTextW = Math.max(0, cellW - cellInset * 2);
    const supportRowGap = clamp(orientation.shortSide * 0.014, 3, 16);
    const unitGap = 4;
    const strokeColor = 'rgba(3,9,16,0.9)';
    const paceUnit = 'MIN/KM';

    let selected: {
        valueSize: number;
        paceSize: number;
        paceLabelSize: number;
        paceUnitSize: number;
        labelSize: number;
        unitSize: number;
        labelGap: number;
        rowHeight: number;
        rowGap: number;
        supportTop: number;
        supportHeight: number;
        tagX: number;
        tagY: number;
        tagW: number;
        tagH: number;
        tagCut: number;
        tagPadX: number;
        tagLabelWidth: number;
        paceWidth: number;
        paceUnitWidth: number;
        dividerGap: number;
    } | undefined;

    for (let valueSize = Math.floor(startSize); valueSize >= 7; valueSize -= 1) {
        const paceSize = data.pace ? Math.max(14, Math.round(valueSize * 1.75)) : 0;
        const paceLabelSize = data.pace && labelVisible ? Math.max(8, Math.round(valueSize * 0.48)) : 0;
        const paceUnitSize = data.pace ? Math.max(9, Math.round(valueSize * 0.54)) : 0;
        const labelSize = labelVisible ? Math.max(8, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(8, Math.round(valueSize * 0.65));
        const rowLabelGap = labelVisible ? Math.max(3, Math.round(valueSize * 0.18 * lineSpacing)) : 0;
        const rowHeight = (labelVisible ? labelSize + rowLabelGap : 0) + valueSize;
        const supportHeight = rowCount > 0
            ? rowCount * rowHeight + Math.max(0, rowCount - 1) * supportRowGap
            : 0;
        const dividerGap = data.pace && supportItems.length > 0 ? Math.max(6, Math.round(valueSize * 0.4)) : 0;

        const tagPadX = Math.min(badgePadXBase, Math.max(7, availableW * 0.08));
        const tagLabelWidth = data.pace && labelVisible
            ? measure(ctx, 'PACE', fontFamily, paceLabelSize, labelWeight, labelTracking)
            : 0;
        const paceWidth = data.pace ? measure(ctx, data.pace, fontFamily, paceSize, valueWeight) : 0;
        const paceStableWidth = data.pace
            ? measure(ctx, getStableMetricValue(STABLE_KEY.pace), fontFamily, paceSize, valueWeight)
            : 0;
        const paceUnitWidth = data.pace ? measure(ctx, paceUnit, fontFamily, paceUnitSize, 600, 0.04) : 0;
        const tagTextWidth = Math.max(tagLabelWidth, paceWidth, paceStableWidth, paceUnitWidth);
        const tagH = data.pace
            ? badgePadY * 2
                + (labelVisible ? paceLabelSize + Math.max(3, Math.round(valueSize * 0.14)) : 0)
                + paceSize
                + Math.max(3, Math.round(valueSize * 0.1))
                + paceUnitSize
            : 0;
        const tagW = data.pace ? tagTextWidth + tagPadX * 2 : 0;
        const tagX = safePad;
        const tagY = safePad;
        const tagCut = clamp(tagH * 0.15, 8, Math.min(tagW * 0.18, 26));
        if (tagW > availableW) continue;

        const supportTop = h - safePad - supportHeight;
        const tagBottom = data.pace ? tagY + tagH : safePad;
        const betweenGap = data.pace && supportItems.length > 0 ? Math.max(8, orientation.shortSide * 0.035) : 0;
        if (supportTop < safePad || (data.pace && supportItems.length > 0 && tagBottom + betweenGap > supportTop)) continue;

        const fitsSupport = supportItems.every((item) => {
            const labelWidth = labelVisible
                ? measure(ctx, displayLabel(item.key), fontFamily, labelSize, labelWeight, labelTracking)
                : 0;
            const valueWidth = Math.max(
                measure(ctx, item.value, fontFamily, valueSize, valueWeight),
                measure(ctx, getStableMetricValue(STABLE_KEY[item.key]), fontFamily, valueSize, valueWeight),
            );
            const unit = (item.unit ?? '').toUpperCase();
            const unitWidth = measure(ctx, unit, fontFamily, unitSize, 500);
            return labelWidth <= cellTextW && valueWidth + (unit ? unitGap + unitWidth : 0) <= cellTextW;
        });
        if (!fitsSupport) continue;

        selected = {
            valueSize,
            paceSize,
            paceLabelSize,
            paceUnitSize,
            labelSize,
            unitSize,
            labelGap: rowLabelGap,
            rowHeight,
            rowGap: supportRowGap,
            supportTop,
            supportHeight,
            tagX,
            tagY,
            tagW,
            tagH,
            tagCut,
            tagPadX,
            tagLabelWidth,
            paceWidth: Math.max(paceWidth, paceStableWidth),
            paceUnitWidth,
            dividerGap,
        };
        break;
    }

    if (!selected) return;

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;

    if (data.pace) {
        ctx.globalAlpha = backgroundOpacity;
        ctx.fillStyle = backgroundColor;
        ctx.beginPath();
        ctx.moveTo(selected.tagX, selected.tagY);
        ctx.lineTo(selected.tagX + selected.tagW, selected.tagY);
        ctx.lineTo(selected.tagX + selected.tagW, selected.tagY + selected.tagH - selected.tagCut);
        ctx.lineTo(selected.tagX + selected.tagW - selected.tagCut, selected.tagY + selected.tagH);
        ctx.lineTo(selected.tagX, selected.tagY + selected.tagH);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        const borderWidth = finiteSetting(config.borderWidth, 0, 0, 8);
        if (borderWidth > 0 && config.borderColor && config.borderColor !== 'transparent') {
            ctx.strokeStyle = config.borderColor;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
            ctx.strokeStyle = strokeColor;
        }

        let textY = selected.tagY + badgePadY;
        if (labelVisible) {
            ctx.textAlign = 'left';
            ctx.fillStyle = accentColor;
            ctx.font = `${labelWeight} ${selected.paceLabelSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.paceLabelSize * 0.08, 0.8, 1.5);
            drawTrackedOutlined(ctx, 'PACE', selected.tagX + selected.tagPadX + selected.tagLabelWidth / 2,
                textY, labelTracking, selected.paceLabelSize);
            textY += selected.paceLabelSize + Math.max(3, Math.round(selected.valueSize * 0.14));
        }

        const actualPaceWidth = measure(ctx, data.pace, fontFamily, selected.paceSize, valueWeight);
        ctx.textAlign = 'left';
        ctx.fillStyle = tagTextColor;
        ctx.font = `${valueWeight} ${selected.paceSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.paceSize * 0.05, 0.8, 1.8);
        drawOutlined(ctx, data.pace, selected.tagX + selected.tagPadX, textY, actualPaceWidth);
        textY += selected.paceSize + Math.max(3, Math.round(selected.valueSize * 0.1));

        ctx.fillStyle = accentColor;
        ctx.font = `600 ${selected.paceUnitSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(selected.paceUnitSize * 0.08, 0.8, 1.4);
        drawTrackedOutlined(ctx, paceUnit, selected.tagX + selected.tagPadX + selected.paceUnitWidth / 2,
            textY, 0.04, selected.paceUnitSize);
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
        const rowTop = selected.supportTop + row * (selected.rowHeight + selected.rowGap);

        if (labelVisible) {
            ctx.textAlign = 'left';
            ctx.fillStyle = accentColor;
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = clamp(selected.labelSize * 0.11, 0.9, 1.6);
            drawTrackedOutlined(ctx, displayLabel(item.key), centerX, rowTop, labelTracking, selected.labelSize);
        }

        const unit = (item.unit ?? '').toUpperCase();
        const valueWidth = measure(ctx, item.value, fontFamily, selected.valueSize, valueWeight);
        const unitWidth = measure(ctx, unit, fontFamily, selected.unitSize, 500);
        const renderedGroupWidth = valueWidth + (unit ? unitGap + unitWidth : 0);
        const groupLeft = centerX - renderedGroupWidth / 2;
        const valueMaxWidth = Math.max(0, Math.min(valueWidth, cellTextW - (unit ? unitGap + unitWidth : 0)));
        const valueY = rowTop + (labelVisible ? selected.labelSize + selected.labelGap : 0);

        ctx.textAlign = 'left';
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = clamp(selected.valueSize * 0.09, 1, 2.2);
        drawOutlined(ctx, item.value, groupLeft, valueY, valueMaxWidth);

        if (unit) {
            ctx.fillStyle = accentColor;
            ctx.font = `500 ${selected.unitSize}px ${fontFamily}`;
            ctx.lineWidth = clamp(selected.unitSize * 0.1, 0.9, 1.8);
            drawOutlined(ctx, unit, groupLeft + valueMaxWidth + unitGap,
                valueY + (selected.valueSize - selected.unitSize) * 0.12, unitWidth);
        }
    }

    ctx.restore();
}
