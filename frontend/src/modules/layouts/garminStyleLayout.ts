import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';
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

function outlineWidth(fontSize: number): number {
    return clamp(fontSize * 0.13, 1.25, 2.2);
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

function displayLabel(item: MetricItemSpec, compact: boolean): string {
    if (!compact) return item.label;
    switch (item.key) {
        case 'distance': return 'DIST';
        case 'heartRate': return 'HR';
        case 'power': return 'PWR';
        default: return item.label;
    }
}

export function drawGarminStyle(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const sideItems = toStandardMetricItems(
        data,
        {
            pace: { label: 'PACE', unit: 'min/km' },
            distance: { label: 'DIST', unit: 'km' },
            time: { label: 'TIME', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['pace', 'distance', 'time', 'power'],
    );
    const hasHeartRate = Boolean(data.heartRate);
    if (!hasHeartRate && sideItems.length === 0) return;

    const safePad = clamp(orientation.safePad, 0, Math.min(w * 0.12, h * 0.12));
    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const textColor = config.textColor || '#ffffff';
    const accent = config.accentColor || '#f97316';
    const labelColor = 'rgba(255,255,255,0.9)';
    const valueWeight = fontWeightValue(config.valueFontWeight || 'normal');
    const labelWeight = 500;
    const unitWeight = 500;
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.62, 0.25, 0.72);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.08, 0, 0.2);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.8, 1.8);
    const configuredValueSize = orientation.shortSide
        * finiteSetting(config.fontSizePercent, 2.2, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 1.4, 0.5, 4)
        * finiteSetting(tuning.textScale, 1, 0.5, 4)
        / 100;

    const landscape = !orientation.isPortrait;
    const gaugeRadius = hasHeartRate
        ? Math.min(orientation.shortSide * (orientation.isPortrait ? 0.14 : 0.13), w * 0.18, h * 0.2)
        : 0;
    const gaugeInset = gaugeRadius > 0 ? Math.max(4, gaugeRadius * 0.16) : 0;
    const gaugeX = safePad + gaugeRadius + gaugeInset;
    const gaugeY = h - safePad - gaugeRadius - gaugeInset;
    const gapAfterGauge = gaugeRadius > 0 ? Math.max(8, gaugeRadius * 0.28) : 0;
    const sideStartX = gaugeRadius > 0 ? gaugeX + gaugeRadius + gapAfterGauge : safePad;
    const sideWidth = Math.max(0, w - safePad - sideStartX);

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        labelTracking: number;
        labelGap: number;
        unitGap: number;
        contentHeight: number;
        columns: number;
        rows: number;
        gridGap: number;
        rowStep: number;
        anchorY: number;
    } | undefined;

    if (sideItems.length > 0 && sideWidth > 0) {
        const columns = landscape && sideWidth / sideItems.length < 96
            ? Math.min(2, sideItems.length)
            : landscape ? sideItems.length : 1;
        const rows = Math.ceil(sideItems.length / columns);
        const gridAnchorY = landscape && rows > 1 ? Math.min(gaugeY, h * 0.68) : gaugeY;
        const columnWidth = sideWidth / columns;
        const textWidth = Math.max(0, columnWidth - Math.min(columnWidth * 0.12, orientation.shortSide * 0.025));
        const maxTextHeight = Math.min(h * 0.38, orientation.shortSide * 0.38);
        const maxValueSize = Math.min(64, maxTextHeight * (landscape ? 0.58 : 0.5));
        const minValueSize = Math.min(14, maxValueSize);
        const startValueSize = Math.min(maxValueSize, Math.max(minValueSize, Math.round(configuredValueSize)));

        for (let valueSize = Math.floor(startValueSize); valueSize >= 7; valueSize -= 1) {
            const labelSize = labelVisible ? Math.max(7, Math.round(valueSize * labelMultiplier)) : 0;
            const unitSize = Math.max(8, Math.round(valueSize * 0.54));
            const labelGap = labelVisible ? Math.max(1, Math.round(valueSize * (lineSpacing - 0.85) * 0.14)) : 0;
            const unitGap = Math.max(1, Math.round(valueSize * (lineSpacing - 0.8) * 0.14));
            const cellMetrics = sideItems.map((item) => {
                const stableValue = getStableMetricValue(STABLE_KEY[item.key]);
                const valueWidth = Math.max(
                    measureText(ctx, item.value, fontFamily, valueSize, valueWeight),
                    measureText(ctx, stableValue, fontFamily, valueSize, valueWeight),
                );
                const compactLabel = displayLabel(item, textWidth < 180);
                const labelWidth = measureText(ctx, compactLabel, fontFamily, labelSize, labelWeight, labelTracking);
                const unitWidth = measureText(ctx, item.unit ?? '', fontFamily, unitSize, unitWeight);
                return { valueWidth, labelWidth, unitWidth, compactLabel };
            });
            const fitsWidth = cellMetrics.every(({ valueWidth, labelWidth, unitWidth }) => {
                if (landscape) return valueWidth <= textWidth && (!labelVisible || labelWidth <= textWidth) && unitWidth <= textWidth;
                const inlineWidth = valueWidth + unitWidth + (unitWidth > 0 ? Math.max(3, valueSize * 0.22) : 0);
                const labelGapWidth = labelVisible ? Math.max(6, orientation.shortSide * 0.018) : 0;
                return inlineWidth + (labelVisible ? labelWidth + labelGapWidth : 0) <= textWidth;
            });
            if (!fitsWidth) continue;

            const contentHeight = (labelVisible && landscape ? labelSize + labelGap : 0)
                + valueSize
                + (landscape && sideItems.some((item) => item.unit) ? unitGap + unitSize : 0);
            const gridGap = landscape ? Math.max(6, valueSize * 0.42) : 0;
            const rowStep = landscape
                ? contentHeight + gridGap
                : Math.max(valueSize * 1.55, Math.min(orientation.shortSide * 0.075, 30));
            const totalHeight = landscape
                ? rows * contentHeight + (rows - 1) * gridGap
                : (sideItems.length - 1) * rowStep + valueSize;
            if (totalHeight > h - safePad * 2) continue;
            const anchorY = clamp(gridAnchorY, safePad + totalHeight / 2, h - safePad - totalHeight / 2);

            selected = {
                valueSize,
                labelSize,
                unitSize,
                labelTracking,
                labelGap,
                unitGap,
                contentHeight,
                columns,
                rows,
                gridGap,
                rowStep,
                anchorY,
            };
            break;
        }
    }

    const outlined = Boolean(config.textShadow && config.textShadowColor);
    if (hasHeartRate && gaugeRadius > 0) {
        const strokeWidth = clamp(gaugeRadius * 0.1, 2, Math.min(8, gaugeRadius * 0.2));
        const heartRate = Number.parseFloat(data.heartRate ?? '');
        const progress = Number.isFinite(heartRate) ? clamp(heartRate / 200, 0, 1) : 0;
        const startAngle = 2.44;
        const sweepAngle = 4.54;
        const endAngle = startAngle + sweepAngle * progress;

        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(gaugeX, gaugeY, gaugeRadius, 0, Math.PI * 2);
        ctx.stroke();

        if (progress > 0) {
            ctx.strokeStyle = accent;
            ctx.beginPath();
            ctx.arc(gaugeX, gaugeY, gaugeRadius, startAngle, endAngle, false);
            ctx.stroke();
            const dotX = gaugeX + Math.cos(endAngle) * gaugeRadius;
            const dotY = gaugeY + Math.sin(endAngle) * gaugeRadius;
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(dotX, dotY, Math.max(2, strokeWidth * 0.85), 0, Math.PI * 2);
            ctx.fill();
        }

        const hrText = data.heartRate ?? '';
        let hrValueSize = Math.max(9, Math.min(gaugeRadius * 0.56, (selected?.valueSize ?? 14) * 0.86));
        const innerGaugeWidth = Math.max(12, gaugeRadius * 1.55);
        while (hrValueSize > 7 && measureText(ctx, hrText, fontFamily, hrValueSize, valueWeight) > innerGaugeWidth) hrValueSize -= 1;
        const hrUnitSize = Math.max(8, Math.min(10, Math.round(hrValueSize * 0.62)));
        const hrBlockHeight = hrValueSize + hrUnitSize;
        const hrTop = gaugeY - hrBlockHeight / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${hrValueSize}px ${fontFamily}`;
        ctx.strokeStyle = 'rgba(0,0,0,0.72)';
        ctx.lineWidth = outlineWidth(hrValueSize);
        if (outlined) ctx.strokeText(hrText, gaugeX, hrTop, innerGaugeWidth);
        ctx.fillText(hrText, gaugeX, hrTop, innerGaugeWidth);
        ctx.fillStyle = accent;
        ctx.font = `500 ${hrUnitSize}px ${fontFamily}`;
        ctx.lineWidth = outlineWidth(hrUnitSize);
        if (outlined) ctx.strokeText('bpm', gaugeX, hrTop + hrValueSize, innerGaugeWidth);
        ctx.fillText('bpm', gaugeX, hrTop + hrValueSize, innerGaugeWidth);
        ctx.restore();
    }

    if (!selected || sideItems.length === 0) return;
    if (outlined) {
        ctx.shadowColor = config.textShadowColor;
        ctx.shadowBlur = finiteSetting(config.textShadowBlur, 2, 0, 12);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(1, selected.valueSize * 0.06);
    } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    const columnWidth = landscape ? sideWidth / selected.columns : sideWidth;
    const textWidth = Math.max(0, columnWidth - Math.min(columnWidth * 0.12, orientation.shortSide * 0.025));
    const rightEdge = w - safePad;
    const totalGridHeight = selected.rows * selected.contentHeight + (selected.rows - 1) * selected.gridGap;
    const metricAnchorY = selected.anchorY;

    for (let index = 0; index < sideItems.length; index += 1) {
        const item = sideItems[index]!;
        const gridColumn = index % selected.columns;
        const gridRow = Math.floor(index / selected.columns);
        const cellX = sideStartX + columnWidth * gridColumn;
        const cellCenter = landscape ? cellX + columnWidth / 2 : 0;
        const label = displayLabel(item, columnWidth < 180);
        const valueWidth = measureText(ctx, item.value, fontFamily, selected.valueSize, valueWeight);
        const unitWidth = measureText(ctx, item.unit ?? '', fontFamily, selected.unitSize, unitWeight);

        if (landscape) {
            let textY = metricAnchorY - totalGridHeight / 2 + gridRow * selected.rowStep;
            if (labelVisible) {
                const labelWidth = measureText(ctx, label, fontFamily, selected.labelSize, labelWeight, selected.labelTracking);
                ctx.font = `${labelWeight} ${selected.labelSize}px ${fontFamily}`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillStyle = labelColor;
                ctx.strokeStyle = 'rgba(0,0,0,0.72)';
                ctx.lineWidth = outlineWidth(selected.labelSize);
                drawTrackedLabel(ctx, label, cellCenter - labelWidth / 2, textY, selected.labelTracking, selected.labelSize, outlined);
                textY += selected.labelSize + selected.labelGap;
            }

            ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = textColor;
            ctx.strokeStyle = 'rgba(0,0,0,0.72)';
            ctx.lineWidth = outlineWidth(selected.valueSize);
            if (outlined) ctx.strokeText(item.value, cellCenter, textY, textWidth);
            ctx.fillText(item.value, cellCenter, textY, textWidth);
            textY += selected.valueSize;

            if (item.unit) {
                textY += selected.unitGap;
                ctx.font = `${unitWeight} ${selected.unitSize}px ${fontFamily}`;
                ctx.fillStyle = accent;
                ctx.lineWidth = outlineWidth(selected.unitSize);
                if (outlined) ctx.strokeText(item.unit, cellCenter, textY, textWidth);
                ctx.fillText(item.unit, cellCenter, textY, textWidth);
            }
        } else {
            const rowY = metricAnchorY + (index - (sideItems.length - 1) / 2) * selected.rowStep;
            const valueUnitGap = item.unit ? Math.max(3, selected.valueSize * 0.22) : 0;
            const groupWidth = valueWidth + (item.unit ? valueUnitGap + unitWidth : 0);
            const groupLeft = rightEdge - groupWidth;

            const labelSize = selected.labelSize;
            const labelWidth = labelVisible
                ? measureText(ctx, label, fontFamily, labelSize, labelWeight, selected.labelTracking)
                : 0;
            const labelGapWidth = labelVisible ? Math.max(6, orientation.shortSide * 0.018) : 0;
            const labelFits = labelVisible && labelWidth + labelGapWidth <= groupLeft - sideStartX;

            if (labelFits) {
                ctx.font = `${labelWeight} ${labelSize}px ${fontFamily}`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = labelColor;
                ctx.strokeStyle = 'rgba(0,0,0,0.72)';
                ctx.lineWidth = outlineWidth(labelSize);
                drawTrackedLabel(ctx, label, groupLeft - labelGapWidth - labelWidth, rowY, selected.labelTracking, labelSize, outlined);
            }

            ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = textColor;
            ctx.strokeStyle = 'rgba(0,0,0,0.72)';
            ctx.lineWidth = outlineWidth(selected.valueSize);
            if (outlined) ctx.strokeText(item.value, groupLeft, rowY, textWidth);
            ctx.fillText(item.value, groupLeft, rowY, textWidth);
            if (item.unit) {
                const unitX = groupLeft + valueWidth + valueUnitGap;
                ctx.font = `${unitWeight} ${selected.unitSize}px ${fontFamily}`;
                ctx.fillStyle = accent;
                ctx.lineWidth = outlineWidth(selected.unitSize);
                if (outlined) ctx.strokeText(item.unit, unitX, rowY, textWidth);
                ctx.fillText(item.unit, unitX, rowY, textWidth);
            }
        }
    }

    if (landscape && selected.columns > 1) {
        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        for (let index = 1; index < selected.rows; index += 1) {
            const dividerY = metricAnchorY - totalGridHeight / 2
                + index * selected.rowStep - selected.gridGap / 2;
            ctx.beginPath();
            ctx.moveTo(sideStartX, dividerY);
            ctx.lineTo(rightEdge, dividerY);
            ctx.stroke();
        }
        for (let index = 1; index < selected.columns; index += 1) {
            const dividerX = sideStartX + columnWidth * index;
            ctx.beginPath();
            ctx.moveTo(dividerX, metricAnchorY - selected.rows * selected.rowStep / 2 + selected.gridGap / 2);
            ctx.lineTo(dividerX, metricAnchorY + selected.rows * selected.rowStep / 2 - selected.gridGap / 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}
