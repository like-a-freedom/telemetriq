import type { ExtendedOverlayConfig } from '../../core/types';
import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import type { ResolutionTuning } from '../overlayUtils';
import type { OverlayContext2D } from '../overlayUtils';
import { clamp, fontWeightValue, getStableMetricValue, measureTrackedTextWidth } from '../overlayUtils';
import { parsePace, toStandardMetricItems } from '../layouts/shared';
import type { MetricMap, Orientation } from '../layouts/shared';

const INTER_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function measure(
    ctx: OverlayContext2D,
    text: string,
    fontFamily: string,
    size: number,
    weight: number,
    tracking = 0,
): number {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    return measureTrackedTextWidth(ctx, text, tracking, size);
}

function drawOutlinedText(ctx: OverlayContext2D, text: string, x: number, y: number): void {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
}

function drawTrackedCentered(
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
    for (const character of text) {
        drawOutlinedText(ctx, character, cursorX, y);
        cursorX += ctx.measureText(character).width + spacing;
    }
}

export const minimalRingTemplate = defineTemplate({
    id: 'minimal-ring',
    metadata: {
        name: 'Minimal Ring',
        description: 'Circular progress ring for pace with an aligned row of supporting metrics',
        previewColors: { bg: '#101820', accent: '#f97316', text: '#f8fafc' },
    },
    config: {
        layoutMode: 'minimal-ring',
        position: 'bottom-right',
        backgroundOpacity: 0,
        fontSizePercent: 2.2,
        showTime: false,
        showPace: true,
        showHr: true,
        showDistance: true,
        showPower: true,
        fontFamily: INTER_FONT,
        textColor: '#f8fafc',
        backgroundColor: 'transparent',
        textShadow: false,
        lineSpacing: 1.15,
        layout: 'vertical',
        labelStyle: 'uppercase',
        valueFontWeight: 'bold',
        valueSizeMultiplier: 1.4,
        labelSizeMultiplier: 0.44,
        labelLetterSpacing: 0.06,
        accentColor: '#f97316',
    },
    capabilities: {
        ...DEFAULT_CAPABILITIES,
        supportedMetrics: ['pace', 'hr', 'distance', 'power'],
        requiredMetrics: ['pace'],
        supportsPosition: false,
        supportsBackgroundOpacity: false,
        supportsGradient: false,
        supportsBorder: false,
        supportsTextShadow: false,
        supportsAccentColor: true,
        supportsLayoutDirection: false,
        getMetricUnavailableReason: (metric) => {
            if (metric === 'time') {
                return 'Minimal Ring only supports Pace, Heart Rate, Distance, and Power';
            }
            return undefined;
        },
    },
    styles: {
        typography: {
            fontFamily: INTER_FONT,
            valueFontWeight: 'bold',
            labelFontWeight: 'normal',
            valueSizeMultiplier: 1.4,
            labelSizeMultiplier: 0.44,
            labelLetterSpacing: 0.06,
        },
        spacing: {
            basePaddingPercent: 0.025,
            metricGapPercent: 0.018,
            lineSpacing: 1.15,
        },
        visual: {
            cornerRadius: 0,
            borderWidth: 0,
            labelStyle: 'uppercase',
            textShadow: false,
            textShadowBlur: 0,
        },
    },
});

/**
 * Draw the Minimal Ring template.
 * Standard draw*(ctx, data, w, h, config, orientation, tuning) contract —
 * matches the dispatcher in layouts/extendedLayouts.ts.
 */
export function drawMinimalRing(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: ResolutionTuning,
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const subItems = toStandardMetricItems(
        data,
        {
            heartRate: { label: 'HR', unit: 'BPM' },
            distance: { label: 'DISTANCE', unit: 'KM' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['heartRate', 'distance', 'power'],
    );
    const hasPace = Boolean(data.pace);
    if (!hasPace && subItems.length === 0) return;

    const fontFamily = config.fontFamily || INTER_FONT;
    const textColor = config.textColor || '#f8fafc';
    const accentColor = config.accentColor || '#f97316';
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = clamp(config.labelSizeMultiplier ?? 0.44, 0.3, 1.1);
    const labelTracking = clamp(config.labelLetterSpacing ?? 0.06, 0, 0.12)
        * tuning.labelTrackingScale;
    const lineSpacing = clamp(config.lineSpacing ?? 1.15, 0.9, 1.8);
    const safePad = clamp(orientation.safePad, 8, Math.min(w * 0.08, h * 0.12));
    const availableW = Math.max(0, w - safePad * 2);
    const availableH = Math.max(0, h - safePad * 2);
    const baseRadius = orientation.shortSide * (h < 240 ? 0.24 : orientation.isPortrait ? 0.105 : 0.09);
    const ringRadius = hasPace
        ? Math.min(
            clamp(baseRadius, 18, 104),
            Math.max(16, (availableH - 4) / 2),
        )
        : 0;
    const diameter = ringRadius * 2;
    const strokeW = hasPace ? Math.max(2, Math.round(ringRadius * 0.07)) : 0;
    const ringGap = hasPace ? clamp(orientation.shortSide * 0.03, 10, 28) : 0;
    const columns = subItems.length === 0
        ? 0
        : orientation.isPortrait
            ? 1
            : w < 560
                ? Math.min(2, subItems.length)
                : Math.min(3, subItems.length);
    const rowCount = columns > 0 ? Math.ceil(subItems.length / columns) : 0;
    const unitGap = 3;

    let selected: {
        valueSize: number;
        unitSize: number;
        labelSize: number;
        labelGap: number;
        metricHeight: number;
        rowGap: number;
        columnGap: number;
        cellWidth: number;
        gridWidth: number;
        gridHeight: number;
        blockWidth: number;
        blockHeight: number;
    } | undefined;

    const requestedValueSize = Math.min(
        48,
        orientation.shortSide
            * clamp(config.fontSizePercent ?? 2.2, 0.5, 8)
            * clamp(config.valueSizeMultiplier ?? 1.4, 0.5, 4)
            * clamp(tuning.textScale, 0.5, 4)
            / 100,
    );
    for (let valueSize = Math.max(11, Math.floor(requestedValueSize)); valueSize >= 8; valueSize -= 1) {
        const labelSize = labelVisible ? Math.max(6, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(7, Math.round(valueSize * 0.68));
        const labelGap = labelVisible ? Math.max(2, Math.round(valueSize * 0.18 * lineSpacing)) : 0;
        const metricHeight = (labelVisible ? labelSize + labelGap : 0) + Math.max(valueSize, unitSize);
        const columnGap = clamp(orientation.shortSide * 0.02, 6, 20);
        const rowGap = clamp(valueSize * 0.38, 4, 14);
        const cellWidth = subItems.length === 0
            ? 0
            : Math.max(52, ...subItems.map((item) => {
                const unit = (item.unit ?? '').toUpperCase();
                const labelWidth = labelVisible
                    ? measure(ctx, item.label, fontFamily, labelSize, 500, labelTracking)
                    : 0;
                const valueWidth = Math.max(
                    measure(ctx, item.value, fontFamily, valueSize, valueWeight),
                    measure(ctx, getStableMetricValue(item.label), fontFamily, valueSize, valueWeight),
                );
                const unitWidth = measure(ctx, unit, fontFamily, unitSize, 500);
                return Math.max(labelWidth, valueWidth + (unit ? unitGap + unitWidth : 0));
            }));
        const gridWidth = columns > 0 ? columns * cellWidth + (columns - 1) * columnGap : 0;
        const gridHeight = rowCount > 0 ? rowCount * metricHeight + (rowCount - 1) * rowGap : 0;
        const blockWidth = diameter + (gridWidth > 0 ? ringGap + gridWidth : 0);
        const blockHeight = Math.max(diameter, gridHeight);

        if (blockWidth > availableW || blockHeight > availableH) continue;
        selected = {
            valueSize,
            unitSize,
            labelSize,
            labelGap,
            metricHeight,
            rowGap,
            columnGap,
            cellWidth,
            gridWidth,
            gridHeight,
            blockWidth,
            blockHeight,
        };
        break;
    }

    if (!selected) return;

    const blockX = w - safePad - selected.blockWidth;
    const blockY = h - safePad - selected.blockHeight;
    const ringX = blockX + ringRadius;
    const ringY = blockY + selected.blockHeight / 2;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';

    if (data.pace) {
        const paceValueWidth = diameter - strokeW * 2 - 8;
        let paceSize = Math.min(selected.valueSize, Math.round(ringRadius * 0.58));
        while (paceSize > 8 && Math.max(
            measure(ctx, data.pace, fontFamily, paceSize, valueWeight),
            measure(ctx, getStableMetricValue('pace'), fontFamily, paceSize, valueWeight),
        ) > paceValueWidth) {
            paceSize -= 1;
        }
        const paceUnitSize = Math.max(6, Math.round(paceSize * 0.28));
        const paceBlockHeight = paceSize + paceUnitSize * 1.4;

        // The pace arc stays compact; supporting metrics share the same bottom-safe band.
        ctx.strokeStyle = 'rgba(3,9,16,0.48)';
        ctx.lineWidth = strokeW + 2;
        ctx.beginPath();
        ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(248,250,252,0.3)';
        ctx.lineWidth = strokeW;
        ctx.beginPath();
        ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        const paceValue = parsePace(data.pace);
        const progress = clamp((10 - paceValue) / 8, 0, 1);
        if (progress > 0) {
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + Math.PI * 2 * progress;
            ctx.strokeStyle = 'rgba(3,9,16,0.48)';
            ctx.lineWidth = strokeW + 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(ringX, ringY, ringRadius, startAngle, endAngle, false);
            ctx.stroke();
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = strokeW;
            ctx.beginPath();
            ctx.arc(ringX, ringY, ringRadius, startAngle, endAngle, false);
            ctx.stroke();
            ctx.lineCap = 'butt';
        }

        const paceTop = ringY - paceBlockHeight / 2;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(3,9,16,0.9)';
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${paceSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(paceSize * 0.11, 0.9, 1.8);
        drawOutlinedText(ctx, data.pace, ringX, paceTop);

        ctx.fillStyle = accentColor;
        ctx.font = `500 ${paceUnitSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(paceUnitSize * 0.1, 0.8, 1.4);
        drawOutlinedText(ctx, 'MIN/KM', ringX, paceTop + paceSize + paceUnitSize * 0.4);
    }

    if (subItems.length > 0) {
        const gridX = blockX + diameter + ringGap;
        const gridY = blockY + (selected.blockHeight - selected.gridHeight) / 2;
        ctx.strokeStyle = 'rgba(3,9,16,0.9)';
        for (let row = 0; row < rowCount; row += 1) {
            const rowItems = subItems.slice(row * columns, (row + 1) * columns);
            const rowWidth = rowItems.length * selected.cellWidth + Math.max(0, rowItems.length - 1) * selected.columnGap;
            const rowLeft = gridX + (selected.gridWidth - rowWidth) / 2;
            const rowTop = gridY + row * (selected.metricHeight + selected.rowGap);

            for (let column = 0; column < rowItems.length; column += 1) {
                const item = rowItems[column]!;
                const centerX = rowLeft + column * (selected.cellWidth + selected.columnGap) + selected.cellWidth / 2;
                const unit = (item.unit ?? '').toUpperCase();
                const valueWidth = measure(ctx, item.value, fontFamily, selected.valueSize, valueWeight);
                const unitWidth = measure(ctx, unit, fontFamily, selected.unitSize, 500);
                const groupWidth = valueWidth + (unit ? unitGap + unitWidth : 0);
                const groupLeft = centerX - groupWidth / 2;
                const valueY = rowTop + (labelVisible ? selected.labelSize + selected.labelGap : 0);

                if (labelVisible) {
                    ctx.textAlign = 'left';
                    ctx.fillStyle = 'rgba(248,250,252,0.82)';
                    ctx.font = `500 ${selected.labelSize}px ${fontFamily}`;
                    ctx.lineWidth = clamp(selected.labelSize * 0.16, 1, 2);
                    drawTrackedCentered(ctx, item.label, centerX, rowTop, labelTracking, selected.labelSize);
                }

                ctx.textAlign = 'left';
                ctx.fillStyle = textColor;
                ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
                ctx.lineWidth = clamp(selected.valueSize * 0.1, 0.9, 2);
                drawOutlinedText(ctx, item.value, groupLeft, valueY);

                if (unit) {
                    ctx.fillStyle = accentColor;
                    ctx.font = `500 ${selected.unitSize}px ${fontFamily}`;
                    ctx.lineWidth = clamp(selected.unitSize * 0.1, 0.8, 1.4);
                    drawOutlinedText(ctx, unit, groupLeft + valueWidth + unitGap,
                        valueY + (selected.valueSize - selected.unitSize) * 0.12);
                }
            }
        }
    }

    ctx.restore();
}
