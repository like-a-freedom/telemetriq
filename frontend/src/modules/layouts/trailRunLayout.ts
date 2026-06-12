import type { TelemetryFrame, ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { applyTextShadow, getResolutionTuning } from '../overlayUtils';
import type { OverlayRenderContext } from '../overlayRenderer';

interface TrailMetric {
    label: string;
    value: string;
    unit: string;
}

export function renderTrailRunLayout(
    ctx: OverlayContext2D,
    frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    renderContext: OverlayRenderContext,
): void {
    const tuning = getResolutionTuning(w, h);
    const shortSide = Math.min(w, h);
    const compact = shortSide < 480;
    const history = (renderContext.hrHistory ?? []).slice(-60);
    const topInset = Math.round(h * 0.038);
    const graphLeft = Math.round(w * 0.04);
    const graphWidth = Math.round(w * 0.82);
    const graphHeight = Math.round(h * 0.062);
    const metricTop = topInset + graphHeight + Math.round(h * 0.028 * tuning.spacingScale);
    const metricBandBottom = metricTop + Math.round(h * (compact ? 0.082 : 0.07));
    const leftPad = Math.max(Math.round(w * 0.014), compact ? Math.round(w * 0.05) : 0);

    ctx.save();
    applyTextShadow(ctx, config);

    drawTopFade(ctx, w, topInset + graphHeight + Math.round(h * 0.018));
    drawMetricSupport(ctx, 0, topInset - Math.round(h * 0.012), w, metricBandBottom - topInset + Math.round(h * 0.03));

    if (history.length >= 2) {
        drawHeartRateTrace(ctx, history, graphLeft, topInset, graphWidth, graphHeight, config.accentColor || '#FF3B30');
    }

    const allColumns: readonly TrailMetric[] = [
        {
            label: 'HR',
            value: frame.hr !== undefined ? Math.round(frame.hr).toString() : '--',
            unit: 'bpm',
        },
        {
            label: 'GRADE',
            value: frame.gradePercent !== undefined ? Math.round(frame.gradePercent).toString() : '--',
            unit: '%',
        },
        {
            label: 'ELEVATION',
            value: frame.elevationM !== undefined ? Math.round(frame.elevationM).toString() : '--',
            unit: 'm',
        },
    ];

    const columns = allColumns.filter((metric) => metric.value !== '--');

    const columnWidth = w / columns.length;
    columns.forEach((metric, index) => {
        const columnLeft = index * columnWidth + (index === 0 ? leftPad : 0);
        drawTrailMetric(
            ctx,
            columnLeft,
            metricTop,
            columnWidth,
            h,
            tuning.textScale,
            compact,
            config,
            metric,
        );

        if (index < columns.length - 1) {
            drawColumnSeparator(ctx, columnLeft + columnWidth - Math.round(w * 0.028), metricTop - Math.round(h * 0.004), h);
        }
    });

    ctx.restore();
}

function drawHeartRateTrace(
    ctx: OverlayContext2D,
    history: number[],
    left: number,
    top: number,
    width: number,
    height: number,
    accentColor: string,
): void {
    const minHr = Math.min(...history);
    const maxHr = Math.max(...history);
    const range = Math.max(1, maxHr - minHr);

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, top + height);
    ctx.lineTo(left + width, top + height);
    ctx.stroke();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(1.8, width * 0.0022);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.58)';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    history.forEach((value, index) => {
        const x = left + (index / Math.max(1, history.length - 1)) * width;
        const normalized = (value - minHr) / range;
        const y = top + height - normalized * height;
        if (index === 0) {
            ctx.moveTo(x, y);
            return;
        }
        ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.shadowBlur = 0;

    const lastValue = history[history.length - 1]!;
    const lastY = top + height - (((lastValue - minHr) / range) * height);
    const dotX = left + width;
    const dotRadius = Math.max(5, width * 0.0065);

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(dotX, lastY, dotRadius + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(dotX, lastY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
}

function drawTopFade(ctx: OverlayContext2D, width: number, fadeBottom: number): void {
    if (typeof ctx.fillRect !== 'function') {
        return;
    }

    if (typeof ctx.createLinearGradient === 'function') {
        const gradient = ctx.createLinearGradient(0, 0, 0, fadeBottom);
        gradient.addColorStop(0, 'rgba(0,0,0,0.24)');
        gradient.addColorStop(0.42, 'rgba(0,0,0,0.1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
    }

    ctx.fillRect(0, 0, width, fadeBottom);
}

function drawMetricSupport(
    ctx: OverlayContext2D,
    left: number,
    top: number,
    width: number,
    height: number,
): void {
    if (typeof ctx.fillRect !== 'function') {
        return;
    }

    if (typeof ctx.createLinearGradient === 'function') {
        const gradient = ctx.createLinearGradient(0, top, 0, top + height);
        gradient.addColorStop(0, 'rgba(0,0,0,0.18)');
        gradient.addColorStop(0.58, 'rgba(0,0,0,0.12)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
    }

    ctx.fillRect(left, top, width, height);
}

function drawTrailMetric(
    ctx: OverlayContext2D,
    left: number,
    top: number,
    columnWidth: number,
    h: number,
    textScale: number,
    compact: boolean,
    config: ExtendedOverlayConfig,
    metric: TrailMetric,
): void {
    const labelSize = compact
        ? Math.max(9, Math.round(h * 0.013 * textScale))
        : Math.max(13, Math.round(h * 0.014 * textScale));
    const valueSize = compact
        ? Math.max(25, Math.round(h * 0.036 * textScale))
        : Math.max(38, Math.round(h * 0.05 * textScale));
    const unitSize = compact
        ? Math.max(10, Math.round(valueSize * 0.22))
        : Math.max(13, Math.round(valueSize * 0.25));
    const valueBaseline = top + valueSize + Math.round(labelSize * 1.15);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = 'rgba(255,255,255,0.74)';
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(metric.label, left, top);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(metric.value, left, valueBaseline);

    const unitOffset = Math.min(columnWidth * 0.5, ctx.measureText(metric.value).width + Math.round(columnWidth * 0.065));
    ctx.fillStyle = metric.value === '--' ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.8)';
    ctx.font = `500 ${unitSize}px ${config.fontFamily}`;
    ctx.fillText(metric.unit, left + unitOffset, valueBaseline - Math.round(unitSize * 0.08));
}

function drawColumnSeparator(
    ctx: OverlayContext2D,
    x: number,
    top: number,
    h: number,
): void {
    const separatorHeight = Math.round(h * 0.055);
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + separatorHeight);
    ctx.stroke();
}
