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

function displayLabel(item: MetricItemSpec, compact: boolean): string {
    if (!compact) return item.label;
    switch (item.key) {
        case 'heartRate': return 'HR';
        case 'distance': return 'DIST';
        case 'time': return 'TIME';
        case 'power': return 'PWR';
        default: return 'PACE';
    }
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
    const spacing = fontSize * trackingEm;
    let cursorX = centerX - width / 2;
    for (const char of text) {
        ctx.fillText(char, cursorX, y);
        cursorX += ctx.measureText(char).width + spacing;
    }
}

export function drawCockpitHud(
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
            heartRate: { label: 'HEART RATE', unit: 'bpm' },
            distance: { label: 'DISTANCE', unit: 'km' },
            time: { label: 'ELAPSED', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['pace', 'heartRate', 'distance', 'time', 'power'],
    );
    if (items.length === 0) return;

    const accent = config.accentColor || '#ff7a1a';
    const background = config.backgroundColor || '#080d14';
    const textColor = config.textColor || '#ffffff';
    const fontFamily = config.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const backgroundOpacity = finiteSetting(config.backgroundOpacity, 0.9, 0, 1);
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelWeight = 400;
    const unitWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.46, 0.25, 1.2);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.08, 0, 0.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.8, 1.8);
    const textScale = finiteSetting(tuning.textScale, 1, 0.5, 4);

    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.12, h * 0.12));
    const panelX = safePad;
    const panelW = Math.max(0, w - safePad * 2);
    const panelH = h < 240
        ? Math.min(h * 0.55, Math.max(54, orientation.shortSide * 0.36))
        : orientation.isPortrait
            ? Math.min(h * 0.36, Math.max(120, orientation.shortSide * 0.38))
            : Math.min(h * 0.34, Math.max(110, orientation.shortSide * 0.21));
    const panelY = h - safePad - panelH;
    const innerPad = clamp(panelW * 0.026, 8, 24);
    const verticalPad = clamp(panelH * 0.04, 3, 14);
    const headerH = clamp(panelH * 0.22, 14, 30);
    const contentX = panelX + innerPad;
    const contentW = Math.max(0, panelW - innerPad * 2);
    const columns = orientation.isPortrait || contentW / items.length < 56
        ? Math.max(1, Math.ceil(Math.sqrt(items.length)))
        : items.length;
    const rows = Math.ceil(items.length / columns);
    const columnW = contentW / columns;
    const compactLabels = columnW < 112;
    const textW = Math.max(0, columnW - Math.min(6, orientation.shortSide * 0.014));
    const metricAreaTop = panelY + headerH + verticalPad * 0.35;
    const metricAreaBottom = panelY + panelH - verticalPad;
    const metricAreaH = Math.max(0, metricAreaBottom - metricAreaTop);
    const rowGap = clamp(orientation.shortSide * 0.012, 3, 12);
    const configuredValueSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2.2, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.5, 0.5, 4)
        * textScale
        / 100;
    const startValueSize = Math.min(64, Math.max(12, configuredValueSize));

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        labelGap: number;
        unitGap: number;
    } | undefined;

    for (let valueSize = Math.floor(startValueSize); valueSize >= 7; valueSize -= 1) {
        const labelSize = labelVisible ? Math.max(7, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(8, Math.round(valueSize * 0.42));
        const lineGap = Math.max(2, Math.round(valueSize * Math.max(0.05, lineSpacing - 0.8) * 0.12));
        const labelGap = labelVisible ? lineGap : 0;
        const unitGap = lineGap;
        const hasUnits = items.some((item) => Boolean(item.unit));
        const contentHeight = (labelVisible ? labelSize + labelGap : 0)
            + valueSize
            + (hasUnits ? unitGap + unitSize : 0);
        const rowPadding = clamp(Math.round(panelH * 0.025), 2, 8);
        const totalGridHeight = rows * (contentHeight + rowPadding * 2) + (rows - 1) * rowGap;
        if (totalGridHeight > metricAreaH) continue;

        const fitsWidth = items.every((item) => {
            const stableValue = getStableMetricValue(STABLE_KEY[item.key]);
            const valueWidth = Math.max(
                measureText(ctx, item.value, fontFamily, valueSize, valueWeight),
                measureText(ctx, stableValue, fontFamily, valueSize, valueWeight),
            );
            const labelWidth = labelVisible
                ? measureText(ctx, displayLabel(item, compactLabels), fontFamily, labelSize, labelWeight, labelTracking)
                : 0;
            const unitWidth = measureText(ctx, item.unit ?? '', fontFamily, unitSize, unitWeight);
            return valueWidth <= textW && labelWidth <= textW && unitWidth <= textW;
        });
        if (!fitsWidth) continue;

        selected = { valueSize, labelSize, unitSize, labelGap, unitGap };
        break;
    }

    if (!selected) return;

    const radius = clamp(panelH * 0.12, 10, 22);
    ctx.save();
    ctx.globalAlpha = backgroundOpacity;
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, radius);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, radius);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.88;
    ctx.fillRect(panelX + radius, panelY, Math.max(0, panelW - radius * 2), 2);
    ctx.globalAlpha = 1;

    const headerCenterY = panelY + headerH / 2;
    const dotRadius = clamp(headerH * 0.11, 2, 4);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(panelX + innerPad + dotRadius, headerCenterY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,236,224,0.9)';
    ctx.font = `600 ${clamp(Math.round(headerH * 0.42), 8, 12)}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('LIVE RUN', panelX + innerPad + dotRadius * 2 + 7, headerCenterY);

    const headerDividerY = panelY + headerH;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(contentX, headerDividerY);
    ctx.lineTo(panelX + panelW - innerPad, headerDividerY);
    ctx.stroke();

    for (let index = 1; index < columns; index += 1) {
        const dividerX = contentX + columnW * index;
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.beginPath();
        ctx.moveTo(dividerX, metricAreaTop + 2);
        ctx.lineTo(dividerX, metricAreaBottom - 2);
        ctx.stroke();
    }
    for (let index = 1; index < rows; index += 1) {
        const dividerY = metricAreaTop + metricAreaH / rows * index;
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.beginPath();
        ctx.moveTo(contentX, dividerY);
        ctx.lineTo(panelX + panelW - innerPad, dividerY);
        ctx.stroke();
    }

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

    const cellHeight = metricAreaH / rows;
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        const row = Math.floor(index / columns);
        const column = index % columns;
        const centerX = contentX + columnW * (column + 0.5);
        const blockHeight = (labelVisible ? selected.labelSize + selected.labelGap : 0)
            + selected.valueSize + (item.unit ? selected.unitGap + selected.unitSize : 0);
        let textY = metricAreaTop + cellHeight * (row + 0.5) - blockHeight / 2;

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        if (labelVisible) {
            ctx.fillStyle = 'rgba(206,218,233,0.82)';
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            drawTrackedLabel(ctx, displayLabel(item, compactLabels), centerX, textY + selected.labelSize / 2, labelTracking, selected.labelSize);
            textY += selected.labelSize + selected.labelGap;
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.fillText(item.value, centerX, textY + selected.valueSize / 2, textW);
        textY += selected.valueSize;

        if (item.unit) {
            textY += selected.unitGap;
            ctx.fillStyle = accent;
            ctx.font = `${unitWeight} ${selected.unitSize}px ${fontFamily}`;
            ctx.fillText(item.unit.toUpperCase(), centerX, textY + selected.unitSize / 2, textW);
        }
    }
    ctx.restore();
}
