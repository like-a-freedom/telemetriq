import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D, ResolutionTuning } from '../overlayUtils';
import {
    clamp,
    fontWeightValue,
    getStableMetricValue,
    measureTrackedTextWidth,
} from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type Orientation } from './shared';

const LABEL_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const VALUE_FONT_FALLBACK = 'Georgia, "Times New Roman", serif';

type TrackedLabel = {
    size: number;
    spacing: number;
    width: number;
    canDraw: boolean;
};

type EditorialStat = {
    key: string;
    label: string;
    value: string;
    unit: string;
    labelFit: TrackedLabel | null;
    valueSize: number;
    unitSize: number;
};

function setFont(ctx: OverlayContext2D, family: string, weight: number, size: number): void {
    ctx.font = `${weight} ${size}px ${family}`;
}

function fitFontSize(
    ctx: OverlayContext2D,
    text: string,
    family: string,
    weight: number,
    preferred: number,
    minimum: number,
    maxWidth: number,
    reservation = text,
): number {
    for (let size = Math.floor(preferred); size >= Math.floor(minimum); size -= 1) {
        setFont(ctx, family, weight, size);
        const width = Math.max(ctx.measureText(text).width, ctx.measureText(reservation).width);
        if (width <= maxWidth) return size;
    }
    return Math.floor(minimum);
}

function fitTrackedLabel(
    ctx: OverlayContext2D,
    text: string,
    preferredSize: number,
    minimumSize: number,
    requestedSpacing: number,
    maxWidth: number,
): TrackedLabel {
    const minimum = Math.max(6, Math.floor(minimumSize));
    for (let size = Math.floor(preferredSize); size >= minimum; size -= 1) {
        setFont(ctx, LABEL_FONT, 500, size);
        const width = measureTrackedTextWidth(ctx, text, requestedSpacing, size);
        if (width <= maxWidth) return { size, spacing: requestedSpacing, width, canDraw: true };
    }

    setFont(ctx, LABEL_FONT, 500, minimum);
    const width = measureTrackedTextWidth(ctx, text, 0, minimum);
    return { size: minimum, spacing: 0, width, canDraw: width <= maxWidth };
}

function fitValueAndUnit(
    ctx: OverlayContext2D,
    value: string,
    unit: string,
    reservation: string,
    family: string,
    weight: number,
    preferred: number,
    minimum: number,
    maxWidth: number,
    unitGap: number,
): { valueSize: number; unitSize: number } {
    for (let valueSize = Math.floor(preferred); valueSize >= Math.floor(minimum); valueSize -= 1) {
        const unitSize = unit ? Math.max(7, Math.min(valueSize - 2, Math.round(valueSize * 0.68))) : 0;
        setFont(ctx, family, weight, valueSize);
        const valueWidth = Math.max(ctx.measureText(value).width, ctx.measureText(reservation).width);
        setFont(ctx, family, 500, unitSize || valueSize);
        const unitWidth = unit ? ctx.measureText(unit).width : 0;
        if (valueWidth + (unit ? unitWidth + unitGap : 0) <= maxWidth) return { valueSize, unitSize };
    }

    const valueSize = Math.floor(minimum);
    return {
        valueSize,
        unitSize: unit ? Math.max(7, Math.min(valueSize - 2, Math.round(valueSize * 0.68))) : 0,
    };
}

function drawEditorialText(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    config: ExtendedOverlayConfig,
    outlineWidth: number,
    maxWidth?: number,
): void {
    if (config.textShadow && config.textShadowColor) {
        ctx.strokeStyle = config.textShadowColor;
        ctx.lineWidth = outlineWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y, maxWidth);
    }
    ctx.fillText(text, x, y, maxWidth);
}

function drawTrackedEditorialText(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    spacing: number,
    config: ExtendedOverlayConfig,
    outlineWidth: number,
): void {
    let cursorX = x;
    for (const char of text) {
        drawEditorialText(ctx, char, cursorX, y, config, outlineWidth);
        cursorX += ctx.measureText(char).width + spacing;
    }
}

function getStatHeight(stats: EditorialStat[], showLabels: boolean, labelGap: number, rowGap: number): number {
    return stats.reduce((height, stat) => (
        height + (showLabels && stat.labelFit ? stat.labelFit.size + labelGap : 0) + stat.valueSize
    ), 0) + Math.max(0, stats.length - 1) * rowGap;
}

export function drawEditorial(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: ResolutionTuning,
): void {
    if (w <= 0 || h <= 0) return;

    const valueFamily = config.fontFamily || VALUE_FONT_FALLBACK;
    const valueWeight = fontWeightValue(config.valueFontWeight || 'normal');
    const fontScale = clamp((config.fontSizePercent ?? 2.1) / 2.1, 0.72, 1.35);
    const valueScale = clamp((config.valueSizeMultiplier ?? 2.2) / 2.2, 0.72, 1.4);
    const labelScale = clamp((config.labelSizeMultiplier ?? 0.34) / 0.34, 0.72, 1.4);
    const showLabels = config.labelStyle !== 'hidden';
    const safePad = Math.min(orientation.safePad, Math.min(w, h) * 0.12);
    const innerWidth = Math.max(1, w - safePad * 2);
    const hasPace = Boolean(data.pace);
    const stats = toStandardMetricItems(data, {
        heartRate: { label: 'HEART RATE', unit: 'bpm' },
        distance: { label: 'DISTANCE', unit: 'km' },
        time: { label: 'ELAPSED', unit: '' },
        power: { label: 'POWER', unit: 'W' },
    }, ['heartRate', 'distance', 'time', 'power']);
    if (!hasPace && stats.length === 0) return;

    const columnGap = hasPace && stats.length > 0
        ? Math.min(innerWidth * 0.08, Math.max(4, innerWidth * 0.035))
        : 0;
    const sideWidth = stats.length > 0 ? innerWidth * (hasPace ? 0.34 : 0.64) : 0;
    const leftWidth = Math.max(1, hasPace ? innerWidth - sideWidth - columnGap : innerWidth);
    const rightX = hasPace ? w - safePad : w / 2;
    const sideTextWidth = Math.max(1, sideWidth);
    const requestedTracking = clamp(
        (config.labelLetterSpacing ?? 0.12) * tuning.labelTrackingScale,
        0,
        0.24,
    );
    const baseLabelSize = Math.max(8, Math.round(
        Math.min(20, orientation.shortSide * 0.022) * tuning.textScale * fontScale * labelScale,
    ));
    const baseSideValueSize = Math.max(11, Math.round(
        Math.min(58, orientation.shortSide * 0.043) * tuning.textScale * fontScale * valueScale,
    ));
    const lineSpacing = clamp(config.lineSpacing ?? 1.2, 0.85, 1.6) / 1.2;
    const sideLabelGap = Math.max(2, Math.round(orientation.shortSide * 0.008 * lineSpacing));
    const sideRowGap = clamp(Math.round(orientation.shortSide * 0.045 * lineSpacing), 3, 16);
    const unitGap = Math.max(2, Math.round(orientation.shortSide * 0.004));

    let preparedStats: EditorialStat[] = stats.map((stat) => {
        const labelFit = showLabels
            ? fitTrackedLabel(
                ctx,
                stat.label,
                baseLabelSize,
                Math.max(6, Math.round(baseLabelSize * 0.72)),
                requestedTracking,
                sideTextWidth,
            )
            : null;
        const { valueSize, unitSize } = fitValueAndUnit(
            ctx,
            stat.value,
            stat.unit ?? '',
            getStableMetricValue(stat.key),
            valueFamily,
            valueWeight,
            baseSideValueSize,
            Math.max(8, Math.round(baseSideValueSize * 0.72)),
            sideTextWidth,
            unitGap,
        );
        return { key: stat.key, label: stat.label, value: stat.value, unit: stat.unit ?? '', labelFit, valueSize, unitSize };
    });

    let fittedLabelGap = sideLabelGap;
    let fittedRowGap = sideRowGap;
    const availableSideHeight = Math.max(1, h - safePad * 2);
    const requestedSideHeight = getStatHeight(preparedStats, showLabels, fittedLabelGap, fittedRowGap);
    if (requestedSideHeight > availableSideHeight && requestedSideHeight > 0) {
        const verticalScale = availableSideHeight / requestedSideHeight;
        preparedStats = preparedStats.map((stat) => ({
            ...stat,
            labelFit: stat.labelFit
                ? fitTrackedLabel(
                    ctx,
                    stat.label,
                    Math.max(6, Math.floor(stat.labelFit.size * verticalScale)),
                    6,
                    requestedTracking,
                    sideTextWidth,
                )
                : null,
            valueSize: Math.max(8, Math.floor(stat.valueSize * verticalScale)),
            unitSize: stat.unit ? Math.max(7, Math.floor(stat.unitSize * verticalScale)) : 0,
        }));
        fittedLabelGap = Math.max(1, Math.floor(fittedLabelGap * verticalScale));
        fittedRowGap = Math.max(0, Math.floor(fittedRowGap * verticalScale));
    }

    const sideHeight = getStatHeight(preparedStats, showLabels, fittedLabelGap, fittedRowGap);
    const sideTop = safePad + Math.max(0, (availableSideHeight - sideHeight) / 2);

    const unitSize = Math.max(9, Math.round(
        Math.min(18, orientation.shortSide * 0.018) * tuning.textScale * fontScale,
    ));
    const heroLabelSize = Math.max(8, Math.round(baseLabelSize * 0.86));
    const paceGap = Math.max(2, Math.round(orientation.shortSide * 0.01));
    const bottomLimit = h - safePad;
    const requestedHeroSize = Math.round(
        orientation.shortSide * 0.15 * tuning.textScale * fontScale * valueScale,
    );
    const availableHeroHeight = Math.max(
        8,
        bottomLimit - safePad - unitSize - paceGap - (showLabels ? heroLabelSize + paceGap : 0),
    );
    const maxHeroSize = Math.max(8, Math.min(
        160,
        Math.round(orientation.shortSide * 0.29),
        availableHeroHeight,
    ));
    const heroSize = clamp(requestedHeroSize, Math.min(18, maxHeroSize), maxHeroSize);
    const fittedHeroSize = data.pace
        ? fitFontSize(ctx, data.pace, valueFamily, valueWeight, heroSize, Math.max(8, Math.round(heroSize * 0.68)),
            leftWidth, getStableMetricValue('pace'))
        : heroSize;
    const outlineWidth = Math.max(1, orientation.shortSide * 0.0025);

    ctx.textBaseline = 'top';
    if (data.pace) {
        const unitTop = bottomLimit - unitSize;
        const paceTop = unitTop - paceGap - fittedHeroSize;
        const paceLabelTop = paceTop - paceGap - heroLabelSize;

        if (showLabels) {
            const label = fitTrackedLabel(
                ctx,
                'PACE',
                heroLabelSize,
                Math.max(6, Math.round(heroLabelSize * 0.72)),
                requestedTracking,
                leftWidth,
            );
            ctx.fillStyle = 'rgba(255,255,255,0.82)';
            if (label.canDraw) {
                ctx.textAlign = 'left';
                setFont(ctx, LABEL_FONT, 500, label.size);
                drawTrackedEditorialText(ctx, 'PACE', safePad, paceLabelTop, label.spacing, config, outlineWidth);
            } else {
                ctx.textAlign = 'left';
                setFont(ctx, LABEL_FONT, 500, label.size);
                drawEditorialText(ctx, 'PACE', safePad, paceLabelTop, config, outlineWidth, leftWidth);
            }
        }

        ctx.textAlign = 'left';
        ctx.fillStyle = config.textColor || '#FFFFFF';
        setFont(ctx, valueFamily, valueWeight, fittedHeroSize);
        drawEditorialText(ctx, data.pace, safePad, paceTop, config, outlineWidth, leftWidth);

        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.textAlign = 'left';
        setFont(ctx, LABEL_FONT, 500, unitSize);
        drawEditorialText(ctx, 'min/km', safePad, unitTop, config, outlineWidth, leftWidth);
    }

    if (preparedStats.length > 0) {
        let cursorY = sideTop;
        for (const stat of preparedStats) {
            if (showLabels && stat.labelFit) {
                ctx.fillStyle = 'rgba(255,255,255,0.82)';
                ctx.textAlign = 'left';
                setFont(ctx, LABEL_FONT, 500, stat.labelFit.size);
                if (stat.labelFit.canDraw) {
                    drawTrackedEditorialText(
                        ctx,
                        stat.label,
                        hasPace ? rightX - stat.labelFit.width : w / 2 - stat.labelFit.width / 2,
                        cursorY,
                        stat.labelFit.spacing,
                        config,
                        outlineWidth,
                    );
                } else {
                    ctx.textAlign = hasPace ? 'right' : 'center';
                    drawEditorialText(ctx, stat.label, rightX, cursorY, config, outlineWidth, sideTextWidth);
                }
                cursorY += stat.labelFit.size + fittedLabelGap;
            }

            ctx.textAlign = 'right';
            ctx.fillStyle = config.textColor || '#FFFFFF';
            setFont(ctx, valueFamily, valueWeight, stat.valueSize);
            const unitWidth = stat.unit
                ? (setFont(ctx, valueFamily, 500, stat.unitSize), ctx.measureText(stat.unit).width)
                : 0;
            setFont(ctx, valueFamily, valueWeight, stat.valueSize);
            const valueMaxWidth = Math.max(1, sideTextWidth - (stat.unit ? unitWidth + unitGap : 0));
            const valueWidth = Math.min(ctx.measureText(stat.value).width, valueMaxWidth);
            const groupWidth = valueWidth + (stat.unit ? unitWidth + unitGap : 0);
            const groupLeft = hasPace ? rightX - groupWidth : w / 2 - groupWidth / 2;
            ctx.textAlign = 'left';
            drawEditorialText(ctx, stat.value, groupLeft, cursorY, config, outlineWidth, valueMaxWidth);
            if (stat.unit) {
                ctx.fillStyle = 'rgba(255,255,255,0.82)';
                setFont(ctx, valueFamily, 500, stat.unitSize);
                drawEditorialText(ctx, stat.unit, groupLeft + valueWidth + unitGap,
                    cursorY + stat.valueSize - stat.unitSize, config, outlineWidth, unitWidth);
            }
            cursorY += stat.valueSize + fittedRowGap;
        }
    }
}
