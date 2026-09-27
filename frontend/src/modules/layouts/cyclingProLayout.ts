import type { TelemetryFrame, ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { clamp, fontWeightValue, getResolutionTuning } from '../overlayUtils';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';
import { drawSpeedometerGauge } from './speedometerGauge';

type SidebarMetricKey = 'powerWatts' | 'hr';

interface SidebarMetricDefinition {
    label: string;
    key: SidebarMetricKey;
    configKey: 'showPower' | 'showHr';
    unit: string;
    max: number;
}

interface DisplayMetric {
    label: string;
    value: string;
    unit: string;
    progress?: number;
}

interface MetricTypography {
    valueSize: number;
    unitSize: number;
    labelSize: number;
    barHeight: number;
    gapLabelToValue: number;
    gapValueToBar: number;
    gapBetweenBlocks: number;
}

const SIDEBAR_METRICS: readonly SidebarMetricDefinition[] = [
    { label: 'POWER', key: 'powerWatts', configKey: 'showPower', unit: 'W', max: 500 },
    { label: 'HEART RATE', key: 'hr', configKey: 'showHr', unit: 'BPM', max: 200 },
];

function getMetricTypography(shortSide: number, scale: number, compact: boolean, labelScale: number): MetricTypography {
    const valueSize = compact
        ? clamp(Math.round(shortSide * 0.07 * scale), 14, 36)
        : clamp(Math.round(shortSide * 0.052 * scale), 24, 76);

    return {
        valueSize,
        unitSize: clamp(Math.round(valueSize * 0.42), 8, 22),
        labelSize: clamp(Math.round(valueSize * labelScale), 8, 24),
        barHeight: compact ? 2 : 3,
        gapLabelToValue: Math.max(3, Math.round(valueSize * 0.11)),
        gapValueToBar: Math.max(5, Math.round(valueSize * 0.14)),
        gapBetweenBlocks: compact ? 8 : Math.max(18, Math.round(valueSize * 0.42)),
    };
}

function metricBlockHeight(typography: MetricTypography, withBar: boolean): number {
    return typography.labelSize + typography.gapLabelToValue + typography.valueSize
        + (withBar ? typography.gapValueToBar + typography.barHeight : 0)
        + typography.gapBetweenBlocks;
}

function buildMetricList(frame: TelemetryFrame, config: ExtendedOverlayConfig): DisplayMetric[] {
    const metrics: DisplayMetric[] = [];

    for (const definition of SIDEBAR_METRICS) {
        const rawValue = frame[definition.key];
        if (config[definition.configKey] === false || !Number.isFinite(rawValue)) continue;

        metrics.push({
            label: definition.label,
            value: Math.round(rawValue!).toString(),
            unit: definition.unit,
            progress: clamp(rawValue! / definition.max, 0, 1),
        });
    }

    if (config.showDistance !== false) {
        metrics.push({
            label: 'DISTANCE',
            value: Number.isFinite(frame.distanceKm) ? frame.distanceKm.toFixed(1) : 'N/A',
            unit: 'KM',
        });
    }

    return metrics;
}

function fitMetricTypography(
    ctx: OverlayContext2D,
    metrics: readonly DisplayMetric[],
    typography: MetricTypography,
    availableWidth: number,
    fontFamily: string,
    valueWeight: number,
    labelTrackingRatio: { labelScale: number; tracking: number },
    minValueSize: number,
): MetricTypography {
    for (let valueSize = typography.valueSize; valueSize >= minValueSize; valueSize -= 1) {
        const unitSize = Math.max(8, Math.round(valueSize * 0.42));
        const labelSize = clamp(Math.round(valueSize * labelTrackingRatio.labelScale), 8, 24);
        const unitGap = Math.max(3, Math.round(valueSize * 0.12));
        let fits = true;

        ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
        for (const metric of metrics) {
            const valueWidth = ctx.measureText(metric.value).width;
            let groupWidth = valueWidth;
            if (metric.unit) {
                ctx.font = `600 ${unitSize}px ${fontFamily}`;
                groupWidth += unitGap + ctx.measureText(metric.unit).width;
                ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
            }

            if (groupWidth > availableWidth * 0.9) {
                fits = false;
                break;
            }
        }

        if (fits) {
            ctx.font = `500 ${labelSize}px ${fontFamily}`;
            fits = metrics.every((metric) => {
                const labelWidth = ctx.measureText(metric.label).width
                    + Math.max(0, metric.label.length - 1) * labelSize * labelTrackingRatio.tracking;
                return labelWidth <= availableWidth * 0.92;
            });
        }

        if (fits) {
            return {
                ...typography,
                valueSize,
                unitSize,
                labelSize,
            };
        }
    }

    const valueSize = minValueSize;
    return {
        ...typography,
        valueSize,
        unitSize: Math.max(8, Math.round(valueSize * 0.42)),
        labelSize: clamp(Math.round(valueSize * labelTrackingRatio.labelScale), 8, 24),
    };
}

export function renderCyclingProLayout(
    ctx: OverlayContext2D,
    frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const tuning = getResolutionTuning(w, h);
    const shortSide = Math.min(w, h);
    const compact = shortSide < 480;
    const accentColor = config.accentColor || '#00E676';
    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const textColor = config.textColor || '#FFFFFF';
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const configuredScale = clamp(
        ((config.fontSizePercent ?? 2.2) / 2.2) * ((config.valueSizeMultiplier ?? 2.1) / 2.1),
        0.65,
        2,
    );
    const typeScale = clamp(tuning.textScale * configuredScale, 0.65, 2);
    const labelScale = clamp(config.labelSizeMultiplier ?? 0.32, 0.25, 0.65);
    const labelTrackingRatio = {
        labelScale,
        tracking: clamp(config.labelLetterSpacing ?? 0.05, 0, 0.16),
    };
    const metrics = buildMetricList(frame, config);
    const safePad = clamp(Math.round(shortSide * 0.035), 6, 24);
    const defaultTypography = getMetricTypography(shortSide, typeScale, compact, labelScale);
    const speedAvailable = config.showSpeed !== false && Number.isFinite(frame.speedKmh);

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;

    if (compact) {
        const gridWidth = Math.max(0, w - safePad * 2);
        const cellWidth = metrics.length > 0 ? gridWidth / metrics.length : 0;
        const typography = fitMetricTypography(
            ctx, metrics, defaultTypography, cellWidth, fontFamily, valueWeight,
            labelTrackingRatio, 11,
        );
        const rowTop = safePad;

        metrics.forEach((metric, index) => {
            const centerX = safePad + cellWidth * (index + 0.5);
            drawMetric(ctx, {
                x: centerX,
                y: rowTop,
                width: cellWidth,
                center: true,
                metric,
                typography,
                fontFamily,
                valueWeight,
                accentColor,
                textColor,
                labelTracking: labelTrackingRatio.tracking,
            });
        });

        if (speedAvailable) {
            const diameter = clamp(Math.round(shortSide * 0.3), 72, 122);
            const radius = diameter / 2;
            const cx = w - safePad - radius;
            const cy = h - safePad - radius;
            drawSpeedometerGauge(ctx, {
                cx,
                cy,
                diameter,
                speedKmh: frame.speedKmh,
                maxSpeed: 60,
                fontFamily,
                accentColor,
                textColor,
            });
        }
    } else {
        const left = clamp(Math.round(w * 0.035), 8, 48);
        const top = clamp(Math.round(h * 0.07), 8, 72);
        const sidebarWidth = Math.min(w - left - safePad, Math.max(138, Math.round(shortSide * 0.34)));
        const typography = fitMetricTypography(
            ctx, metrics, defaultTypography, sidebarWidth, fontFamily, valueWeight,
            labelTrackingRatio, 18,
        );
        const sidebarRows = metrics.filter((metric) => metric.progress !== undefined);
        const distanceMetric = metrics.find((metric) => metric.label === 'DISTANCE');
        const blockHeight = metricBlockHeight(typography, true);

        sidebarRows.forEach((metric, index) => {
            drawMetric(ctx, {
                x: left,
                y: top + index * blockHeight,
                width: sidebarWidth,
                center: false,
                metric,
                typography,
                fontFamily,
                valueWeight,
                accentColor,
                textColor,
                labelTracking: labelTrackingRatio.tracking,
            });
        });

        if (distanceMetric) {
            drawMetric(ctx, {
                x: left,
                y: top + sidebarRows.length * blockHeight,
                width: sidebarWidth,
                center: false,
                metric: distanceMetric,
                typography,
                fontFamily,
                valueWeight,
                accentColor,
                textColor,
                labelTracking: labelTrackingRatio.tracking,
            });
        }

        if (speedAvailable) {
            const desiredDiameter = clamp(Math.round(shortSide * 0.3), 112, 320);
            const bottomInset = clamp(Math.round(h * 0.055), 20, 72);
            const contentBottom = distanceMetric
                ? top + sidebarRows.length * blockHeight + typography.labelSize
                    + typography.gapLabelToValue + typography.valueSize
                : top + sidebarRows.length * blockHeight;
            const availableDiameter = Math.max(0, 2 * (h - bottomInset - contentBottom - 24));
            const diameter = Math.min(desiredDiameter, availableDiameter);

            if (diameter >= 96) {
                drawSpeedometerGauge(ctx, {
                    cx: left + sidebarWidth / 2,
                    cy: h - bottomInset - diameter / 2,
                    diameter,
                    speedKmh: frame.speedKmh,
                    maxSpeed: 60,
                    fontFamily,
                    accentColor,
                    textColor,
                });
            }
        }
    }

    ctx.restore();
}

function drawMetric(
    ctx: OverlayContext2D,
    params: {
        x: number;
        y: number;
        width: number;
        center: boolean;
        metric: DisplayMetric;
        typography: MetricTypography;
        fontFamily: string;
        valueWeight: number;
        accentColor: string;
        textColor: string;
        labelTracking: number;
    },
): void {
    const { metric, typography: typ } = params;
    const centerX = params.center ? params.x : params.x + params.width / 2;
    const labelX = params.center ? centerX : params.x;
    const labelBaseline = params.y + typ.labelSize;
    const valueBaseline = labelBaseline + typ.gapLabelToValue + typ.valueSize;
    const unitGap = Math.max(3, Math.round(typ.valueSize * 0.12));
    const align: CanvasTextAlign = params.center ? 'center' : 'left';

    drawOutlinedText(
        ctx,
        metric.label,
        labelX,
        labelBaseline,
        `500 ${typ.labelSize}px ${params.fontFamily}`,
        'rgba(248,250,252,0.92)',
        align,
        typ.labelSize,
        params.labelTracking,
    );

    ctx.font = `${params.valueWeight} ${typ.valueSize}px ${params.fontFamily}`;
    const valueWidth = ctx.measureText(metric.value).width;
    let unitWidth = 0;
    if (metric.unit) {
        ctx.font = `600 ${typ.unitSize}px ${params.fontFamily}`;
        unitWidth = ctx.measureText(metric.unit).width;
    }
    const groupWidth = valueWidth + (metric.unit ? unitGap + unitWidth : 0);
    const groupLeft = params.center ? centerX - groupWidth / 2 : params.x;

    drawOutlinedText(
        ctx,
        metric.value,
        groupLeft,
        valueBaseline,
        `${params.valueWeight} ${typ.valueSize}px ${params.fontFamily}`,
        params.textColor,
        'left',
        typ.valueSize,
    );

    if (metric.unit) {
        drawOutlinedText(
            ctx,
            metric.unit,
            groupLeft + valueWidth + unitGap,
            valueBaseline - Math.max(0, Math.round((typ.valueSize - typ.unitSize) * 0.16)),
            `600 ${typ.unitSize}px ${params.fontFamily}`,
            metric.value === 'N/A' ? 'rgba(0,230,118,0.72)' : params.accentColor,
            'left',
            typ.unitSize,
        );
    }

    if (metric.progress !== undefined) {
        const barWidth = Math.max(8, params.width * (params.center ? 0.68 : 0.78));
        const barLeft = params.center ? centerX - barWidth / 2 : params.x;
        const barTop = valueBaseline + typ.gapValueToBar;
        ctx.fillStyle = 'rgba(4,10,16,0.42)';
        ctx.fillRect(barLeft, barTop, barWidth, typ.barHeight);
        ctx.fillStyle = params.accentColor;
        ctx.fillRect(barLeft, barTop, Math.max(1, barWidth * clamp(metric.progress, 0, 1)), typ.barHeight);
    }
}

function drawOutlinedText(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign,
    size: number,
    tracking = 0,
): void {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(4,10,16,0.92)';
    ctx.lineWidth = clamp(size * 0.09, 0.8, 2.5);
    ctx.letterSpacing = `${size * tracking}px`;
    if (typeof ctx.strokeText === 'function') ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.letterSpacing = '0px';
}
