import type { TelemetryFrame, ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { applyTextShadow, getResolutionTuning } from '../overlayUtils';
import { drawSpeedometerGauge } from './speedometerGauge';

type SidebarMetricKey = 'powerWatts' | 'hr';

interface SidebarMetricDefinition {
    label: string;
    key: SidebarMetricKey;
    configKey: 'showPower' | 'showHr';
    unit: string;
    max: number;
}

const SIDEBAR_METRICS: readonly SidebarMetricDefinition[] = [
    { label: 'Power', key: 'powerWatts', configKey: 'showPower', unit: 'W', max: 500 },
    { label: 'Heart rate', key: 'hr', configKey: 'showHr', unit: 'BPM', max: 200 },
];

interface MetricTypography {
    valueSize: number;
    unitSize: number;
    labelSize: number;
    barHeight: number;
    gapValueToLabel: number;
    gapLabelToBar: number;
    gapBetweenBlocks: number;
}

function getMetricTypography(textScale: number, compact: boolean): MetricTypography {
    return {
        valueSize: compact
            ? Math.max(24, Math.round(40 * textScale))
            : Math.max(32, Math.round(54 * textScale)),
        unitSize: compact
            ? Math.max(16, Math.round(20 * textScale))
            : Math.max(20, Math.round(26 * textScale)),
        labelSize: compact
            ? Math.max(13, Math.round(16 * textScale))
            : Math.max(16, Math.round(22 * textScale)),
        barHeight: Math.max(4, Math.round((compact ? 4 : 5) * textScale)),
        gapValueToLabel: Math.round((compact ? 12 : 18) * textScale),
        gapLabelToBar: Math.round((compact ? 10 : 16) * textScale),
        gapBetweenBlocks: Math.round((compact ? 14 : 22) * textScale),
    };
}

function sidebarContentHeight(t: MetricTypography): number {
    return t.valueSize + t.gapValueToLabel + t.labelSize + t.gapLabelToBar + t.barHeight;
}

export function renderCyclingProLayout(
    ctx: OverlayContext2D,
    frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);
    const shortSide = Math.min(w, h);
    const portrait = h > w;
    const compact = shortSide < 480 || portrait;
    const accentColor = config.accentColor || '#00E676';
    const left = Math.round(w * (portrait ? 0.038 : 0.028));
    const top = Math.round(h * (portrait ? 0.068 : 0.07));
    const sidebarWidth = portrait
        ? Math.max(156, Math.round(shortSide * 0.255))
        : Math.max(188, Math.round(shortSide * 0.28));
    const typ = getMetricTypography(tuning.textScale, compact);
    const metricBlockHeight = sidebarContentHeight(typ) + typ.gapBetweenBlocks;
    const gaugeDiameter = portrait
        ? Math.max(112, Math.round(shortSide * 0.27))
        : Math.max(120, Math.round(shortSide * 0.3));
    const gaugeRadius = gaugeDiameter / 2;
    const gaugeCenterX = left + Math.round(sidebarWidth * 0.5);
    const gaugeBottomInset = Math.round(h * (portrait ? 0.085 : 0.055));
    const gaugeCenterY = h - gaugeBottomInset - gaugeRadius;
    const backdropX = left - Math.round(sidebarWidth * 0.12);
    const backdropY = top - Math.round(h * 0.02);
    const backdropWidth = sidebarWidth + Math.round(w * (portrait ? 0.08 : 0.06));

    ctx.save();
    applyTextShadow(ctx, config);

    const availableMetrics = SIDEBAR_METRICS.filter(
        (metric) => config[metric.configKey] !== false && frame[metric.key] !== undefined,
    );
    availableMetrics.forEach((metric, index) => {
        const rawValue = frame[metric.key]!;
        drawSidebarMetric(ctx, {
            x: left,
            y: top + index * metricBlockHeight,
            label: metric.label,
            unit: metric.unit,
            unitColor: accentColor,
            value: Math.round(rawValue).toString(),
            progress: Math.max(0, Math.min(1, rawValue / metric.max)),
            width: sidebarWidth,
            fontFamily: config.fontFamily,
            typ,
            accentColor,
            placeholder: false,
        });
    });

    if (config.showDistance !== false) {
        const lastMetricBottom = availableMetrics.length > 0
            ? top + availableMetrics.length * metricBlockHeight
            : top;
        const distanceValueY = lastMetricBottom + typ.valueSize;

        drawDistanceCallout(ctx, {
            x: left,
            valueBaselineY: distanceValueY,
            distanceValue: frame.distanceKm.toFixed(1),
            fontFamily: config.fontFamily,
            typ,
            accentColor,
        });
    }

    const lastBlockBottom = availableMetrics.length > 0
        ? top + availableMetrics.length * metricBlockHeight
        : top;
    const distanceContentHeight = config.showDistance !== false
        ? typ.valueSize + typ.gapValueToLabel + typ.labelSize
        : 0;
    const backdropBottom = lastBlockBottom + distanceContentHeight + Math.round(h * (portrait ? 0.04 : 0.03));
    drawSidebarBackdrop(ctx, backdropX, backdropY, backdropWidth, Math.max(0, backdropBottom - backdropY), portrait);

    if (config.showSpeed !== false) {
        drawSpeedometerGauge(ctx, {
            cx: gaugeCenterX,
            cy: gaugeCenterY,
            diameter: gaugeDiameter,
            speedKmh: frame.speedKmh ?? 0,
            maxSpeed: 60,
            fontFamily: config.fontFamily,
            accentColor,
            textColor: config.textColor || '#FFFFFF',
            backgroundColor: portrait ? 'rgba(2, 14, 7, 0.68)' : 'rgba(2, 14, 7, 0.74)',
        });
    }

    ctx.restore();
}

function drawSidebarBackdrop(
    ctx: OverlayContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    portrait: boolean,
): void {
    if (typeof ctx.createLinearGradient === 'function') {
        const gradient = ctx.createLinearGradient(x, y, x + width, y);
        gradient.addColorStop(0, portrait ? 'rgba(0,0,0,0.48)' : 'rgba(0,0,0,0.36)');
        gradient.addColorStop(0.5, portrait ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.14)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = portrait ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)';
    }

    ctx.fillRect(x, y, width, height);
}

function drawUnit(
    ctx: OverlayContext2D,
    unit: string,
    unitColor: string,
    x: number,
    valueWidth: number,
    valueBaseline: number,
    valueSize: number,
    unitSize: number,
    fontFamily: string,
): void {
    ctx.fillStyle = unitColor;
    ctx.font = `700 ${unitSize}px ${fontFamily}`;
    ctx.fillText(
        unit,
        x + valueWidth + 16,
        valueBaseline - Math.round(0.4 * (valueSize - unitSize)),
    );
}

function drawSidebarMetric(
    ctx: OverlayContext2D,
    params: {
        x: number;
        y: number;
        label: string;
        unit: string;
        unitColor: string;
        value: string;
        progress: number;
        width: number;
        fontFamily: string;
        typ: MetricTypography;
        accentColor: string;
        placeholder: boolean;
    },
): void {
    const t = params.typ;
    const valueBaseline = params.y + t.valueSize;
    const labelBaseline = valueBaseline + t.gapValueToLabel;
    const barTop = labelBaseline + t.labelSize + t.gapLabelToBar;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = params.placeholder ? 'rgba(255,255,255,0.82)' : '#FFFFFF';
    ctx.font = `${params.placeholder ? 500 : 300} ${t.valueSize}px ${params.fontFamily}`;
    ctx.fillText(params.value, params.x, valueBaseline);

    if (params.unit) {
        const valueWidth = ctx.measureText(params.value).width;
        drawUnit(ctx, params.unit, params.unitColor, params.x, valueWidth, valueBaseline, t.valueSize, t.unitSize, params.fontFamily);
    }

    ctx.fillStyle = params.placeholder ? 'rgba(255,255,255,0.56)' : '#FFFFFF';
    ctx.font = `500 ${t.labelSize}px ${params.fontFamily}`;
    ctx.fillText(params.label, params.x, labelBaseline);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(params.x, barTop, Math.round(params.width * 0.78), t.barHeight);

    if (params.placeholder) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(params.x, barTop, Math.max(14, Math.round(params.width * 0.78) * 0.18), t.barHeight);
        return;
    }

    ctx.fillStyle = params.accentColor;
    ctx.fillRect(params.x, barTop, Math.round(params.width * 0.78 * params.progress), t.barHeight);
}

function drawDistanceCallout(
    ctx: OverlayContext2D,
    params: {
        x: number;
        valueBaselineY: number;
        distanceValue: string;
        fontFamily: string;
        typ: MetricTypography;
        accentColor: string;
    },
): void {
    const t = params.typ;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `300 ${t.valueSize}px ${params.fontFamily}`;
    ctx.fillText(params.distanceValue, params.x, params.valueBaselineY);

    const distValueWidth = ctx.measureText(params.distanceValue).width;
    drawUnit(ctx, 'KM', params.accentColor, params.x, distValueWidth, params.valueBaselineY, t.valueSize, t.unitSize, params.fontFamily);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `500 ${t.labelSize}px ${params.fontFamily}`;
    ctx.fillText('Distance', params.x, params.valueBaselineY + t.gapValueToLabel);
}
