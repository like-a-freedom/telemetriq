import type { ExtendedOverlayConfig, TelemetryFrame } from '../../core/types';
import type { OverlayRenderContext } from '../overlayRenderer';
import type { OverlayContext2D } from '../overlayUtils';
import { formatPace } from '../telemetryCore';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';
import { GHOST_RUN_COLORS } from '../templates/ghostRun';
import { getGhostRoutePosition } from '../ghostRunRoute';
import type { GhostRunRoute } from '../ghostRunRoute';

interface GhostMetric {
    label: string;
    value: string;
    unit: string;
    reserve: string;
    heart?: boolean;
    pace?: boolean;
}

interface GhostPlane {
    project: (x: number, y: number) => { x: number; y: number };
    place: (ctx: OverlayContext2D, x: number, y: number) => void;
}

interface GhostInk {
    advance: number;
    left: number;
    right: number;
    width: number;
    ascent: number;
    descent: number;
    height: number;
}

/** One local spacing scale for the entire HUD, independent of metric size. */
function panelSpacing(short: number) {
    const unit = Math.max(1, short * 0.005);
    return { frameInset: unit * 12, padding: unit * 4, innerGap: unit * 2, labelGap: unit * 3, gradeGap: unit * 3,
        gap: unit * 3, radius: unit * 2 };
}

function measureInk(ctx: OverlayContext2D, value: string, size: number, weight: number): GhostInk {
    ctx.font = `${weight} ${size}px ${TRAIL_RUN_FONT_FAMILY}`;
    const box = ctx.measureText(value);
    const left = box.actualBoundingBoxLeft ?? 0;
    const right = box.actualBoundingBoxRight ?? box.width;
    const ascent = Math.max(0, box.actualBoundingBoxAscent ?? size * 0.8);
    const descent = Math.max(0, box.actualBoundingBoxDescent ?? 0);
    return { advance: box.width, left, right, width: left + right, ascent, descent, height: ascent + descent };
}

function measureRailMetric(ctx: OverlayContext2D, metric: GhostMetric, size: number,
    labelSize: number, unitSize: number, spacing: ReturnType<typeof panelSpacing>) {
    const value = measureInk(ctx, metric.value, size, 600);
    const reserve = measureInk(ctx, metric.reserve, size, 600);
    const unit = measureInk(ctx, metric.unit, unitSize, 500);
    const label = labelSize ? measureInk(ctx, metric.label, labelSize, 500) : undefined;
    const suffixWidth = metric.heart
        ? size * UNIT_GAP_RATIO + Math.max(size * HEART_SIZE_RATIO * HEART_PAINT_WIDTH, unit.width)
        : metric.unit ? unit.width + size * (metric.pace ? 0.52 : UNIT_GAP_RATIO) : 0;
    const ascent = Math.max(value.ascent, reserve.ascent);
    const descent = Math.max(value.descent, metric.pace
        ? Math.max(size * 0.25 + Math.max(1.4, size * 0.04) / 2, unitSize * 0.4 + unit.descent)
        : metric.unit ? unitSize * 0.1 + unit.descent : 0);
    const labelBand = label ? label.height + spacing.labelGap : 0;
    return { size, value, unit, label, ascent, descent,
        width: Math.max(Math.max(value.width, reserve.width) + suffixWidth, label?.width ?? 0),
        height: spacing.padding * 2 + labelBand + ascent + descent,
        baseline: spacing.padding + labelBand + ascent };
}

/** A rigid HUD plane keeps glyph proportions and every baseline consistent. */
function createPlane(originX: number, originY: number, angle: number): GhostPlane {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const project = (x: number, y: number) => ({
        x: originX + (x - originX) * cosine - (y - originY) * sine,
        y: originY + (x - originX) * sine + (y - originY) * cosine,
    });
    return { project, place(ctx, x, y) {
        const anchor = project(x, y);
        ctx.transform(cosine, sine, -sine, cosine, anchor.x, anchor.y);
    } };
}

function luminance(color: string): number | undefined {
    const hex = color.replace('#', '');
    if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return undefined;
    const digits = hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex;
    const channels = [0, 2, 4].map((offset) => {
        const value = parseInt(digits.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contourFor(ink: string, config: ExtendedOverlayConfig): string {
    const requested = config.textShadowColor || GHOST_RUN_COLORS.contour;
    const inkLight = luminance(ink);
    const contourLight = luminance(requested);
    if (inkLight === undefined || contourLight === undefined) return requested;
    const ratio = (Math.max(inkLight, contourLight) + 0.05) / (Math.min(inkLight, contourLight) + 0.05);
    if (ratio >= 3) return requested;
    return inkLight < 0.25 ? GHOST_RUN_COLORS.text : GHOST_RUN_COLORS.contour;
}

function finiteValue(value: number | undefined, digits = 0): string {
    return value === undefined || !Number.isFinite(value) ? 'N/A' : value.toFixed(digits);
}

/**
 * Absolute track time at this frame, rendered as a zero-padded 24-hour clock in
 * the renderer's local time zone. The timestamp alone does not encode the
 * athlete's original time zone.
 * Returns undefined when the track carries no usable absolute time, so the HUD
 * draws no clock instead of inventing one.
 */
export function formatGhostRunClock(
    frame: TelemetryFrame,
    route?: Pick<GhostRunRoute, 'startTimestampMs'>,
): string | undefined {
    const timestampMs = resolveTrackTimestampMs(frame, route);
    if (timestampMs === undefined) return undefined;
    const recordedTime = new Date(timestampMs);
    if (!Number.isFinite(recordedTime.getTime())) return undefined;
    return `${String(recordedTime.getHours()).padStart(2, '0')}:${String(recordedTime.getMinutes()).padStart(2, '0')}`;
}

/** Prefer the frame's own recording time; fall back to the route start plus the offset. */
function resolveTrackTimestampMs(
    frame: TelemetryFrame,
    route?: Pick<GhostRunRoute, 'startTimestampMs'>,
): number | undefined {
    const fromRoute = route?.startTimestampMs !== undefined && Number.isFinite(frame.timeOffset)
        ? route.startTimestampMs + frame.timeOffset * 1000
        : undefined;
    // Non-positive values are epoch placeholders, not a real recording time.
    return [frame.timestampMs, fromRoute]
        .find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
}

/**
 * Heart badge geometry. The heart is drawn as two mirrored cubics whose control
 * points overshoot the painted shape; the painted edges around the anchor are
 * roughly −0.015…1.015 sizes wide and 0.04…1 size tall (curve bounds, not the
 * control-point bounds), verified against rendered pixels.
 */
const HEART_SIZE_RATIO = 0.3;
const HEART_PAINT_LEFT = -0.015;
const HEART_PAINT_WIDTH = 1.03;
/** The rail's shared value→unit gap ratio, used by plain units and the badge alike. */
const UNIT_GAP_RATIO = 0.16;
/** Tight step between the heart and the unit text stacked below it. */
const HEART_UNIT_GAP_RATIO = 0.05;
const HEART_UNIT_GAP_MIN = 2;

function buildRail(frame: TelemetryFrame, config: ExtendedOverlayConfig): GhostMetric[] {
    const metrics: GhostMetric[] = [];
    if (config.showPace) metrics.push({ label: 'PACE',
        value: Number.isFinite(frame.paceSecondsPerKm) && frame.paceSecondsPerKm! >= 0
            ? formatPace(frame.paceSecondsPerKm)! : 'N/A',
        unit: 'km', reserve: '59:59', pace: true });
    if (config.showDistance) metrics.push({ label: 'DISTANCE', value: finiteValue(frame.distanceKm, 1), unit: 'km', reserve: '999.9' });
    // The reference calls this elapsed, rather than the application's moving time.
    if (config.showTime) {
        const seconds = frame.totalElapsedSeconds ?? frame.timeOffset;
        const safeSeconds = Math.max(0, Math.floor(seconds));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor(safeSeconds % 3600 / 60);
        const value = !Number.isFinite(seconds) ? 'N/A' : hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
            : `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
        metrics.push({ label: 'ELAPSED', value, unit: '', reserve: '59:59' });
    }
    if (config.showHr) metrics.push({ label: 'HEART RATE', value: finiteValue(frame.hr), unit: 'bpm', reserve: '199', heart: true });
    return metrics;
}

/** Edge telemetry on compact translucent panels, leaving the footage's center open. */
export function renderGhostRunLayout(
    ctx: OverlayContext2D,
    frame: TelemetryFrame,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    context: OverlayRenderContext = {},
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const short = Math.min(w, h);
    const portrait = w < h;
    const compact = !portrait && h < 240;
    const spacing = panelSpacing(short);
    const frameInset = spacing.frameInset;
    const x = frameInset + spacing.padding;
    const top = h * (portrait ? 0.11 : 0.12);
    const panelPadding = spacing.padding;
    const panelGap = spacing.gap;
    const accent = config.accentColor || GHOST_RUN_COLORS.accent;
    const text = config.textColor || GHOST_RUN_COLORS.text;
    const metrics = buildRail(frame, config);
    const railWidth = Math.min(compact ? Math.min(w * 0.56, short * 1.5) : w * (portrait ? 0.46 : 0.25), w - frameInset * 2);
    const columns = compact ? Math.min(2, Math.max(1, metrics.length)) : 1;
    const rows = Math.ceil(metrics.length / columns);
    const cellWidth = railWidth / columns;
    const plane = createPlane(x, top, 0);
    const labelsVisible = config.labelStyle !== 'hidden';
    const desired = Math.max(compact ? 14 : 26, short * (portrait ? 0.088 : 0.062))
        * Math.max(0.25, config.fontSizePercent / 5.8) * Math.max(0.5, config.valueSizeMultiplier);
    let valueSize = compact ? Math.max(14, desired) : desired;
    let labelSize = 0;
    let unitSize = 0;
    let measured: ReturnType<typeof measureRailMetric>[] = [];
    let rowHeights: number[] = [];

    const measureRail = () => {
        measured = metrics.map((metric) => measureRailMetric(ctx, metric,
            valueSize * (config.showPace && !metric.pace && !compact ? 0.88 : 1), labelSize, unitSize, spacing));
        rowHeights = Array.from({ length: rows }, (_, row) =>
            Math.max(...measured.slice(row * columns, (row + 1) * columns).map((metric) => metric.height)));
    };

    // Fit the whole rail as one system; never shrink one metric independently.
    for (let attempt = 0; attempt < 160; attempt++) {
        labelSize = labelsVisible ? Math.max(portrait ? 13 : compact ? 10 : 8, valueSize * Math.max(0.25, Math.min(0.65, config.labelSizeMultiplier))) : 0;
        unitSize = Math.max(portrait ? 13 : compact ? 10 : 8, valueSize * 0.4);
        measureRail();
        const fitsWidth = measured.every((metric) => metric.width + panelPadding * 2 + panelGap < cellWidth);
        const railHeight = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, rows - 1) * panelGap;
        if (fitsWidth && railHeight <= h * 0.57) break;
        valueSize *= 0.97;
    }

    const panelWidth = Math.min(cellWidth - (columns > 1 ? panelGap : 0),
        Math.max(0, ...measured.map((metric) => metric.width)) + panelPadding * 2);
    const rowTops: number[] = [];
    let railBottom = top;
    rowHeights.forEach((height) => { rowTops.push(railBottom); railBottom += height + panelGap; });
    if (rows) railBottom -= panelGap;
    metrics.forEach((metric, index) => {
        const row = Math.floor(index / columns);
        const rowTop = rowTops[row]!;
        const rowX = x + index % columns * (panelWidth + panelGap);
        const box = measured[index]!;
        const metricSize = box.size;
        const baseline = rowTop + box.baseline;
        ctx.save();
        plane.place(ctx, rowX, baseline);
        drawPanel(ctx, -panelPadding, rowTop - baseline, panelWidth, rowHeights[row]!,
            short, text, accent, Boolean(metric.pace));
        // Keep each value, separator and unit on one tangent, even for long values.
        if (box.label) drawText(ctx, metric.label, box.label.left,
            rowTop + panelPadding + box.label.ascent - baseline, labelSize, 500, text, config);
        drawText(ctx, metric.value, box.value.left, 0, metricSize, 600, text, config);
        let right = box.value.width;
        if (metric.heart) {
            // Heart and bpm form one badge column beside the value: shared left
            // edge on the rail's unit gap, the heart stacked above the unit, and
            // the unit lowered onto the value baseline like every other unit.
            ctx.font = `500 ${unitSize}px ${TRAIL_RUN_FONT_FAMILY}`;
            const unitAscent = ctx.measureText(metric.unit).actualBoundingBoxAscent || unitSize * 0.8;
            const columnX = right + metricSize * UNIT_GAP_RATIO;
            const heartSize = metricSize * HEART_SIZE_RATIO;
            const innerGap = Math.max(HEART_UNIT_GAP_MIN, metricSize * HEART_UNIT_GAP_RATIO);
            const unitBaseline = unitSize * 0.1;
            drawHeart(ctx, columnX - HEART_PAINT_LEFT * heartSize,
                unitBaseline - unitAscent - innerGap - heartSize, heartSize, config);
            drawText(ctx, metric.unit, columnX + box.unit.left, unitBaseline, unitSize, 500, text, config);
        } else if (metric.pace) {
            ctx.beginPath();
            ctx.moveTo(right + metricSize * 0.16, metricSize * 0.25);
            ctx.lineTo(right + metricSize * 0.43, -metricSize * 0.6);
            strokeLine(ctx, text, Math.max(1.4, metricSize * 0.04), config);
            right += metricSize * 0.52;
            drawText(ctx, metric.unit, right + box.unit.left, unitSize * 0.4, unitSize, 500, text, config);
        } else if (metric.unit) {
            right += metricSize * UNIT_GAP_RATIO;
            drawText(ctx, metric.unit, right + box.unit.left, unitSize * 0.1, unitSize, 500, text, config);
        }
        ctx.restore();
    });

    const route = context.ghostRoute;
    if (config.showDistance && route && route.points.length > 1) {
        const mapTop = Math.min(h * 0.71, railBottom + panelGap + panelPadding);
        const mapHeight = Math.min(short * (portrait ? 0.23 : 0.15), h * 0.84 - mapTop);
        if (mapHeight > 8) {
            const mapWidth = Math.max(8, Math.min(panelWidth - panelPadding * 2, railWidth - panelPadding * 2));
            drawPanel(ctx, x - panelPadding, mapTop - panelPadding, mapWidth + panelPadding * 2,
                mapHeight + panelPadding * 2, short, text, accent);
            const markerInset = Math.max(2.5, short * 0.007) + Math.max(1, short * 0.001);
            drawRoute(ctx, route, frame.timeOffset, x + markerInset, mapTop + markerInset,
                Math.max(1, mapWidth - markerInset * 2), Math.max(1, mapHeight - markerInset * 2),
                accent, text, short, config, plane);
        }
    }

    drawRightTelemetry(ctx, frame, w, h, frameInset, valueSize, labelsVisible, text, accent, config);
    if (route && (config.showDistance || config.showElevation)) {
        drawProgress(ctx, route, frame, w, h, frameInset, text, accent, config);
    }
    const clock = config.showTime ? formatGhostRunClock(frame, route) : undefined;
    if (clock) {
        const clockSize = Math.max(portrait ? 12 : compact ? 10 : 8, short * (portrait ? 0.033 : 0.021));
        const clockInk = measureInk(ctx, clock, clockSize, 500);
        const clockRight = w - frameInset - panelPadding;
        const clockY = frameInset + panelPadding + clockInk.ascent;
        drawPanel(ctx, clockRight - clockInk.width - panelPadding, frameInset,
            clockInk.width + panelPadding * 2, clockInk.height + panelPadding * 2, short, text, accent);
        ctx.textAlign = 'right';
        drawText(ctx, clock, clockRight + clockInk.advance - clockInk.right, clockY, clockSize, 500, text, config);
    }
    ctx.restore();
}

function drawText(ctx: OverlayContext2D, value: string, x: number, y: number, size: number, weight: number,
    color: string, config: ExtendedOverlayConfig, plane?: GhostPlane): void {
    ctx.font = `${weight} ${size}px ${TRAIL_RUN_FONT_FAMILY}`;
    ctx.save();
    if (plane) { plane.place(ctx, x, y); x = 0; y = 0; }
    if (config.textShadow) {
        ctx.strokeStyle = contourFor(color, config);
        // Protect glyphs locally against bright and textured footage, without a panel.
        ctx.lineWidth = Math.max(0.8, size * 0.025);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeText(value, x, y);
        ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
    ctx.restore();
}

function strokeLine(ctx: OverlayContext2D, color: string, width: number, config: ExtendedOverlayConfig, opacity = 1): void {
    ctx.save();
    if (config.textShadow) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = contourFor(color, config);
        ctx.lineWidth = width + Math.max(1, width * 0.45);
        ctx.stroke();
    }
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
}

function fillRoundedBox(ctx: OverlayContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
}

function drawPanel(ctx: OverlayContext2D, x: number, y: number, width: number, height: number,
    short: number, text: string, accent: string, emphasis = false, plane?: GhostPlane): void {
    if (width <= 0 || height <= 0) return;
    ctx.save();
    if (plane) { plane.place(ctx, x, y); x = 0; y = 0; }
    const lightInk = (luminance(text) ?? 1) >= 0.25;
    ctx.fillStyle = lightInk ? GHOST_RUN_COLORS.panel : GHOST_RUN_COLORS.text;
    ctx.globalAlpha = lightInk ? emphasis ? 0.76 : 0.64 : 0.86;
    const spacing = panelSpacing(short);
    const radius = Math.min(spacing.radius, width / 2, height / 2);
    fillRoundedBox(ctx, x, y, width, height, radius);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = emphasis ? 0.32 : 0.16;
    ctx.lineWidth = Math.max(0.7, short * 0.001);
    ctx.stroke();
    if (emphasis) {
        // A single fine corner cue distinguishes the primary measurement.
        ctx.beginPath();
        ctx.moveTo(x + width - radius - Math.min(spacing.padding, width * 0.2), y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + radius + Math.min(spacing.innerGap, height * 0.2));
        ctx.globalAlpha = 0.85;
        ctx.stroke();
    }
    ctx.restore();
}

function drawHeart(ctx: OverlayContext2D, x: number, y: number, size: number, config: ExtendedOverlayConfig): void {
    ctx.save();
    ctx.translate(x, y);
    x = 0; y = 0;
    ctx.fillStyle = GHOST_RUN_COLORS.heart;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, y + size);
    ctx.bezierCurveTo(x - size * 0.35, y + size * 0.4, x, y - size * 0.25, x + size * 0.5, y + size * 0.17);
    ctx.bezierCurveTo(x + size, y - size * 0.25, x + size * 1.35, y + size * 0.4, x + size * 0.5, y + size);
    if (config.textShadow) {
        ctx.strokeStyle = contourFor(GHOST_RUN_COLORS.heart, config);
        ctx.lineWidth = Math.max(1.2, size * 0.07);
        ctx.stroke();
    }
    ctx.fill();
    ctx.restore();
}

function drawRoute(ctx: OverlayContext2D, route: GhostRunRoute, time: number, x: number, y: number,
    width: number, height: number, accent: string, text: string, short: number, config: ExtendedOverlayConfig, plane: GhostPlane): void {
    const { minX, minY, width: extentX, height: extentY } = route.bounds;
    if (extentX === 0 && extentY === 0) return;
    const scale = Math.min(width / (extentX || 1e-9), height / (extentY || 1e-9));
    const left = x + (width - extentX * scale) / 2;
    const top = y + (height - extentY * scale) / 2;
    const map = (point: { x: number; y: number }) => plane.project(left + (point.x - minX) * scale, top + (point.y - minY) * scale);
    ctx.beginPath();
    route.trace.forEach((point, index) => {
        const position = map(point);
        if (index === 0) ctx.moveTo(position.x, position.y);
        else ctx.lineTo(position.x, position.y);
    });
    strokeLine(ctx, text, Math.max(1.2, short * 0.0028), config);
    const current = getGhostRoutePosition(route, time);
    for (const [point, color] of [[route.points[0], text], [current, accent]] as const) {
        if (!point) continue;
        const position = map(point);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(position.x, position.y, Math.max(2.5, short * 0.007), 0, Math.PI * 2);
        if (config.textShadow) {
            ctx.strokeStyle = contourFor(color, config);
            ctx.lineWidth = Math.max(2, short * 0.002);
            ctx.stroke();
        }
        ctx.fill();
    }
}

function drawRightTelemetry(ctx: OverlayContext2D, frame: TelemetryFrame, w: number, h: number, frameInset: number,
    railSize: number, labelsVisible: boolean, text: string, accent: string, config: ExtendedOverlayConfig): void {
    const short = Math.min(w, h);
    const portrait = w < h;
    const compact = !portrait && h < 240;
    const spacing = panelSpacing(short);
    const right = w - frameInset - spacing.padding;
    const maxWidth = w * (portrait ? 0.42 : compact ? 0.2 : 0.12);
    const top = portrait ? h * 0.86 - Math.max(100, short * 0.27) - short * 0.045 : h * (compact ? 0.32 : 0.585);
    const value = config.showElevation ? finiteValue(frame.elevationM) : config.showGrade ? finiteValue(frame.gradePercent, 1) : '';
    if (!value) return;
    const label = config.showElevation ? 'ELEVATION' : 'GRADE';
    const unit = config.showElevation ? 'm' : '%';
    let size = Math.max(portrait ? 20 : compact ? 14 : 12,
        Math.min(railSize * 0.9, short * (portrait ? 0.07 : 0.048)));
    const fullWidth = measureInk(ctx, `${value} ${unit}`, size, 600).width;
    size *= Math.min(1, (maxWidth - spacing.padding * 2) / (fullWidth + 2));
    const labelSize = Math.max(portrait ? 13 : 10, size * 0.45);
    const unitSize = Math.max(portrait ? 12 : 10, size * 0.45);
    const valueInk = measureInk(ctx, value, size, 600);
    const reserveInk = measureInk(ctx, config.showElevation ? '9999' : '−99.9', size, 600);
    const unitInk = measureInk(ctx, unit, unitSize, 500);
    const labelInk = labelsVisible ? measureInk(ctx, label, labelSize, 500) : undefined;
    const grade = config.showGrade && config.showElevation ? `${finiteValue(frame.gradePercent, 1)}% grade` : '';
    let gradeSize = Math.max(portrait ? 13 : 10, size * 0.45);
    gradeSize *= Math.min(1, (maxWidth - spacing.padding * 2)
        / (measureInk(ctx, grade || '−99.9% grade', gradeSize, 500).width + gradeSize));
    const gradeInk = grade ? measureInk(ctx, grade, gradeSize, 500) : undefined;
    const dotRadius = gradeSize * 0.16;
    const gradeReserve = grade ? measureInk(ctx, '−99.9% grade', gradeSize, 500).width : 0;
    const gradeWidth = gradeInk ? Math.max(gradeInk.width, gradeReserve) + dotRadius * 2 + spacing.innerGap : 0;
    const unitGap = size * UNIT_GAP_RATIO;
    const contentWidth = Math.max(labelInk?.width ?? 0,
        Math.max(valueInk.width, reserveInk.width) + unitInk.width + unitGap, gradeWidth);
    const labelBand = labelInk ? labelInk.height + spacing.labelGap : 0;
    const valueAscent = Math.max(valueInk.ascent, reserveInk.ascent);
    const valueDescent = Math.max(valueInk.descent, unitSize * 0.1 + unitInk.descent);
    const valueBaseline = labelBand + valueAscent;
    const contentHeight = labelBand + valueAscent + valueDescent
        + (gradeInk ? spacing.gradeGap + gradeInk.height : 0);
    const inkTop = top + spacing.padding;
    ctx.save();
    drawPanel(ctx, right - contentWidth - spacing.padding, top,
        contentWidth + spacing.padding * 2, contentHeight + spacing.padding * 2, short, text, accent);
    // Every row ends on the same painted edge, including glyph side bearings.
    ctx.textAlign = 'left';
    if (labelInk) drawText(ctx, label, right - labelInk.right,
        inkTop + labelInk.ascent, labelSize, 500, text, config);
    drawText(ctx, value, right - unitInk.width - unitGap - valueInk.right,
        inkTop + valueBaseline, size, 600, text, config);
    drawText(ctx, unit, right - unitInk.right,
        inkTop + valueBaseline + unitSize * 0.1, unitSize, 500, text, config);
    if (gradeInk) {
        const gradeTop = inkTop + contentHeight - gradeInk.height;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(right - gradeInk.width - spacing.innerGap - dotRadius,
            gradeTop + gradeInk.height / 2, dotRadius, 0, Math.PI * 2);
        if (config.textShadow) {
            ctx.strokeStyle = contourFor(accent, config);
            ctx.lineWidth = Math.max(1.2, gradeSize * 0.08);
            ctx.stroke();
        }
        ctx.fill();
        drawText(ctx, grade, right - gradeInk.right,
            gradeTop + gradeInk.ascent, gradeSize, 500, text, config);
    }
    ctx.restore();
}

function drawProgress(ctx: OverlayContext2D, route: GhostRunRoute, frame: TelemetryFrame, w: number, h: number,
    frameInset: number, text: string, accent: string, config: ExtendedOverlayConfig): void {
    const short = Math.min(w, h);
    const portrait = w < h;
    const compact = !portrait && h < 240;
    const spacing = panelSpacing(short);
    const right = w - frameInset - spacing.padding;
    const width = portrait ? w - (frameInset + spacing.padding) * 2
        : compact ? Math.min(w * 0.78, short * 2.9) : Math.min(w * 0.29, short * 0.52);
    const x = right - width;
    const bottom = h * (portrait ? 0.86 : 0.825);
    const gain = route.ascentM !== undefined ? `+${Math.round(route.ascentM)} m` : '';
    const loss = route.descentM !== undefined ? `−${Math.round(route.descentM)} m` : '';
    let detailSize = Math.max(portrait ? 13 : compact ? 10 : 11, short * (portrait ? 0.033 : 0.018));
    let gainInk = measureInk(ctx, gain, detailSize, 500);
    let lossInk = measureInk(ctx, loss, detailSize, 500);
    const measuredDetailWidth = Math.max(gainInk.width, lossInk.width);
    const detailWidth = config.showElevation && gain && loss
        ? Math.min(width * 0.4, Math.max(width * 0.2, measuredDetailWidth)) : 0;
    if (detailWidth) {
        detailSize *= Math.min(1, detailWidth / measuredDetailWidth);
        gainInk = measureInk(ctx, gain, detailSize, 500);
        lossInk = measureInk(ctx, loss, detailSize, 500);
    }
    const trackWidth = width - detailWidth - (detailWidth ? spacing.innerGap * 2 : 0);
    const size = Math.max(portrait ? 18 : 12, short * (portrait ? 0.05 : 0.027));
    const hasProfile = config.showElevation && route.profile.length > 1 && route.totalDistanceKm > 0;
    const labelWidth = hasProfile ? trackWidth * 0.54 : trackWidth;
    const current = finiteValue(frame.distanceKm, 1);
    const remaining = `/ ${finiteValue(route.totalDistanceKm, 1)} km`;
    const captionGap = spacing.innerGap / 2;
    let currentInk = measureInk(ctx, current, size, 500);
    let remainingInk = measureInk(ctx, remaining, size * 0.8, 500);
    const captionScale = Math.min(1, (labelWidth - captionGap) / (currentInk.width + remainingInk.width));
    currentInk = measureInk(ctx, current, size * captionScale, 500);
    remainingInk = measureInk(ctx, remaining, size * 0.8 * captionScale, 500);
    const captionAscent = Math.max(currentInk.ascent, remainingInk.ascent);
    const captionDescent = Math.max(currentInk.descent, remainingInk.descent);
    const profileHeight = Math.max(compact ? 9 : 0, short * (portrait ? 0.05 : 0.032));
    const profileStroke = Math.max(1.6, short * 0.0024);
    const barHeight = Math.max(2.5, short * 0.006);
    const rowHeight = Math.max(config.showDistance ? captionAscent + captionDescent : 0,
        hasProfile ? profileHeight + profileStroke : 0);
    const contentHeight = Math.max(rowHeight + (config.showDistance ? spacing.innerGap + barHeight : 0),
        detailWidth ? gainInk.height + spacing.innerGap + lossInk.height : 0);
    if (!contentHeight) return;
    const inkTop = bottom - contentHeight;
    drawPanel(ctx, x - spacing.padding, inkTop - spacing.padding,
        width + spacing.padding * 2, contentHeight + spacing.padding * 2, short, text, accent);
    if (config.showDistance) {
        const baseline = inkTop + (rowHeight - captionAscent - captionDescent) / 2 + captionAscent;
        drawText(ctx, current, x + currentInk.left, baseline, size * captionScale, 500, text, config);
        // Use the width measured at the rendered current font, after fitting.
        drawText(ctx, remaining, x + currentInk.width + captionGap + remainingInk.left,
            baseline, size * 0.8 * captionScale, 500, text, config);
        ctx.save();
        ctx.fillStyle = text;
        ctx.globalAlpha = 0.22;
        fillRoundedBox(ctx, x, bottom - barHeight, trackWidth, barHeight, barHeight / 2);
        const progress = route.totalDistanceKm > 0 && Number.isFinite(frame.distanceKm)
            ? Math.max(0, Math.min(1, frame.distanceKm / route.totalDistanceKm)) : 0;
        if (progress > 0) {
            ctx.fillStyle = accent;
            ctx.globalAlpha = 1;
            fillRoundedBox(ctx, x, bottom - barHeight, trackWidth * progress, barHeight, barHeight / 2);
        }
        ctx.restore();
    }
    if (hasProfile) {
        const elevations = route.profile.map((point) => point.elevationM);
        const low = Math.min(...elevations);
        const range = Math.max(1, Math.max(...elevations) - low);
        const profileX = config.showDistance ? x + trackWidth * 0.58 : x;
        const profileWidth = config.showDistance ? trackWidth * 0.42 : trackWidth;
        const profileTop = inkTop + (rowHeight - profileHeight) / 2;
        ctx.beginPath();
        route.profile.forEach((point, index) => {
            const px = profileX + profileWidth * Math.max(0, Math.min(1, point.distanceKm / route.totalDistanceKm));
            const py = profileTop + profileHeight * (1 - (point.elevationM - low) / range);
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        strokeLine(ctx, accent, profileStroke, config);
    }
    if (detailWidth) {
        drawText(ctx, gain, right - gainInk.right, inkTop + gainInk.ascent,
            detailSize, 500, text, config);
        drawText(ctx, loss, right - lossInk.right, bottom - lossInk.descent,
            detailSize, 500, text, config);
    }
}
