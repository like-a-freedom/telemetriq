import type { OverlayContext2D } from '../overlayUtils';
import { clamp } from '../overlayUtils';

export interface SpeedometerGaugeOptions {
    cx: number;
    cy: number;
    diameter: number;
    speedKmh?: number;
    maxSpeed?: number;
    fontFamily?: string;
    accentColor?: string;
    unitColor?: string;
    textColor?: string;
}

export function drawSpeedometerGauge(
    ctx: OverlayContext2D,
    {
        cx,
        cy,
        diameter,
        speedKmh = 0,
        maxSpeed = 60,
        fontFamily = 'Inter, sans-serif',
        accentColor = '#00E676',
        unitColor = accentColor,
        textColor = '#FFFFFF',
    }: SpeedometerGaugeOptions,
): void {
    if (!Number.isFinite(diameter) || diameter < 48 || !Number.isFinite(cx) || !Number.isFinite(cy)) return;

    const radius = diameter / 2;
    const ringRadius = radius - Math.max(6, diameter * 0.12);
    const startAngle = (135 * Math.PI) / 180;
    const sweep = (270 * Math.PI) / 180;
    const safeMaxSpeed = Math.max(1, maxSpeed);
    const safeSpeed = Number.isFinite(speedKmh) ? Math.max(0, speedKmh) : 0;
    const progress = Math.max(0, Math.min(1, safeSpeed / safeMaxSpeed));
    const endAngle = startAngle + sweep * progress;
    const outlineWidth = clamp(diameter * 0.016, 1, 2.8);
    const trackLineWidth = clamp(diameter * 0.035, 2, 7);
    const activeLineWidth = clamp(diameter * 0.052, 3, 11);
    const valueFontSize = clamp(Math.round(diameter * 0.25), 16, 44);
    const unitFontSize = clamp(Math.round(diameter * 0.082), 8, 17);
    const paddedSpeed = Math.round(safeSpeed).toString().padStart(3, '0');
    const safeZoneEnd = 0.78;
    const warningZoneEnd = 0.88;
    const warningColor = '#FF9F3A';
    const dangerColor = '#FF5A36';

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 0;

    // Fine double keyline keeps the open dial visible without filling or
    // dimming the footage beneath it.
    ctx.beginPath();
    ctx.arc(cx, cy, radius - outlineWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(4,10,16,0.84)';
    ctx.lineWidth = outlineWidth + 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - outlineWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(248,250,252,0.5)';
    ctx.lineWidth = Math.max(0.7, outlineWidth * 0.32);
    ctx.stroke();

    drawGaugeArc(ctx, cx, cy, ringRadius, startAngle, startAngle + sweep,
        trackLineWidth + 1.4, 'rgba(4,10,16,0.76)');
    drawGaugeArc(ctx, cx, cy, ringRadius, startAngle, startAngle + sweep,
        trackLineWidth, 'rgba(248,250,252,0.38)');

    for (let tick = 0; tick <= 18; tick += 1) {
        const angle = startAngle + (sweep / 18) * tick;
        const ratio = tick / 18;
        const inner = ringRadius - diameter * 0.075;
        const outer = ringRadius - diameter * 0.018;
        const tickWidth = tick % 3 === 0 ? Math.max(1.4, diameter * 0.009) : Math.max(0.8, diameter * 0.005);
        const tickColor = ratio <= progress
            ? getZoneColor(ratio, accentColor, warningColor, dangerColor, 1)
            : 'rgba(248,250,252,0.76)';

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.strokeStyle = 'rgba(4,10,16,0.82)';
        ctx.lineWidth = tickWidth + 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = tickWidth;
        ctx.stroke();
    }

    drawActiveZoneArc(ctx, cx, cy, ringRadius, startAngle, sweep, progress,
        safeZoneEnd, warningZoneEnd, activeLineWidth, accentColor, warningColor, dangerColor);

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(endAngle) * (ringRadius + diameter * 0.01), cy + Math.sin(endAngle) * (ringRadius + diameter * 0.01));
    ctx.lineTo(cx + Math.cos(endAngle + 0.12) * (ringRadius + diameter * 0.075), cy + Math.sin(endAngle + 0.12) * (ringRadius + diameter * 0.075));
    ctx.lineTo(cx + Math.cos(endAngle - 0.12) * (ringRadius + diameter * 0.075), cy + Math.sin(endAngle - 0.12) * (ringRadius + diameter * 0.075));
    ctx.closePath();
    ctx.fillStyle = textColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(4,10,16,0.9)';
    ctx.lineWidth = Math.max(0.8, diameter * 0.012);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${valueFontSize}px ${fontFamily}`;
    ctx.lineWidth = clamp(valueFontSize * 0.085, 0.9, 2.4);
    ctx.strokeStyle = 'rgba(4,10,16,0.92)';
    if (typeof ctx.strokeText === 'function') ctx.strokeText(paddedSpeed, cx, cy - unitFontSize * 0.2);
    ctx.fillStyle = textColor;
    ctx.fillText(paddedSpeed, cx, cy - unitFontSize * 0.2);

    ctx.font = `600 ${unitFontSize}px ${fontFamily}`;
    ctx.lineWidth = Math.max(0.8, unitFontSize * 0.1);
    if (typeof ctx.strokeText === 'function') ctx.strokeText('km/h', cx, cy + valueFontSize * 0.64);
    ctx.fillStyle = unitColor;
    ctx.fillText('km/h', cx, cy + valueFontSize * 0.64);

    ctx.restore();
}

function drawGaugeArc(
    ctx: OverlayContext2D,
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    lineWidth: number,
    color: string,
): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();
}

function drawActiveZoneArc(
    ctx: OverlayContext2D,
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    sweep: number,
    progress: number,
    safeZoneEnd: number,
    warningZoneEnd: number,
    lineWidth: number,
    accentColor: string,
    warningColor: string,
    dangerColor: string,
): void {
    const segments: Array<{ start: number; end: number; color: string }> = [
        { start: 0, end: Math.min(progress, safeZoneEnd), color: accentColor },
        { start: safeZoneEnd, end: Math.min(progress, warningZoneEnd), color: warningColor },
        { start: warningZoneEnd, end: progress, color: dangerColor },
    ];

    for (const segment of segments) {
        if (segment.end <= segment.start) continue;

        const segmentStart = startAngle + sweep * segment.start;
        const segmentEnd = startAngle + sweep * segment.end;
        drawGaugeArc(ctx, cx, cy, radius, segmentStart, segmentEnd, lineWidth + 1.6, 'rgba(4,10,16,0.84)');
        drawGaugeArc(ctx, cx, cy, radius, segmentStart, segmentEnd, lineWidth, segment.color);
    }
}

function getZoneColor(
    ratio: number,
    accentColor: string,
    warningColor: string,
    dangerColor: string,
    alpha: number,
): string {
    if (ratio >= 0.88) return withAlpha(dangerColor, alpha);
    if (ratio >= 0.78) return withAlpha(warningColor, alpha);
    return withAlpha(accentColor, alpha);
}

function withAlpha(color: string, alpha: number): string {
    if (!color.startsWith('#')) return color;

    const hex = color.slice(1);
    const value = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
