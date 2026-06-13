import type { TelemetryFrame, ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { applyTextShadow, getResolutionTuning } from '../overlayUtils';
import type { OverlayRenderContext } from '../overlayRenderer';

interface TrailMetric {
    label: string;
    value: string;
    unit: string;
}

function formatPace(secondsPerKm: number | undefined): string {
    if (secondsPerKm === undefined || !Number.isFinite(secondsPerKm)) return 'N/A';
    const min = Math.floor(secondsPerKm / 60);
    const sec = Math.round(secondsPerKm % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function buildTrailColumns(
    frame: TelemetryFrame,
    config: ExtendedOverlayConfig,
): TrailMetric[] {
    const columns: TrailMetric[] = [];

    if (config.showPace) {
        columns.push({
            label: 'PACE',
            value: formatPace(frame.paceSecondsPerKm),
            unit: 'min/km',
        });
    }
    if (config.showHr) {
        columns.push({
            label: 'HR',
            value: frame.hr !== undefined ? Math.round(frame.hr).toString() : 'N/A',
            unit: 'bpm',
        });
    }
    if (config.showDistance) {
        columns.push({
            label: 'DISTANCE',
            value: Number.isFinite(frame.distanceKm) ? frame.distanceKm.toFixed(2) : 'N/A',
            unit: 'km',
        });
    }
    if (config.showTime) {
        columns.push({
            label: 'TIME',
            value: frame.elapsedTime || 'N/A',
            unit: '',
        });
    }
    if (config.showGrade) {
        columns.push({
            label: 'GRADE',
            value: frame.gradePercent !== undefined ? Math.round(frame.gradePercent).toString() : 'N/A',
            unit: '%',
        });
    }
    if (config.showElevation) {
        columns.push({
            label: 'ELEVATION',
            value: frame.elevationM !== undefined ? Math.round(frame.elevationM).toString() : 'N/A',
            unit: 'm',
        });
    }
    if (config.showPower) {
        columns.push({
            label: 'POWER',
            value: frame.powerWatts !== undefined ? Math.round(frame.powerWatts).toString() : 'N/A',
            unit: 'W',
        });
    }

    return columns;
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
    const history = renderContext.elevationHistory ?? [];
    const topInset = Math.round(h * 0.038);
    const graphLeft = Math.round(w * 0.04);
    const graphWidth = Math.round(w * 0.82);
    const graphHeight = Math.round(h * 0.062);
    const metricTop = topInset + graphHeight + Math.round(h * 0.028 * tuning.spacingScale);

    const allColumns = buildTrailColumns(frame, config);

    const columns = allColumns;

    // Pre-compute metric band height
    const metricBandBottom = metricTop + Math.round(h * (compact ? 0.082 : 0.07));

    ctx.save();
    applyTextShadow(ctx, config);

    drawTopFade(ctx, w, topInset + graphHeight + Math.round(h * 0.018));
    drawMetricSupport(ctx, 0, topInset - Math.round(h * 0.012), w, metricBandBottom - topInset + Math.round(h * 0.03));

    if (history.length >= 2) {
        drawElevationTrace(ctx, history, graphLeft, topInset, graphWidth, graphHeight, config.accentColor || '#36b37e');
    }

    drawGraphLabel(ctx, 'Elevation', graphLeft, topInset + Math.round(h * 0.004), config);

    // Measure widest value + widest unit at base size to compute a single
    // consistent font size for all columns.  Units are always inline.
    const baseValueSize = compact
        ? Math.max(25, Math.round(h * 0.036 * tuning.textScale))
        : Math.max(38, Math.round(h * 0.05 * tuning.textScale));
    const minValueSize = Math.max(12, Math.round(h * 0.016 * tuning.textScale));
    const baseUnitSize = Math.max(9, Math.round(baseValueSize * 0.22));
    const baseGap = Math.round(baseValueSize * 0.08);

    ctx.font = `300 ${baseValueSize}px ${config.fontFamily}`;
    let maxValWidth = 0;
    for (const metric of columns) {
        const tw = ctx.measureText(metric.value).width;
        if (tw > maxValWidth) maxValWidth = tw;
    }

    let maxUnitWidth = 0;
    const unitsWithText = columns.filter((m) => m.unit.length > 0);
    if (unitsWithText.length > 0) {
        ctx.font = `500 ${baseUnitSize}px ${config.fontFamily}`;
        for (const metric of unitsWithText) {
            const tw = ctx.measureText(metric.unit).width;
            if (tw > maxUnitWidth) maxUnitWidth = tw;
        }
    }

    // Total width of value + gap + unit at base size
    const totalBaseWidth = maxValWidth + baseGap + maxUnitWidth;

    // Evenly distribute columns across the full frame width
    const colWidth = w / columns.length;
    const scale = Math.min(1, (colWidth * 0.88) / Math.max(1, totalBaseWidth));
    const valueSize = Math.max(minValueSize, Math.round(baseValueSize * scale));

    columns.forEach((metric, index) => {
        const colCenter = index * colWidth + colWidth / 2;
        drawTrailMetric(ctx, colCenter, metricTop, valueSize, config, metric);
        if (index < columns.length - 1 && columns.length <= 3) {
            const sepX = (index + 1) * colWidth - Math.round(w * 0.014);
            drawColumnSeparator(ctx, sepX, metricTop - Math.round(h * 0.004), h);
        }
    });

    ctx.restore();
}

/**
 * Build a smooth Catmull‑Rom curve through `points` and evaluate it at
 * `samples` equally‑spaced positions along the curve parameter.
 *
 * Each interior span uses a cardinal cubic spline that passes exactly
 * through the two neighbouring control points while keeping C¹
 * continuity.  The tension parameter controls how tight the curve hugs
 * the control points (0 = linear, 0.5 = standard Catmull‑Rom).
 */
function catmullRomChain(
    points: readonly { x: number; y: number }[],
    samples: number,
    _tension = 0.35,
): { x: number; y: number }[] {
    if (points.length < 2) return points as { x: number; y: number }[];
    if (points.length === 2) {
        const result: { x: number; y: number }[] = [];
        for (let i = 0; i < samples; i++) {
            const t = i / (samples - 1);
            result.push({
                x: points[0]!.x + t * (points[1]!.x - points[0]!.x),
                y: points[0]!.y + t * (points[1]!.y - points[0]!.y),
            });
        }
        return result;
    }

    const segSamples = Math.ceil(samples / (points.length - 1));
    const result: { x: number; y: number }[] = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)]!;
        const p1 = points[i]!;
        const p2 = points[i + 1]!;
        const p3 = points[Math.min(points.length - 1, i + 2)]!;

        for (let k = 0; k < segSamples; k++) {
            const t = k / segSamples;
            const t2 = t * t;
            const t3 = t2 * t;

            const x =
                0.5 * ((2 * p1.x) +
                    (-p0.x + p2.x) * t +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            const y =
                0.5 * ((2 * p1.y) +
                    (-p0.y + p2.y) * t +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

            result.push({ x, y });
        }
    }

    return result;
}

function buildSmoothBezierSegments(
    points: readonly { x: number; y: number }[],
    samples: number,
): Array<{ start: { x: number; y: number }; cp1: { x: number; y: number }; cp2: { x: number; y: number }; end: { x: number; y: number } }> {
    const dense = catmullRomChain(points, samples);

    if (dense.length < 2) {
        return [];
    }

    const segments = [];

    for (let i = 0; i < dense.length - 1; i++) {
        const prev = dense[i - 1] ?? dense[i]!;
        const current = dense[i]!;
        const next = dense[i + 1]!;
        const next2 = dense[i + 2] ?? next;

        const cp1 = {
            x: current.x + (next.x - prev.x) / 6,
            y: current.y + (next.y - prev.y) / 6,
        };
        const cp2 = {
            x: next.x - (next2.x - current.x) / 6,
            y: next.y - (next2.y - current.y) / 6,
        };

        segments.push({ start: current, cp1, cp2, end: next });
    }

    return segments;
}

function drawElevationTrace(
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

    // Build a dense Catmull‑Rom spline and render it as cubic Bézier
    // segments. This keeps the trace fluid instead of looking like a
    // stepped polyline when the HR history is short or sparse.
    const rawPoints = history.map((value, index) => ({
        x: left + (index / Math.max(1, history.length - 1)) * width,
        y: top + height - ((value - minHr) / range) * height,
    }));
    const samples = Math.max(96, history.length * 16);
    const bezierSegments = buildSmoothBezierSegments(rawPoints, samples);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(3.6, width * 0.0044);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.58)';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    if (bezierSegments.length > 0) {
        const first = bezierSegments[0]!;
        ctx.moveTo(first.start.x, first.start.y);

        for (const segment of bezierSegments) {
            ctx.bezierCurveTo(
                segment.cp1.x,
                segment.cp1.y,
                segment.cp2.x,
                segment.cp2.y,
                segment.end.x,
                segment.end.y,
            );
        }
    }

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

function drawGraphLabel(
    ctx: OverlayContext2D,
    label: string,
    left: number,
    top: number,
    config: ExtendedOverlayConfig,
): void {
    const fontSize = Math.max(9, Math.round(top * 0.35));
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.font = `500 ${fontSize}px ${config.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, left, top);
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
    colCenter: number,
    top: number,
    valueSize: number,
    config: ExtendedOverlayConfig,
    metric: TrailMetric,
): void {
    const labelSize = Math.max(8, Math.round(valueSize * 0.28));
    const unitSize = Math.max(9, Math.round(valueSize * 0.22));
    const gap = Math.round(valueSize * 0.08);
    const valueBaseline = top + valueSize + Math.round(labelSize * 1.15);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Label — centered above value
    ctx.fillStyle = 'rgba(255,255,255,0.74)';
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(metric.label, colCenter, top);

    // Measure value and unit widths for centering the group
    ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
    const valWidth = ctx.measureText(metric.value).width;

    let unitWidth = 0;
    if (metric.unit.length > 0) {
        ctx.font = `500 ${unitSize}px ${config.fontFamily}`;
        unitWidth = ctx.measureText(metric.unit).width;
    }

    const groupWidth = valWidth + gap + unitWidth;
    const groupLeft = colCenter - groupWidth / 2;

    // Value — left-aligned within centered group
    ctx.textAlign = 'left';
    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(metric.value, groupLeft, valueBaseline);

    // Unit — inline, to the right of value
    if (metric.unit.length > 0) {
        const unitVerticalOffset = Math.round(unitSize * 0.35);
        ctx.fillStyle = metric.value === 'N/A' ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.8)';
        ctx.font = `500 ${unitSize}px ${config.fontFamily}`;
        ctx.fillText(metric.unit, groupLeft + valWidth + gap, valueBaseline - unitVerticalOffset);
    }
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
