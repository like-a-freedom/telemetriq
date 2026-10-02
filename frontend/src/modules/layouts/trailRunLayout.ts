import type { TelemetryFrame, ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { fontWeightValue, getResolutionTuning, isValidElapsedText } from '../overlayUtils';
import type { OverlayRenderContext } from '../overlayRenderer';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

interface TrailMetric {
    label: string;
    value: string;
    unit: string;
}

function formatPace(secondsPerKm: number | undefined): string {
    if (secondsPerKm === undefined || !Number.isFinite(secondsPerKm)) return 'N/A';
    const totalSeconds = Math.max(0, Math.round(secondsPerKm));
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
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
            value: Number.isFinite(frame.hr) ? Math.round(frame.hr!).toString() : 'N/A',
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
            value: isValidElapsedText(frame.elapsedTime) ? frame.elapsedTime : 'N/A',
            unit: '',
        });
    }
    if (config.showGrade) {
        columns.push({
            label: 'GRADE',
            value: Number.isFinite(frame.gradePercent) ? Math.round(frame.gradePercent!).toString() : 'N/A',
            unit: '%',
        });
    }
    if (config.showElevation) {
        columns.push({
            label: 'ELEVATION',
            value: Number.isFinite(frame.elevationM) ? Math.round(frame.elevationM!).toString() : 'N/A',
            unit: 'm',
        });
    }
    if (config.showPower) {
        columns.push({
            label: 'POWER',
            value: Number.isFinite(frame.powerWatts) ? Math.round(frame.powerWatts!).toString() : 'N/A',
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
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const tuning = getResolutionTuning(w, h);
    const shortSide = Math.min(w, h);
    const history = renderContext.elevationHistory ?? [];
    const columns = buildTrailColumns(frame, config);
    const finiteHistory = history.filter(Number.isFinite);
    if (columns.length === 0 && finiteHistory.length < 2) return;

    const portrait = h > w * 1.12;
    const columnsPerRow = columns.length === 0
        ? 0
        : portrait
            ? Math.min(2, columns.length)
            : w < 900
                ? Math.min(4, columns.length)
                : columns.length;
    const rowCount = columnsPerRow > 0 ? Math.ceil(columns.length / columnsPerRow) : 0;
    const safePad = Math.max(6, Math.min(24, Math.round(shortSide * 0.035)));
    const gridWidth = Math.max(0, w - safePad * 2);
    const cellWidth = columnsPerRow > 0 ? gridWidth / columnsPerRow : 0;
    const graphLeft = Math.round(w * 0.045);
    const graphWidth = Math.max(0, w - graphLeft * 2);
    const topInset = Math.round(h * 0.038);
    const labelScale = Math.max(0.22, Math.min(0.7, config.labelSizeMultiplier ?? 0.32));
    const sizeScale = Math.max(0.5, Math.min(2.5, (config.fontSizePercent ?? 2.4) / 2.4))
        * Math.max(0.6, Math.min(2, (config.valueSizeMultiplier ?? 2.6) / 2.6))
        * tuning.textScale;
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const fontFamily = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const accentColor = config.accentColor || '#FF3B30';
    const hasHistory = finiteHistory.length >= 2;
    const desiredGraphHeight = hasHistory
        ? Math.max(8, Math.min(86, Math.round(shortSide * (portrait ? 0.1 : 0.062))))
        : 0;
    const topLabelSize = Math.max(9, Math.min(22, Math.round(shortSide * 0.022)));
    const graphLabelBaseline = topInset + topLabelSize;
    const tracePadding = Math.max(4, Math.round(topLabelSize * 0.72));
    const graphTop = graphLabelBaseline + tracePadding + Math.max(3, Math.round(topLabelSize * 0.35));
    const metricGap = Math.max(5, Math.min(20, Math.round(shortSide * 0.022)));
    const safeBottom = safePad;
    const baseValueSize = Math.max(12, Math.min(88,
        Math.round(shortSide * (shortSide < 480 ? 0.08 : 0.06) * sizeScale)));
    const minValueSize = Math.max(8, Math.min(12, Math.round(shortSide * 0.018)));
    const baseGap = Math.max(3, Math.min(8, Math.round(shortSide * 0.006)));
    const labelTrackingRatio = Math.max(0, Math.min(0.2, config.labelLetterSpacing ?? 0.12)) * 0.5;
    const valueReserves: Record<string, string> = {
        PACE: '000:00', HR: '0000', DISTANCE: '00000.00', TIME: '00:00:00',
        GRADE: '-000', ELEVATION: '-9999', POWER: '0000',
    };

    let selected: {
        valueSize: number;
        labelSize: number;
        unitSize: number;
        labelGap: number;
        itemHeight: number;
        rowGap: number;
        graphHeight: number;
        metricTop: number;
        tracking: number;
    } | undefined;

    const graphLabel = 'ELEVATION PROFILE';
    for (let graphHeight = desiredGraphHeight;
        graphHeight >= (hasHistory ? 8 : 0) && !selected;
        graphHeight -= 2) {
        const metricTop = hasHistory ? graphTop + graphHeight + metricGap : topInset;
        const availableMetricHeight = Math.max(0, h - safeBottom - metricTop);

        for (let valueSize = baseValueSize; valueSize >= minValueSize; valueSize -= 1) {
            const labelSize = Math.max(9, Math.min(32, Math.round(valueSize * labelScale)));
            const unitSize = Math.max(7, Math.round(valueSize * 0.46));
            const labelGap = Math.max(2, Math.round(labelSize * 0.35));
            const descenderPad = Math.max(2, Math.round(valueSize * 0.16));
            const itemHeight = labelSize + labelGap + valueSize + descenderPad;
            const rowGap = rowCount > 1 ? Math.max(4, Math.min(18, Math.round(shortSide * 0.018))) : 0;
            const gridHeight = rowCount > 0 ? rowCount * itemHeight + (rowCount - 1) * rowGap : 0;
            const tracking = labelSize * labelTrackingRatio;

            if (gridHeight > availableMetricHeight) continue;
            if (columns.length > 0) {
                ctx.font = `500 ${labelSize}px ${fontFamily}`;
                const widestLabel = Math.max(...columns.map((metric) =>
                    ctx.measureText(metric.label).width + Math.max(0, metric.label.length - 1) * tracking));
                if (widestLabel > cellWidth * 0.94) continue;

                ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
                const groupsFit = columns.every((metric) => {
                    const valueWidth = Math.max(
                        ctx.measureText(metric.value).width,
                        ctx.measureText(valueReserves[metric.label] ?? metric.value).width,
                    );
                    if (!metric.unit) return valueWidth <= cellWidth * 0.94;
                    ctx.font = `500 ${unitSize}px ${fontFamily}`;
                    const unitWidth = ctx.measureText(metric.unit).width;
                    ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
                    return valueWidth + baseGap + unitWidth <= cellWidth * 0.94;
                });
                if (!groupsFit) continue;
            }

            if (hasHistory) {
                ctx.font = `600 ${topLabelSize}px ${fontFamily}`;
                const graphLabelWidth = ctx.measureText(graphLabel).width
                    + (graphLabel.length - 1) * topLabelSize * 0.04;
                if (graphLabelWidth > w - graphLeft * 2) continue;
            }

            selected = {
                valueSize, labelSize, unitSize, labelGap, itemHeight, rowGap, graphHeight, metricTop, tracking,
            };
            break;
        }
    }

    if (!selected) return;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;

    if (hasHistory) {
        drawElevationTrace(ctx, finiteHistory, graphLeft, graphTop, graphWidth, selected.graphHeight, accentColor);
        drawGraphLabel(ctx, graphLabel, graphLeft, graphLabelBaseline, topLabelSize, fontFamily);
    }

    columns.forEach((metric, index) => {
        const row = Math.floor(index / columnsPerRow);
        const column = index % columnsPerRow;
        const rowItems = columns.slice(row * columnsPerRow, (row + 1) * columnsPerRow);
        const rowWidth = rowItems.length * cellWidth;
        const rowLeft = safePad + (gridWidth - rowWidth) / 2;
        const centerX = rowLeft + column * cellWidth + cellWidth / 2;
        const rowTop = selected.metricTop + row * (selected.itemHeight + selected.rowGap);
        drawTrailMetric(ctx, centerX, rowTop, selected.valueSize, selected.labelSize,
            selected.unitSize, selected.labelGap, selected.tracking, valueWeight,
            baseGap, fontFamily, accentColor, config.textColor || '#FFFFFF', metric);
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
    if (history.length < 2) return;
    const minElevation = Math.min(...history);
    const maxElevation = Math.max(...history);
    const range = Math.max(1, maxElevation - minElevation);

    ctx.strokeStyle = 'rgba(4,10,16,0.48)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(left, top + height);
    ctx.lineTo(left + width, top + height);
    ctx.stroke();

    // Build a dense Catmull‑Rom spline and render it as cubic Bézier
    // segments. This keeps the trace fluid instead of looking like a
    // stepped polyline when the elevation history is short or sparse.
    const rawPoints = history.map((value, index) => ({
        x: left + (index / Math.max(1, history.length - 1)) * width,
        y: top + height - ((value - minElevation) / range) * height,
    }));
    const samples = Math.max(96, history.length * 16);
    const bezierSegments = buildSmoothBezierSegments(rawPoints, samples);

    const clampY = (y: number) => Math.max(top, Math.min(top + height, y));

    const traceWidth = Math.max(2.5, width * 0.0028);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const drawCurve = () => {
        ctx.beginPath();
        if (bezierSegments.length === 0) return;
        const first = bezierSegments[0]!;
        ctx.moveTo(first.start.x, clampY(first.start.y));

        for (const segment of bezierSegments) {
            ctx.bezierCurveTo(
                segment.cp1.x,
                clampY(segment.cp1.y),
                segment.cp2.x,
                clampY(segment.cp2.y),
                segment.end.x,
                clampY(segment.end.y),
            );
        }
        ctx.stroke();
    };

    // A narrow dark keyline keeps the red trace defined on both bright and
    // dark footage without placing a tint behind the video.
    ctx.strokeStyle = 'rgba(4,10,16,0.82)';
    ctx.lineWidth = traceWidth + 2;
    drawCurve();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = traceWidth;
    drawCurve();

    const lastValue = history[history.length - 1]!;
    const lastY = top + height - (((lastValue - minElevation) / range) * height);
    const dotX = left + width;
    const dotRadius = Math.max(5, width * 0.0065);

    ctx.fillStyle = 'rgba(4,10,16,0.9)';
    ctx.beginPath();
    ctx.arc(dotX, lastY, dotRadius + 1.5, 0, Math.PI * 2);
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
    baseline: number,
    fontSize: number,
    fontFamily: string,
): void {
    ctx.fillStyle = 'rgba(248,250,252,0.96)';
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(0.8, Math.min(1.5, fontSize * 0.1));
    ctx.strokeStyle = 'rgba(4,10,16,0.9)';
    ctx.letterSpacing = `${fontSize * 0.04}px`;
    if (typeof ctx.strokeText === 'function') ctx.strokeText(label, left, baseline);
    ctx.fillText(label, left, baseline);
    ctx.letterSpacing = '0px';
}

function drawTrailMetric(
    ctx: OverlayContext2D,
    colCenter: number,
    top: number,
    valueSize: number,
    labelSize: number,
    unitSize: number,
    labelGap: number,
    tracking: number,
    valueWeight: number,
    gap: number,
    fontFamily: string,
    accentColor: string,
    textColor: string,
    metric: TrailMetric,
): void {
    const valueBaseline = top + labelSize + labelGap + valueSize;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Label — centered above value
    ctx.fillStyle = 'rgba(248,250,252,0.94)';
    ctx.font = `500 ${labelSize}px ${fontFamily}`;
    ctx.lineWidth = Math.max(0.8, Math.min(1.4, labelSize * 0.1));
    ctx.strokeStyle = 'rgba(4,10,16,0.9)';
    ctx.letterSpacing = `${tracking}px`;
    if (typeof ctx.strokeText === 'function') ctx.strokeText(metric.label, colCenter, top + labelSize);
    ctx.fillText(metric.label, colCenter, top + labelSize);
    ctx.letterSpacing = '0px';

    // Measure value and unit widths for centering the group
    ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
    const valWidth = ctx.measureText(metric.value).width;

    let unitWidth = 0;
    if (metric.unit.length > 0) {
        ctx.font = `600 ${unitSize}px ${fontFamily}`;
        unitWidth = ctx.measureText(metric.unit).width;
    }

    const groupWidth = valWidth + (metric.unit ? gap + unitWidth : 0);
    const groupLeft = colCenter - groupWidth / 2;

    // Value — left-aligned within centered group
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;
    ctx.font = `${valueWeight} ${valueSize}px ${fontFamily}`;
    ctx.lineWidth = Math.max(0.9, Math.min(2.6, valueSize * 0.085));
    ctx.strokeStyle = 'rgba(4,10,16,0.9)';
    if (typeof ctx.strokeText === 'function') ctx.strokeText(metric.value, groupLeft, valueBaseline);
    ctx.fillText(metric.value, groupLeft, valueBaseline);

    // Unit — inline, to the right of value
    if (metric.unit.length > 0) {
        ctx.fillStyle = metric.value === 'N/A' ? 'rgba(255,59,48,0.72)' : accentColor;
        ctx.font = `600 ${unitSize}px ${fontFamily}`;
        ctx.lineWidth = Math.max(0.8, Math.min(1.8, unitSize * 0.1));
        if (typeof ctx.strokeText === 'function') {
            ctx.strokeText(metric.unit, groupLeft + valWidth + gap,
                valueBaseline - Math.max(0, Math.round((valueSize - unitSize) * 0.16)));
        }
        ctx.fillText(metric.unit, groupLeft + valWidth + gap,
            valueBaseline - Math.max(0, Math.round((valueSize - unitSize) * 0.16)));
    }
}
