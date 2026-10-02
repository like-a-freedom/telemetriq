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

/** A shallow HUD plane: shared perspective for ink, rules and route markers. */
function createPlane(originX: number, horizonY: number, width: number, depth: number, slope: number): GhostPlane {
    const project = (x: number, y: number) => {
        const dx = x - originX;
        const denominator = 1 + depth * dx / width;
        return { x: originX + dx / denominator, y: horizonY + (y - horizonY + slope * dx) / denominator };
    };
    return { project, place(ctx, x, y) {
        const denominator = 1 + depth * (x - originX) / width;
        const anchor = project(x, y);
        // Text uses the plane's local tangent, so its baseline follows nearby paths.
        ctx.transform(1 / denominator ** 2, (slope - depth * (y - horizonY) / width) / denominator ** 2,
            0, 1 / denominator, anchor.x, anchor.y);
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
 * the renderer's local time zone — the wall clock the athlete actually saw.
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

function buildRail(frame: TelemetryFrame, config: ExtendedOverlayConfig): GhostMetric[] {
    const metrics: GhostMetric[] = [];
    if (config.showPace) metrics.push({ label: 'PACE', value: formatPace(frame.paceSecondsPerKm ?? NaN) || 'N/A', unit: 'km', reserve: '59:59', pace: true });
    if (config.showDistance) metrics.push({ label: 'DISTANCE', value: finiteValue(frame.distanceKm, 1), unit: 'km', reserve: '999.9' });
    // The reference calls this elapsed, rather than the application's moving time.
    if (config.showTime) {
        const seconds = frame.totalElapsedSeconds ?? frame.timeOffset;
        const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor(safeSeconds % 3600 / 60);
        const value = hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
            : `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
        metrics.push({ label: 'ELAPSED', value, unit: '', reserve: '59:59' });
    }
    if (config.showHr) metrics.push({ label: 'HEART RATE', value: finiteValue(frame.hr), unit: 'bpm', reserve: '199', heart: true });
    return metrics;
}

/** Open edge HUD inspired by the user-supplied Ghost Run reference. */
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
    const safe = Math.max(4, short * (portrait ? 0.04 : 0.025));
    const x = portrait ? safe + short * 0.04 : Math.max(safe + 6, w * 0.047);
    const top = h * (portrait ? 0.11 : 0.12);
    const lineX = Math.max(safe, w * 0.025);
    const accent = config.accentColor || GHOST_RUN_COLORS.accent;
    const text = config.textColor || GHOST_RUN_COLORS.text;
    const metrics = buildRail(frame, config);
    const railWidth = Math.min(compact ? Math.min(w * 0.56, short * 1.5) : w * (portrait ? 0.46 : 0.25), w - x - safe);
    const columns = compact ? Math.min(2, Math.max(1, metrics.length)) : 1;
    const rows = Math.ceil(metrics.length / columns);
    const cellWidth = railWidth / columns;
    const plane = createPlane(lineX, h * (portrait ? 0.32 : 0.43), compact ? railWidth : Math.min(short * 0.26, railWidth), 0.045, 0.012);
    const labelsVisible = config.labelStyle !== 'hidden';
    const desired = Math.max(compact ? 14 : 26, short * (portrait ? 0.088 : 0.062))
        * Math.max(0.25, config.fontSizePercent / 5.8) * Math.max(0.5, config.valueSizeMultiplier);
    let valueSize = compact ? Math.max(14, desired) : desired;
    let labelSize = 0;
    let unitSize = 0;
    let rowStep = 0;

    // Fit the whole rail as one system; never shrink one metric independently.
    for (let attempt = 0; attempt < 160; attempt++) {
        labelSize = labelsVisible ? Math.max(portrait ? 12 : compact ? 10 : 7, valueSize * Math.max(0.25, Math.min(0.65, config.labelSizeMultiplier))) : 0;
        unitSize = Math.max(portrait ? 12 : compact ? 10 : 7, valueSize * 0.4);
        const contentHeight = labelSize * 1.2 + valueSize * 1.05 + Math.max(2, valueSize * 0.12);
        rowStep = Math.max(contentHeight + valueSize * (portrait ? 0.5 : 0.35), Math.min(h * (compact ? 0.24 : portrait ? 0.105 : 0.137), short * (compact || portrait ? 0.22 : 0.15)));
        const fitsWidth = metrics.every((metric) => {
            ctx.font = `600 ${valueSize}px ${TRAIL_RUN_FONT_FAMILY}`;
            const valueWidth = Math.max(ctx.measureText(metric.value).width, ctx.measureText(metric.reserve).width);
            ctx.font = `500 ${unitSize}px ${TRAIL_RUN_FONT_FAMILY}`;
            const unitWidth = metric.unit ? ctx.measureText(metric.unit).width + valueSize * (metric.pace ? 0.52 : 0.16) : 0;
            const heartWidth = metric.heart ? valueSize * 0.62 : 0;
            ctx.font = `500 ${labelSize}px ${TRAIL_RUN_FONT_FAMILY}`;
            return valueWidth + unitWidth + heartWidth < cellWidth - (compact ? short * 0.06 : 2)
                && (!labelsVisible || ctx.measureText(metric.label).width < cellWidth - 2);
        });
        if (fitsWidth && rowStep * rows <= h * 0.57) break;
        valueSize *= 0.97;
    }

    let inkRight = x;
    metrics.forEach((metric, index) => {
        const rowTop = top + Math.floor(index / columns) * rowStep;
        const rowX = x + index % columns * cellWidth;
        const baseline = rowTop + labelSize * 1.2 + Math.max(2, valueSize * 0.12) + valueSize * 0.75;
        ctx.save();
        plane.place(ctx, rowX, baseline);
        // Keep each value, separator and unit on one tangent, even for long values.
        if (labelsVisible) drawText(ctx, metric.label, 0, rowTop + labelSize * 0.8 - baseline, labelSize, 500, text, config);
        drawText(ctx, metric.value, 0, 0, valueSize, 600, text, config);
        ctx.font = `600 ${valueSize}px ${TRAIL_RUN_FONT_FAMILY}`;
        let right = ctx.measureText(metric.value).width;
        if (metric.heart) {
            const heartX = right + valueSize * 0.18;
            drawHeart(ctx, heartX, -valueSize * 0.61, valueSize * 0.5, config);
            drawText(ctx, metric.unit, heartX, unitSize * 0.17, unitSize * 0.85, 500, text, config);
            right = heartX + Math.max(valueSize * 0.46, ctx.measureText(metric.unit).width);
        } else if (metric.pace) {
            ctx.beginPath();
            ctx.moveTo(right + valueSize * 0.16, valueSize * 0.25);
            ctx.lineTo(right + valueSize * 0.43, -valueSize * 0.6);
            strokeLine(ctx, text, Math.max(0.8, valueSize * 0.025), config, 0.85);
            right += valueSize * 0.52;
            drawText(ctx, metric.unit, right, unitSize * 0.4, unitSize, 500, text, config);
            right += ctx.measureText(metric.unit).width;
        } else if (metric.unit) {
            right += valueSize * 0.16;
            drawText(ctx, metric.unit, right, unitSize * 0.1, unitSize, 500, text, config);
            right += ctx.measureText(metric.unit).width;
        }
        inkRight = Math.max(inkRight, rowX + right);
        ctx.restore();
    });

    const railBottom = metrics.length ? top + (rows - 1) * rowStep + labelSize * 1.2 + valueSize * 1.06 + 6 : top;
    if (metrics.length) {
        const corner = Math.max(3, short * 0.008);
        const bracketBottom = Math.min(h * 0.69, railBottom + short * 0.03);
        const endX = Math.min(x + railWidth, Math.max(inkRight + corner, x + short * 0.17));
        const move = (px: number, py: number) => { const p = plane.project(px, py); ctx.moveTo(p.x, p.y); };
        const line = (px: number, py: number) => { const p = plane.project(px, py); ctx.lineTo(p.x, p.y); };
        const curve = (cx: number, cy: number, px: number, py: number) => {
            const c = plane.project(cx, cy); const p = plane.project(px, py); ctx.quadraticCurveTo(c.x, c.y, p.x, p.y);
        };
        ctx.beginPath();
        move(lineX + corner, top - short * 0.035);
        curve(lineX, top - short * 0.035, lineX, top - short * 0.035 + corner);
        line(lineX, bracketBottom - corner);
        curve(lineX, bracketBottom, lineX + corner, bracketBottom);
        line(endX - corner, bracketBottom);
        curve(endX, bracketBottom, endX, bracketBottom + corner);
        strokeLine(ctx, accent, Math.max(0.8, short * 0.0015), config, 0.85);
    }

    const route = context.ghostRoute;
    if (config.showDistance && route && route.points.length > 1) {
        const mapTop = Math.min(h * 0.71, railBottom + short * 0.055);
        const mapHeight = Math.min(short * (portrait ? 0.23 : 0.15), h * 0.84 - mapTop);
        if (mapHeight > 8) drawRoute(ctx, route, frame.timeOffset, safe + short * 0.02, mapTop,
            Math.min(short * (portrait ? 0.28 : 0.2), railWidth), mapHeight, accent, text, short, config, plane);
    }

    drawRightTelemetry(ctx, frame, w, h, safe, valueSize, labelsVisible, text, accent, config);
    if (route && (config.showDistance || config.showElevation)) {
        drawProgress(ctx, route, frame, w, h, safe, text, accent, config);
    }
    const clock = config.showTime ? formatGhostRunClock(frame, route) : undefined;
    if (clock) {
        const clockSize = Math.max(portrait ? 12 : compact ? 10 : 8, short * (portrait ? 0.033 : 0.021));
        ctx.textAlign = 'right';
        drawText(ctx, clock, w - safe, safe + clockSize, clockSize, 500, text, config);
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
        ctx.lineWidth = Math.max(1.8, size * 0.05);
        ctx.strokeText(value, x, y);
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
        ctx.lineWidth = width + Math.max(2, width * 0.8);
        ctx.stroke();
    }
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
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

function drawRightTelemetry(ctx: OverlayContext2D, frame: TelemetryFrame, w: number, h: number, safe: number,
    railSize: number, labelsVisible: boolean, text: string, accent: string, config: ExtendedOverlayConfig): void {
    const short = Math.min(w, h);
    const portrait = w < h;
    const compact = !portrait && h < 240;
    const width = w * (portrait ? 0.42 : compact ? 0.2 : 0.12);
    const x = w - safe - width;
    const top = h * (portrait ? 0.64 : h < 240 ? 0.48 : 0.585);
    const plane = createPlane(x, top, width, 0.02, 0.05);
    const value = config.showElevation ? finiteValue(frame.elevationM) : config.showGrade ? finiteValue(frame.gradePercent, 1) : '';
    if (!value) return;
    const label = config.showElevation ? 'ELEVATION' : 'GRADE';
    const unit = config.showElevation ? 'm' : '%';
    let size = Math.max(portrait ? 20 : compact ? 14 : 12, Math.min(railSize * 0.9, short * (portrait ? 0.07 : 0.048)));
    ctx.font = `600 ${size}px ${TRAIL_RUN_FONT_FAMILY}`;
    const textWidth = ctx.measureText(`${value} ${unit}`).width;
    size *= Math.min(1, width / (textWidth + 2));
    const labelSize = Math.max(portrait ? 13 : compact ? 10 : 7, size * 0.45);
    const unitSize = Math.max(portrait ? 12 : compact ? 10 : 7, size * 0.45);
    if (portrait) {
        // Align the actual ink to the same outer edge as the clock and route totals.
        ctx.font = `500 ${unitSize}px ${TRAIL_RUN_FONT_FAMILY}`;
        const unitWidth = ctx.measureText(unit).width;
        ctx.font = `600 ${size}px ${TRAIL_RUN_FONT_FAMILY}`;
        const valueWidth = ctx.measureText(value).width;
        const baseline = (labelsVisible ? labelSize * 1.35 : 0) + size * 0.85;
        ctx.save();
        createPlane(w - safe, top, width, 0.02, 0.05).place(ctx, w - safe, top);
        ctx.textAlign = 'right';
        if (labelsVisible) drawText(ctx, label, 0, labelSize * 0.8, labelSize, 500, text, config);
        ctx.textAlign = 'left';
        drawText(ctx, value, -valueWidth - unitWidth - size * 0.15, baseline, size, 600, accent, config);
        drawText(ctx, unit, -unitWidth, baseline, unitSize, 500, text, config);
        if (config.showGrade && config.showElevation) {
            const grade = `${finiteValue(frame.gradePercent, 1)}% grade`;
            let gradeSize = Math.max(13, size * 0.45);
            ctx.font = `500 ${gradeSize}px ${TRAIL_RUN_FONT_FAMILY}`;
            gradeSize *= Math.min(1, width / (ctx.measureText(grade).width + gradeSize));
            ctx.font = `500 ${gradeSize}px ${TRAIL_RUN_FONT_FAMILY}`;
            const dotX = -ctx.measureText(grade).width - gradeSize * 0.5;
            const dotY = baseline + gradeSize * 1.55;
            ctx.beginPath();
            ctx.arc(dotX, dotY - gradeSize * 0.32, gradeSize * 0.16, 0, Math.PI * 2);
            if (config.textShadow) { ctx.strokeStyle = contourFor(accent, config); ctx.lineWidth = 1.2; ctx.stroke(); }
            ctx.fillStyle = accent; ctx.fill();
            ctx.textAlign = 'right';
            drawText(ctx, grade, 0, dotY, gradeSize, 500, text, config);
        }
        ctx.restore();
        return;
    }
    if (labelsVisible) drawText(ctx, label, x, top + labelSize * 0.8, labelSize, 500, text, config, plane);
    const baseline = top + (labelsVisible ? labelSize * 1.35 : 0) + size * 0.85;
    drawText(ctx, value, x, baseline, size, 600, accent, config, plane);
    const valueWidth = ctx.measureText(value).width;
    drawText(ctx, unit, x + valueWidth + size * 0.15, baseline, unitSize, 500, text, config, plane);
    if (config.showGrade && config.showElevation) {
        const grade = `${finiteValue(frame.gradePercent, 1)}% grade`;
        let gradeSize = Math.max(compact ? 10 : 7, size * 0.45);
        ctx.font = `500 ${gradeSize}px ${TRAIL_RUN_FONT_FAMILY}`;
        gradeSize *= Math.min(1, width / (ctx.measureText(grade).width + 2));
        const dotY = baseline + gradeSize * 1.55;
        const dot = plane.project(x + gradeSize * 0.2, dotY - gradeSize * 0.32);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, gradeSize * 0.16, 0, Math.PI * 2);
        if (config.textShadow) {
            ctx.strokeStyle = contourFor(accent, config);
            ctx.lineWidth = Math.max(1.2, gradeSize * 0.08);
            ctx.stroke();
        }
        ctx.fill();
        drawText(ctx, grade, x + gradeSize * 0.7, dotY, gradeSize, 500, text, config, plane);
    }
}

function drawProgress(ctx: OverlayContext2D, route: GhostRunRoute, frame: TelemetryFrame, w: number, h: number,
    safe: number, text: string, accent: string, config: ExtendedOverlayConfig): void {
    const short = Math.min(w, h);
    const portrait = w < h;
    const compact = !portrait && h < 240;
    const width = portrait ? w - safe * 2 - short * 0.04 : compact ? Math.min(w * 0.78, short * 2.9) : Math.min(w * 0.25, short * 0.46);
    const x = portrait ? safe + short * 0.04 : w - safe - width;
    const baseline = h * (portrait ? 0.86 : 0.825);
    const plane = createPlane(x, baseline, width, 0.015, 0.06);
    const detailWidth = config.showElevation && route.ascentM !== undefined ? width * 0.2 : 0;
    const trackWidth = width - detailWidth - (detailWidth ? short * 0.025 : 0);
    const size = Math.max(portrait ? 18 : compact ? 12 : 8, short * (portrait ? 0.05 : 0.027));
    const hasProfile = config.showElevation && route.profile.length > 1 && route.totalDistanceKm > 0;
    const labelWidth = hasProfile ? trackWidth * 0.54 : trackWidth;
    if (config.showDistance) {
        const current = finiteValue(frame.distanceKm, 1);
        const remaining = ` / ${finiteValue(route.totalDistanceKm, 1)} km`;
        ctx.font = `600 ${size}px ${TRAIL_RUN_FONT_FAMILY}`;
        const currentWidth = ctx.measureText(current).width;
        ctx.font = `500 ${size * 0.8}px ${TRAIL_RUN_FONT_FAMILY}`;
        const scale = Math.min(1, labelWidth / (currentWidth + ctx.measureText(remaining).width + 2));
        drawText(ctx, current, x, baseline - size * 0.8, size * scale, 600, text, config, plane);
        const offset = ctx.measureText(current).width;
        drawText(ctx, remaining, x + offset, baseline - size * 0.8, size * 0.8 * scale, 500, text, config, plane);
        const start = plane.project(x, baseline);
        const end = plane.project(x + trackWidth, baseline);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        strokeLine(ctx, text, Math.max(1.8, short * 0.0048), config, 0.4);
        const progress = route.totalDistanceKm > 0 && Number.isFinite(frame.distanceKm)
            ? Math.max(0, Math.min(1, frame.distanceKm / route.totalDistanceKm)) : 0;
        if (progress > 0) {
            ctx.beginPath();
            const current = plane.project(x + trackWidth * progress, baseline);
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(current.x, current.y);
            strokeLine(ctx, accent, Math.max(1.8, short * 0.0048), config);
        }
    }
    if (hasProfile) {
        const elevations = route.profile.map((point) => point.elevationM);
        const low = Math.min(...elevations);
        const range = Math.max(1, Math.max(...elevations) - low);
        const height = Math.max(compact ? 9 : 0, short * (portrait ? 0.05 : 0.032));
        const profileX = config.showDistance ? x + trackWidth * 0.58 : x;
        const profileWidth = config.showDistance ? trackWidth * 0.42 : trackWidth;
        ctx.beginPath();
        route.profile.forEach((point, index) => {
            const px = profileX + profileWidth * Math.max(0, Math.min(1, point.distanceKm / route.totalDistanceKm));
            const py = baseline - short * 0.014 - height * (point.elevationM - low) / range;
            const p = plane.project(px, py);
            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        strokeLine(ctx, accent, Math.max(0.8, short * 0.0015), config);
    }
    if (detailWidth) {
        const gain = `+${Math.round(route.ascentM!)} m`;
        const loss = `−${Math.round(route.descentM!)} m`;
        let detailSize = Math.max(portrait ? 13 : compact ? 10 : 7, short * (portrait ? 0.033 : 0.018));
        ctx.font = `500 ${detailSize}px ${TRAIL_RUN_FONT_FAMILY}`;
        detailSize *= Math.min(1, detailWidth / Math.max(ctx.measureText(gain).width, ctx.measureText(loss).width));
        if (portrait) {
            ctx.save();
            // The total lines share the portrait outer edge, with the track's slope.
            ctx.translate(w - safe, baseline + width * 0.06);
            ctx.transform(1, 0.06, 0, 1, 0, 0);
            ctx.textAlign = 'right';
            drawText(ctx, gain, 0, -detailSize * 1.5, detailSize, 500, text, config);
            drawText(ctx, loss, 0, 0, detailSize, 500, text, config);
            ctx.restore();
        } else {
            drawText(ctx, gain, w - safe - detailWidth, baseline - detailSize * 1.5, detailSize, 500, text, config, plane);
            drawText(ctx, loss, w - safe - detailWidth, baseline, detailSize, 500, text, config, plane);
        }
    }
}
