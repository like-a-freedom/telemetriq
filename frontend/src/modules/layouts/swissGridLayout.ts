import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    clamp,
    fontWeightValue,
    getStableMetricValue,
    measureTrackedTextWidth,
} from '../overlayUtils';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';
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

function drawTrackedTextWithOutline(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    trackingEm: number,
    fontSize: number,
    outline: boolean,
): void {
    const spacing = fontSize * trackingEm;
    let cursorX = x;
    for (const char of text) {
        if (outline) ctx.strokeText(char, cursorX, y);
        ctx.fillText(char, cursorX, y);
        cursorX += ctx.measureText(char).width + spacing;
    }
}

export function drawSwissGrid(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 40) return;

    const items = toStandardMetricItems(
        data,
        {
            pace: { label: 'PACE', unit: 'min/km' },
            heartRate: { label: 'HEART RATE', unit: 'bpm' },
            distance: { label: 'DISTANCE', unit: 'km' },
            time: { label: 'TIME', unit: '' },
        },
        ['pace', 'heartRate', 'distance', 'time'],
    );
    if (items.length === 0) return;

    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.12, h * 0.12));
    const contentWidth = Math.max(0, w - safePad * 2);
    const columnWidth = contentWidth / items.length;
    const horizontalInset = Math.min(columnWidth * 0.12, Math.max(4, orientation.shortSide * 0.02));
    const textWidth = Math.max(0, columnWidth - horizontalInset * 2);
    if (textWidth <= 0) return;

    const maxPanelHeight = Math.min(h * 0.36, orientation.shortSide * 0.4);
    const maxValueSize = Math.min(64, maxPanelHeight * 0.48);
    if (maxValueSize < 7) return;

    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const valueWeight = fontWeightValue(config.valueFontWeight || 'normal');
    const labelWeight = 500;
    const unitWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.62, 0.25, 1.2);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.08, 0, 0.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.8, 1.8);
    const configuredSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 1.95, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.1, 0.5, 4)
        * Math.max(0.5, tuning.textScale)
        / 100;
    const minValueSize = Math.min(14, maxValueSize);
    const startValueSize = Math.min(maxValueSize, Math.max(minValueSize, Math.round(configuredSize)));

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        labelTracking: number;
        labelGap: number;
        unitGap: number;
        panelPadding: number;
        panelHeight: number;
        contentHeight: number;
    } | undefined;

    for (let valueSize = Math.floor(startValueSize); valueSize >= 7; valueSize -= 1) {
        const labelSize = labelVisible
            ? Math.min(valueSize, Math.max(Math.min(8, valueSize), Math.round(valueSize * Math.min(labelMultiplier, 0.72))))
            : 0;
        const unitSize = Math.max(Math.min(8, valueSize), Math.round(valueSize * 0.54));
        const labelTrackingAtSize = labelTracking;
        const labelGap = labelVisible ? Math.max(1, Math.round(valueSize * (lineSpacing - 0.85) * 0.14)) : 0;
        const unitGap = Math.max(1, Math.round(valueSize * (lineSpacing - 0.8) * 0.14));
        const panelPadding = Math.max(4, Math.round(valueSize * 0.34));
        const compactLabels = columnWidth < 112;

        const widths = items.map((item) => {
            const stableValue = getStableMetricValue(STABLE_KEY[item.key]);
            const valueWidth = Math.max(
                measureText(ctx, item.value, fontFamily, valueSize, valueWeight),
                measureText(ctx, stableValue, fontFamily, valueSize, valueWeight),
            );
            const visibleLabel = compactLabels
                ? ({ pace: 'PACE', heartRate: 'HR', distance: 'DIST', time: 'TIME', power: 'POWER' } as const)[item.key]
                : item.label;
            const labelWidth = measureText(ctx, visibleLabel, fontFamily, labelSize, labelWeight, labelTrackingAtSize);
            const unitWidth = measureText(ctx, item.unit ?? '', fontFamily, unitSize, unitWeight);
            return { valueWidth, labelWidth, unitWidth };
        });
        if (widths.some(({ valueWidth, labelWidth, unitWidth }) =>
            valueWidth > textWidth || (labelVisible && labelWidth > textWidth) || unitWidth > textWidth,
        )) continue;

        const contentHeight = (labelVisible ? labelSize + labelGap : 0)
            + valueSize
            + (items.some((item) => item.unit) ? unitGap + unitSize : 0);
        const panelHeight = contentHeight + panelPadding * 2;
        if (panelHeight > maxPanelHeight || panelHeight > h - safePad) continue;

        selected = {
            valueSize,
            labelSize,
            unitSize,
            labelTracking: labelTrackingAtSize,
            labelGap,
            unitGap,
            panelPadding,
            panelHeight,
            contentHeight,
        };
        break;
    }
    if (!selected) return;

    const panelY = h - selected.panelHeight;
    ctx.save();
    ctx.globalAlpha = 0.44;
    ctx.strokeStyle = config.accentColor || '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, panelY);
    ctx.lineTo(w, panelY);
    ctx.stroke();

    if (items.length > 1) {
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#ffffff';
        for (let index = 1; index < items.length; index += 1) {
            const dividerX = safePad + columnWidth * index;
            ctx.beginPath();
            ctx.moveTo(dividerX, panelY + selected.panelPadding * 0.65);
            ctx.lineTo(dividerX, h - selected.panelPadding * 0.65);
            ctx.stroke();
        }
    }
    ctx.restore();

    const contentTop = panelY + (selected.panelHeight - selected.contentHeight) / 2;
    const textColor = config.textColor || '#ffffff';
    const labelColor = config.accentColor || textColor;
    const outlined = Boolean(config.textShadow && config.textShadowColor);
    if (outlined) {
        ctx.shadowColor = config.textShadowColor;
        ctx.shadowBlur = config.textShadowBlur || 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(1, selected.valueSize * 0.06);
    } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        const columnX = safePad + columnWidth * index;
        const centerX = columnX + columnWidth / 2;
        const compactLabels = columnWidth < 112;
        const label = compactLabels
            ? ({ pace: 'PACE', heartRate: 'HR', distance: 'DIST', time: 'TIME', power: 'POWER' } as const)[item.key]
            : item.label;
        let textY = contentTop;

        if (labelVisible) {
            const labelWidth = measureText(ctx, label, fontFamily, selected.labelSize, labelWeight, selected.labelTracking);
            ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = labelColor;
            ctx.strokeStyle = 'rgba(0,0,0,0.72)';
            ctx.lineWidth = Math.max(1, Math.min(1.5, selected.labelSize * 0.1));
            drawTrackedTextWithOutline(
                ctx,
                label,
                centerX - labelWidth / 2,
                textY,
                selected.labelTracking,
                selected.labelSize,
                outlined,
            );
            textY += selected.labelSize + selected.labelGap;
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.strokeStyle = 'rgba(0,0,0,0.72)';
        ctx.lineWidth = Math.max(1, Math.min(1.5, selected.valueSize * 0.09));
        if (outlined) ctx.strokeText(item.value, centerX, textY, textWidth);
        ctx.fillText(item.value, centerX, textY, textWidth);
        textY += selected.valueSize;

        if (item.unit) {
            textY += selected.unitGap;
            ctx.font = `${unitWeight} ${selected.unitSize}px ${fontFamily}`;
            ctx.fillStyle = labelColor;
            ctx.lineWidth = Math.max(1, Math.min(1.5, selected.unitSize * 0.1));
            if (outlined) ctx.strokeText(item.unit, centerX, textY, textWidth);
            ctx.fillText(item.unit, centerX, textY, textWidth);
        }
    }
}
