import type { TelemetryFrame, ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { applyTextShadow, getResolutionTuning } from '../overlayUtils';
import { drawSpeedometerGauge } from './speedometerGauge';

type SidebarMetricKey = 'cadenceRpm' | 'powerWatts' | 'hr';

interface SidebarMetricDefinition {
    label: string;
    key: SidebarMetricKey;
    unit: string;
    max: number;
}

const SIDEBAR_METRICS: readonly SidebarMetricDefinition[] = [
    { label: 'Cadence', key: 'cadenceRpm', unit: 'RPM', max: 120 },
    { label: 'Power', key: 'powerWatts', unit: 'W', max: 500 },
    { label: 'Heart rate', key: 'hr', unit: 'BPM', max: 200 },
];

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
    const accentColor = config.accentColor || '#00E676';
    const left = Math.round(w * (portrait ? 0.038 : 0.028));
    const top = Math.round(h * (portrait ? 0.068 : 0.07));
    const sidebarWidth = portrait
        ? Math.max(156, Math.round(shortSide * 0.255))
        : Math.max(188, Math.round(shortSide * 0.28));
    const metricBlockHeight = portrait
        ? Math.max(48, Math.round(shortSide * 0.13 * tuning.spacingScale))
        : Math.max(54, Math.round(shortSide * 0.14 * tuning.spacingScale));
    const gaugeDiameter = portrait
        ? Math.max(112, Math.round(shortSide * 0.27))
        : Math.max(120, Math.round(shortSide * 0.3));
    const gaugeRadius = gaugeDiameter / 2;
    const gaugeCenterX = left + Math.round(sidebarWidth * 0.5);
    const gaugeBottomInset = Math.round(h * (portrait ? 0.085 : 0.055));
    const gaugeCenterY = h - gaugeBottomInset - gaugeRadius;
    const distanceBaseline = gaugeCenterY - gaugeRadius - Math.max(24, Math.round(h * (portrait ? 0.06 : 0.05)));
    const backdropX = left - Math.round(sidebarWidth * 0.12);
    const backdropY = top - Math.round(h * 0.02);
    const backdropWidth = sidebarWidth + Math.round(w * (portrait ? 0.08 : 0.06));
    const backdropBottom = distanceBaseline + Math.round(h * 0.018);

    ctx.save();
    applyTextShadow(ctx, config);

    drawSidebarBackdrop(ctx, backdropX, backdropY, backdropWidth, Math.max(0, backdropBottom - backdropY), portrait);

    const availableMetrics = SIDEBAR_METRICS.filter((metric) => frame[metric.key] !== undefined);
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
            textScale: tuning.textScale,
            compact: shortSide < 480 || portrait,
            accentColor,
            placeholder: false,
        });
    });

    drawDistanceCallout(ctx, {
        x: left,
        baselineY: distanceBaseline,
        distanceValue: frame.distanceKm.toFixed(1),
        fontFamily: config.fontFamily,
        textScale: tuning.textScale,
        compact: shortSide < 480 || portrait,
        accentColor,
    });

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
        textScale: number;
        compact: boolean;
        accentColor: string;
        placeholder: boolean;
        statusText?: string;
    },
): void {
    const valueSize = params.compact
        ? Math.max(22, Math.round(36 * params.textScale))
        : Math.max(30, Math.round(50 * params.textScale));
    const unitSize = params.compact
        ? Math.max(10, Math.round(12 * params.textScale))
        : Math.max(13, Math.round(18 * params.textScale));
    const labelSize = params.compact
        ? Math.max(10, Math.round(12 * params.textScale))
        : Math.max(14, Math.round(19 * params.textScale));
    const statusSize = params.compact
        ? Math.max(8, Math.round(10 * params.textScale))
        : Math.max(9, Math.round(12 * params.textScale));
    const valueBaseline = params.y + valueSize;
    const labelBaseline = valueBaseline + Math.round((params.compact ? 14 : 20) * params.textScale);
    const statusBaseline = params.statusText
        ? labelBaseline + Math.round((params.compact ? 10 : 13) * params.textScale)
        : undefined;
    const barTop = (statusBaseline ?? labelBaseline) + Math.round((params.compact ? 8 : 14) * params.textScale);
    const barWidth = Math.round(params.width * 0.78);
    const barHeight = Math.max(4, Math.round((params.compact ? 4 : 5) * params.textScale));

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = params.placeholder ? 'rgba(255,255,255,0.82)' : '#FFFFFF';
    ctx.font = `${params.placeholder ? 500 : 400} ${valueSize}px ${params.fontFamily}`;
    ctx.fillText(params.value, params.x, valueBaseline);

    if (params.unit) {
        ctx.fillStyle = params.unitColor;
        ctx.font = `700 ${unitSize}px ${params.fontFamily}`;
        ctx.fillText(
            params.unit,
            params.x + ctx.measureText(params.value).width + 8,
            valueBaseline - Math.round(valueSize * 0.42),
        );
    }

    ctx.fillStyle = params.placeholder ? 'rgba(255,255,255,0.56)' : 'rgba(255,255,255,0.72)';
    ctx.font = `500 ${labelSize}px ${params.fontFamily}`;
    ctx.fillText(params.label, params.x, labelBaseline);

    if (params.statusText) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `700 ${statusSize}px ${params.fontFamily}`;
        ctx.fillText(params.statusText, params.x, statusBaseline!);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(params.x, barTop, barWidth, barHeight);

    if (params.placeholder) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(params.x, barTop, Math.max(14, barWidth * 0.18), barHeight);
        return;
    }

    ctx.fillStyle = params.accentColor;
    ctx.fillRect(params.x, barTop, barWidth * params.progress, barHeight);
}

function drawDistanceCallout(
    ctx: OverlayContext2D,
    params: {
        x: number;
        baselineY: number;
        distanceValue: string;
        fontFamily: string;
        textScale: number;
        compact: boolean;
        accentColor: string;
    },
): void {
    const labelSize = params.compact
        ? Math.max(10, Math.round(12 * params.textScale))
        : Math.max(12, Math.round(16 * params.textScale));
    const valueSize = params.compact
        ? Math.max(26, Math.round(34 * params.textScale))
        : Math.max(32, Math.round(54 * params.textScale));
    const unitSize = params.compact
        ? Math.max(12, Math.round(14 * params.textScale))
        : Math.max(16, Math.round(20 * params.textScale));

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = `600 ${labelSize}px ${params.fontFamily}`;
    ctx.fillText('Distance', params.x, params.baselineY - Math.round(valueSize * 0.78));

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `300 ${valueSize}px ${params.fontFamily}`;
    ctx.fillText(params.distanceValue, params.x, params.baselineY);

    ctx.fillStyle = params.accentColor;
    ctx.font = `700 ${unitSize}px ${params.fontFamily}`;
    ctx.fillText('KM', params.x + ctx.measureText(params.distanceValue).width + 8, params.baselineY - Math.round(unitSize * 0.18));
}
