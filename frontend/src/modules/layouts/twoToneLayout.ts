import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    clamp,
    drawTrackedText,
    fontWeightValue,
    measureTrackedTextWidth,
} from '../overlayUtils';
import { toStandardMetricItems, type MetricItemSpec, type MetricMap, type Orientation } from './shared';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

const WIDTH_RESERVE: Record<MetricItemSpec['key'], string> = {
    pace: '120:59',
    heartRate: '199',
    distance: '12345.6',
    time: '123:59:59',
    power: '1999',
};

const COMPACT_LABEL: Record<MetricItemSpec['key'], string> = {
    pace: 'PACE',
    heartRate: 'HR',
    distance: 'DIST',
    time: 'TIME',
    power: 'PWR',
};

type LabelMode = 'full' | 'compact' | 'none';

function getLabel(item: MetricItemSpec, config: ExtendedOverlayConfig, mode: LabelMode): string {
    if (mode === 'none') return '';
    if (mode === 'compact') return COMPACT_LABEL[item.key];
    return config.labelStyle === 'uppercase' ? item.label.toUpperCase() : item.label;
}

function finiteSetting(value: number | undefined, fallback: number, min: number, max: number): number {
    return Number.isFinite(value) ? clamp(value!, min, max) : fallback;
}

function getRowLayout(valueSize: number, config: ExtendedOverlayConfig, mode: LabelMode): {
    labelSize: number;
    labelGap: number;
    rowGap: number;
    rowHeight: number;
} {
    const labelSize = mode === 'none'
        ? 0
        : Math.max(7, Math.round(valueSize * finiteSetting(config.labelSizeMultiplier, 0.44, 0.25, 0.82)));
    const labelGap = labelSize === 0 ? 0 : Math.max(2, Math.round(valueSize * 0.16));
    const lineSpacing = finiteSetting(config.lineSpacing, 1.2, 0.9, 1.8);
    const rowGap = Math.max(2, Math.round(valueSize * Math.max(0.18, lineSpacing - 0.9)));

    return {
        labelSize,
        labelGap,
        rowGap,
        rowHeight: labelSize + labelGap + valueSize + rowGap,
    };
}

function measureLabel(
    ctx: OverlayContext2D,
    label: string,
    fontFamily: string,
    size: number,
    tracking: number,
): number {
    if (!label) return 0;
    ctx.font = `500 ${size}px ${fontFamily}`;
    return measureTrackedTextWidth(ctx, label, tracking, size);
}

function measureValue(
    ctx: OverlayContext2D,
    value: string,
    fontFamily: string,
    size: number,
    weight: number,
): number {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    return ctx.measureText(value).width;
}

function unitFontSize(valueSize: number): number {
    return Math.max(7, Math.round(valueSize * 0.76));
}

function measureMetricLine(
    ctx: OverlayContext2D,
    item: MetricItemSpec,
    value: string,
    fontFamily: string,
    valueSize: number,
    valueWeight: number,
): number {
    const valueWidth = measureValue(ctx, value, fontFamily, valueSize, valueWeight);
    if (!item.unit) return valueWidth;

    ctx.font = `500 ${unitFontSize(valueSize)}px ${fontFamily}`;
    return valueWidth + ctx.measureText(` ${item.unit}`).width;
}

function measureRowsWidth(
    ctx: OverlayContext2D,
    rows: MetricItemSpec[],
    config: ExtendedOverlayConfig,
    fontFamily: string,
    valueSize: number,
    valueWeight: number,
    tracking: number,
    labelMode: LabelMode,
): number {
    const { labelSize } = getRowLayout(valueSize, config, labelMode);
    return Math.max(...rows.map((row) => {
        const labelWidth = measureLabel(ctx, getLabel(row, config, labelMode), fontFamily, labelSize, tracking);
        const valueWidth = Math.max(
            measureMetricLine(ctx, row, row.value, fontFamily, valueSize, valueWeight),
            measureMetricLine(ctx, row, WIDTH_RESERVE[row.key], fontFamily, valueSize, valueWeight),
        );
        return Math.max(labelWidth, valueWidth);
    }));
}

export function drawTwoTone(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number; labelTrackingScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 32) return;

    const rows = toStandardMetricItems(
        data,
        {
            heartRate: { label: 'Heart rate', unit: 'bpm' },
            distance: { label: 'Distance', unit: 'km' },
            time: { label: 'Time', unit: '' },
        },
        ['heartRate', 'distance', 'time'],
    );
    const pace = data.pace;
    if (!pace && rows.length === 0) return;

    const maxSafePad = Math.min(w / 4, h / 4);
    const requestedShadowBlur = config.textShadow ? finiteSetting(config.textShadowBlur, 2, 0, 4) : 0;
    const maxShadowBlur = Math.max(0, (maxSafePad - orientation.safePad - 1) / 2);
    const shadowBlur = Math.min(requestedShadowBlur, maxShadowBlur);
    const shadowPad = config.textShadow ? shadowBlur * 2 + 1 : 0;
    const safePad = Math.max(orientation.safePad, shadowPad);
    const availableWidth = Math.max(0, w - safePad * 2);
    const availableHeight = Math.max(0, h - safePad * 2);
    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const textScale = finiteSetting(config.fontSizePercent, 2.2, 0.5, 8)
        * finiteSetting(config.valueSizeMultiplier, 2.4, 0.5, 4)
        * Math.max(0.5, tuning.textScale);
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const tracking = clamp(
        finiteSetting(config.labelLetterSpacing, 0.1, 0, 0.24)
        * finiteSetting(tuning.labelTrackingScale, 1, 0.5, 1),
        0,
        0.24,
    );
    const maxValueByHeight = rows.length > 0
        ? Math.min(64, availableHeight / (rows.length * 1.9))
        : Math.min(64, availableHeight * 0.45);
    if (maxValueByHeight < 7) return;

    const minValueSize = Math.min(12, maxValueByHeight);
    const baseValueSize = clamp(
        Math.round(orientation.shortSide * textScale / 100),
        minValueSize,
        maxValueByHeight,
    );
    const valueSizes = getValueSizeCandidates(baseValueSize);
    const rightX = w - safePad;
    const rightWidthLimit = availableWidth * (pace ? 0.46 : 0.84);
    const labelModes: LabelMode[] = config.labelStyle === 'hidden' ? ['none'] : ['full', 'compact', 'none'];
    if (config.textShadow) {
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetY = 1;
    }
    let valueSize = baseValueSize;
    let rightWidth = 0;
    let rowHeight = 0;
    let labelMode: LabelMode = labelModes[0]!;
    let rowsFit = rows.length === 0;

    for (const size of valueSizes) {
        for (const mode of labelModes) {
            const rowLayout = getRowLayout(size, config, mode);
            const measuredWidth = rows.length > 0
                ? measureRowsWidth(ctx, rows, config, fontFamily, size, valueWeight, tracking, mode)
                : 0;
            if (measuredWidth <= rightWidthLimit && rowLayout.rowHeight * rows.length <= availableHeight) {
                valueSize = size;
                rightWidth = measuredWidth;
                rowHeight = rowLayout.rowHeight;
                labelMode = mode;
                rowsFit = true;
                break;
            }
        }
        if (rowsFit) break;
    }
    if (!rowsFit) return;

    const columnGap = Math.min(availableWidth * 0.08, Math.max(8, orientation.shortSide * 0.035));
    const leftX = safePad;
    const leftWidth = rows.length > 0
        ? Math.max(0, rightX - rightWidth - leftX - columnGap)
        : availableWidth;
    const heroMaxHeight = Math.max(0, availableHeight - 12);
    let heroSize = pace ? Math.min(144, Math.max(28, Math.round(valueSize * 2.35)), heroMaxHeight) : 0;

    if (pace) {
        const paceWeight = Math.max(valueWeight, 700);
        const unitSize = Math.max(8, Math.round(Math.min(heroSize * 0.19, valueSize * 0.82)));
        const unitGap = Math.max(2, Math.round(heroSize * 0.08));
        const maxHeroSizeByHeight = Math.max(0, availableHeight - unitSize - unitGap);
        heroSize = Math.min(heroSize, maxHeroSizeByHeight);
        for (; heroSize >= 16; heroSize -= 1) {
            const width = Math.max(
                measureValue(ctx, pace, fontFamily, heroSize, paceWeight),
                measureValue(ctx, WIDTH_RESERVE.pace, fontFamily, heroSize, paceWeight),
            );
            if (width <= leftWidth) break;
        }

        if (heroSize >= 16) {
            const fittedUnitSize = Math.max(8, Math.round(Math.min(heroSize * 0.19, valueSize * 0.82)));
            const fittedUnitGap = Math.max(2, Math.round(heroSize * 0.08));
            const paceTop = h - safePad - heroSize - fittedUnitGap - fittedUnitSize;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillStyle = config.accentColor || '#c8ff00';
            ctx.font = `${paceWeight} ${heroSize}px ${fontFamily}`;
            ctx.lineWidth = Math.max(1, heroSize * 0.012);
            ctx.strokeStyle = 'rgba(0,0,0,0.82)';
            ctx.strokeText(pace, leftX, paceTop);
            ctx.fillText(pace, leftX, paceTop);

            ctx.font = `600 ${fittedUnitSize}px ${fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.82)';
            drawTrackedText(ctx, 'MIN / KM', leftX, paceTop + heroSize + fittedUnitGap, tracking, fittedUnitSize);
        }
    }

    if (rows.length === 0) return;

    const { labelSize, labelGap } = getRowLayout(valueSize, config, labelMode);
    const top = h - safePad - rowHeight * rows.length;
    ctx.textBaseline = 'top';
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index]!;
        const y = top + index * rowHeight;
        const label = getLabel(row, config, labelMode);

        if (label) {
            const labelWidth = measureLabel(ctx, label, fontFamily, labelSize, tracking);
            ctx.textAlign = 'left';
            ctx.font = `500 ${labelSize}px ${fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.78)';
            drawTrackedText(ctx, label, rightX - labelWidth, y, tracking, labelSize);
        }

        ctx.textAlign = 'right';
        ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
        ctx.fillStyle = config.textColor || '#FFFFFF';
        const valueY = y + labelSize + labelGap;
        const unitSize = unitFontSize(valueSize);
        const unitText = row.unit ? ` ${row.unit}` : '';
        let unitWidth = 0;
        if (row.unit) {
            ctx.font = `500 ${unitSize}px ${fontFamily}`;
            unitWidth = ctx.measureText(unitText).width;
        }
        ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
        ctx.fillText(row.value, rightX - unitWidth, valueY);
        if (row.unit) {
            ctx.font = `500 ${unitSize}px ${fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.82)';
            ctx.fillText(unitText, rightX, valueY + valueSize - unitSize);
        }
    }
}

function getValueSizeCandidates(baseSize: number): number[] {
    const candidates: number[] = [];
    for (let size = Math.floor(baseSize); size >= 7; size -= 1) candidates.push(size);
    return candidates;
}
