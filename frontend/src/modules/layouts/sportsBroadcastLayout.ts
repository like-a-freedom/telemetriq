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
    centerX: number,
    y: number,
    trackingEm: number,
    fontSize: number,
): void {
    const width = measureTrackedTextWidth(ctx, text, trackingEm, fontSize);
    let cursorX = centerX - width / 2;
    const spacing = fontSize * trackingEm;
    for (const char of text) {
        ctx.fillText(char, cursorX, y);
        cursorX += ctx.measureText(char).width + spacing;
    }
}

export function drawSportsBroadcast(
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
            pace: { label: 'PACE', unit: 'min/km' },
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DIST', unit: 'km' },
            time: { label: 'TIME', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['pace', 'heartRate', 'distance', 'time', 'power'],
    );
    if (items.length === 0) return;

    const accent = config.accentColor || '#f97316';
    const background = config.backgroundColor || '#0b1118';
    const textColor = config.textColor || '#ffffff';
    const fontFamily = config.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const backgroundOpacity = finiteSetting(config.backgroundOpacity, 0.88, 0, 1);
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelWeight = 400;
    const unitWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.46, 0.25, 1.2);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.08, 0, 0.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.2, 0.8, 1.8);
    const textScale = finiteSetting(tuning.textScale, 1, 0.5, 4);
    const barHeight = Math.min(h * 0.42, Math.max(42, h * (orientation.isPortrait ? 0.12 : 0.1)));
    const accentLineHeight = clamp(Math.round(barHeight * 0.045), 2, 4);
    const barY = h - barHeight - accentLineHeight;
    const panelY = barY + accentLineHeight;
    const sideTagWidth = w >= 240 ? clamp(Math.round(barHeight * 0.34), 18, Math.min(36, w * 0.12)) : 0;
    const contentX = sideTagWidth;
    const contentWidth = Math.max(0, w - contentX);
    const columns = orientation.isPortrait || contentWidth / items.length < 56
        ? Math.max(1, Math.ceil(Math.sqrt(items.length)))
        : items.length;
    const rows = Math.ceil(items.length / columns);
    const columnWidth = contentWidth / columns;
    const textWidth = Math.max(0, columnWidth - Math.min(4, orientation.shortSide * 0.01));
    const rowGap = Math.max(3, orientation.shortSide * 0.012);
    const configuredValueSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.5, 0.5, 4)
        * textScale
        / 100;
    const startValueSize = Math.min(64, barHeight * 0.44, Math.max(12, configuredValueSize));

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        labelGap: number;
        unitGap: number;
        rowPadding: number;
        contentHeight: number;
        rowStep: number;
    } | undefined;

    for (let valueSize = Math.floor(startValueSize); valueSize >= 7; valueSize -= 1) {
        const labelSize = labelVisible ? Math.max(7, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(7, Math.round(valueSize * 0.44));
        const labelGap = labelVisible ? Math.max(1, Math.round(valueSize * Math.max(0.05, lineSpacing - 0.8) * 0.12)) : 0;
        const unitGap = Math.max(1, Math.round(valueSize * Math.max(0.05, lineSpacing - 0.8) * 0.12));
        const hasUnits = items.some((item) => Boolean(item.unit));
        const contentHeight = (labelVisible ? labelSize + labelGap : 0)
            + valueSize
            + (hasUnits ? unitGap + unitSize : 0);
        const rowPadding = Math.max(2, Math.round(valueSize * 0.12));
        const rowStep = contentHeight + rowPadding * 2 + rowGap;
        const totalHeight = rows * (contentHeight + rowPadding * 2) + (rows - 1) * rowGap;
        if (totalHeight > barHeight) continue;

        const fitsWidth = items.every((item) => {
            const stableValue = getStableMetricValue(STABLE_KEY[item.key]);
            const valueWidth = Math.max(
                measureText(ctx, item.value, fontFamily, valueSize, valueWeight),
                measureText(ctx, stableValue, fontFamily, valueSize, valueWeight),
            );
            const labelWidth = labelVisible
                ? measureText(ctx, item.label, fontFamily, labelSize, labelWeight, labelTracking)
                : 0;
            const unitWidth = measureText(ctx, item.unit ?? '', fontFamily, unitSize, unitWeight);
            return valueWidth <= textWidth && labelWidth <= textWidth && unitWidth <= textWidth;
        });
        if (!fitsWidth) continue;

        selected = { valueSize, labelSize, unitSize, labelGap, unitGap, rowPadding, contentHeight, rowStep };
        break;
    }

    if (!selected) return;

    ctx.save();
    ctx.globalAlpha = backgroundOpacity;
    ctx.fillStyle = background;
    ctx.fillRect(0, panelY, w, barHeight);
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.fillRect(0, barY, w, accentLineHeight);
    if (sideTagWidth > 0) {
        ctx.fillStyle = accent;
        ctx.fillRect(0, panelY, sideTagWidth, barHeight);
        ctx.fillStyle = '#111111';
        ctx.font = `700 ${Math.min(12, Math.max(7, Math.round(sideTagWidth * 0.38)))}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RUN', sideTagWidth / 2, panelY + barHeight / 2);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (let index = 1; index < columns; index += 1) {
        const dividerX = contentX + columnWidth * index;
        ctx.beginPath();
        ctx.moveTo(dividerX, panelY + barHeight * 0.12);
        ctx.lineTo(dividerX, panelY + barHeight * 0.88);
        ctx.stroke();
    }
    for (let index = 1; index < rows; index += 1) {
        const dividerY = panelY + barHeight / 2 + (index - rows / 2) * selected.rowStep;
        ctx.beginPath();
        ctx.moveTo(contentX + 4, dividerY);
        ctx.lineTo(w - 4, dividerY);
        ctx.stroke();
    }

    const totalHeight = rows * (selected.contentHeight + selected.rowPadding * 2) + (rows - 1) * rowGap;
    const firstRowY = panelY + (barHeight - totalHeight) / 2 + selected.rowPadding;
    if (config.textShadow && config.textShadowColor) {
        ctx.shadowColor = config.textShadowColor;
        ctx.shadowBlur = finiteSetting(config.textShadowBlur, 2, 0, 12);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(1, selected.valueSize * 0.04);
    } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        const column = index % columns;
        const row = Math.floor(index / columns);
        const centerX = contentX + columnWidth * (column + 0.5);
        const textY = firstRowY + row * selected.rowStep;
        let lineY = textY;

        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        if (labelVisible) {
            ctx.fillStyle = 'rgba(255,255,255,0.78)';
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            drawTrackedLabel(ctx, item.label, centerX, lineY, labelTracking, selected.labelSize);
            lineY += selected.labelSize + selected.labelGap;
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.fillText(item.value, centerX, lineY, textWidth);
        lineY += selected.valueSize;

        if (item.unit) {
            lineY += selected.unitGap;
            ctx.fillStyle = accent;
            ctx.font = `${unitWeight} ${selected.unitSize}px ${fontFamily}`;
            ctx.fillText(item.unit, centerX, lineY, textWidth);
        }
    }
    ctx.restore();
}
