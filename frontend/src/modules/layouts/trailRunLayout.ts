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
            value: frame.hr !== undefined ? Math.round(frame.hr).toString() : 'N/A',
            unit: 'bpm',
        },
        {
            label: 'GRADE',
            value: frame.gradePercent !== undefined ? Math.round(frame.gradePercent).toString() : 'N/A',
            unit: '%',
        },
        {
            label: 'ELEVATION',
            value: frame.elevationM !== undefined ? Math.round(frame.elevationM).toString() : 'N/A',
            unit: 'm',
        },
    ];

    const columns = allColumns;

    const columnWidth = w / columns.length;
    columns.forEach((metric, index) => {
        const columnLeft = index * columnWidth + (index === 0 ? leftPad : 0);
        drawTrailMetric(
            ctx,
            columnLeft,
            metricTop,
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

function fillHistoryToPixelDensity(history: number[], pixelCount: number): number[] {
    if (history.length < 2 || pixelCount <= 1) {
        return history;
    }

    const filled: number[] = new Array(pixelCount);
    const step = (history.length - 1) / (pixelCount - 1);

    for (let pixel = 0; pixel < pixelCount; pixel++) {
        const srcIndex = pixel * step;
        const lo = Math.floor(srcIndex);
        const hi = Math.min(lo + 1, history.length - 1);
        const t = srcIndex - lo;
        filled[pixel] = Math.round(history[lo]! + t * (history[hi]! - history[lo]!));
    }

    return filled;
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

    // Pre-fill the history to one sample per horizontal pixel so the
    // trace animates smoothly regardless of the original sampling cadence.
    // Missing intermediate values are linearly interpolated between the
    // nearest known samples.
    const filled = fillHistoryToPixelDensity(history, Math.round(width));

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(1.8, width * 0.0022);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.58)';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    // Convert the pixel‑dense samples to a smooth curve using
    // Catmull‑Rom → cubic Bézier, so the trace reads as a
    // continuous wave rather than a polyline.
    const points = filled.map((value, index) => ({
        x: left + (index / Math.max(1, filled.length - 1)) * width,
        y: top + height - ((value - minHr) / range) * height,
    }));

    ctx.moveTo(points[0]!.x, points[0]!.y);

    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1]!;
        const curr = points[i]!;
        const next = points[i + 1]!;

        // Catmull‑Rom control points for cubic Bézier.
        const cp1x = curr.x - (next.x - prev.x) / 6;
        const cp1y = curr.y - (next.y - prev.y) / 6;
        const cp2x = curr.x + (next.x - prev.x) / 6;
        const cp2y = curr.y + (next.y - prev.y) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y);
    }

    // Close the curve to the final point.
    ctx.lineTo(points[points.length - 1]!.x, points[points.length - 1]!.y);

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

    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(metric.value, left, valueBaseline);

    // Position the unit right after the value with a gap that scales
    // with the value font size.  This keeps the spacing visually
    // consistent regardless of whether the value is a single digit
    // (e.g. grade "8") or four digits (e.g. elevation "2921").
    const valueWidth = ctx.measureText(metric.value).width;
    const unitGap = Math.round(valueSize * 0.08);
    ctx.fillStyle = metric.value === 'N/A' ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.8)';
    ctx.font = `500 ${unitSize}px ${config.fontFamily}`;
    // Vertically align the unit slightly above the value baseline so it
    // reads as a superscript annotation rather than overlapping the number.
    const unitVerticalOffset = Math.round(unitSize * 0.35);
    ctx.fillText(metric.unit, left + valueWidth + unitGap, valueBaseline - unitVerticalOffset);
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
