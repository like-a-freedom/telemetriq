import type { OverlayContext2D } from '../overlayUtils';

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
    backgroundColor?: string;
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
        unitColor = '#00C853',
        textColor = '#FFFFFF',
        backgroundColor = 'rgba(4, 18, 8, 0.76)',
    }: SpeedometerGaugeOptions,
): void {
    const radius = diameter / 2;
    const ringRadius = radius - Math.max(10, diameter * 0.07);
    const startAngle = (135 * Math.PI) / 180;
    const sweep = (270 * Math.PI) / 180;
    const safeMaxSpeed = Math.max(1, maxSpeed);
    const safeSpeed = Number.isFinite(speedKmh) ? Math.max(0, speedKmh) : 0;
    const progress = Math.max(0, Math.min(1, safeSpeed / safeMaxSpeed));
    const endAngle = startAngle + sweep * progress;
    const outerLineWidth = Math.max(2, diameter * 0.012);
    const activeLineWidth = Math.max(8, diameter * 0.048);
    const trackLineWidth = Math.max(8, diameter * 0.05);
    const valueFontSize = Math.max(26, Math.round(diameter * 0.22));
    const unitFontSize = Math.max(11, Math.round(diameter * 0.072));
    const paddedSpeed = Math.round(safeSpeed).toString().padStart(3, '0');
    const safeZoneEnd = 0.78;
    const warningZoneEnd = 0.88;
    const warningColor = '#FF9F3A';
    const dangerColor = '#FF5A36';

    ctx.save();

    if (typeof ctx.createRadialGradient === 'function') {
        const glow = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);
        glow.addColorStop(0, 'rgba(24, 36, 24, 0.96)');
        glow.addColorStop(0.5, 'rgba(10, 12, 10, 0.95)');
        glow.addColorStop(1, backgroundColor);
        ctx.fillStyle = glow;
    } else {
        ctx.fillStyle = backgroundColor;
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = outerLineWidth;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();

    drawGaugeArc(ctx, cx, cy, ringRadius, startAngle, startAngle + sweep, trackLineWidth, 'rgba(255,255,255,0.1)');
    drawGaugeArc(ctx, cx, cy, ringRadius, startAngle, startAngle + sweep * safeZoneEnd, trackLineWidth, 'rgba(0, 230, 118, 0.22)');
    drawGaugeArc(ctx, cx, cy, ringRadius, startAngle + sweep * safeZoneEnd, startAngle + sweep * warningZoneEnd, trackLineWidth, 'rgba(255, 159, 58, 0.28)');
    drawGaugeArc(ctx, cx, cy, ringRadius, startAngle + sweep * warningZoneEnd, startAngle + sweep, trackLineWidth, 'rgba(255, 90, 54, 0.32)');

    for (let tick = 0; tick <= 18; tick += 1) {
        const angle = startAngle + (sweep / 18) * tick;
        const ratio = tick / 18;
        const inner = ringRadius - diameter * 0.08;
        const outer = ringRadius - diameter * 0.02;
        ctx.strokeStyle = ratio <= progress
            ? getZoneColor(ratio, accentColor, warningColor, dangerColor, 0.9)
            : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = tick % 3 === 0 ? Math.max(1.5, diameter * 0.01) : Math.max(1, diameter * 0.006);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.stroke();
    }

    drawActiveZoneArc(ctx, cx, cy, ringRadius, startAngle, sweep, progress, safeZoneEnd, warningZoneEnd, activeLineWidth, accentColor, warningColor, dangerColor);

    ctx.fillStyle = textColor;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(endAngle) * (ringRadius + diameter * 0.01), cy + Math.sin(endAngle) * (ringRadius + diameter * 0.01));
    ctx.lineTo(cx + Math.cos(endAngle + 0.12) * (ringRadius + diameter * 0.075), cy + Math.sin(endAngle + 0.12) * (ringRadius + diameter * 0.075));
    ctx.lineTo(cx + Math.cos(endAngle - 0.12) * (ringRadius + diameter * 0.075), cy + Math.sin(endAngle - 0.12) * (ringRadius + diameter * 0.075));
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.font = `300 ${valueFontSize}px ${fontFamily}`;
    ctx.fillText(paddedSpeed, cx, cy);

    ctx.fillStyle = unitColor;
    ctx.font = `600 ${unitFontSize}px ${fontFamily}`;
    ctx.fillText('km/h', cx, cy + valueFontSize * 0.72);

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
    const shadowBlur = Math.max(7, radius * 0.18);
    const segments: Array<{ start: number; end: number; color: string }> = [
        { start: 0, end: Math.min(progress, safeZoneEnd), color: accentColor },
        { start: safeZoneEnd, end: Math.min(progress, warningZoneEnd), color: warningColor },
        { start: warningZoneEnd, end: progress, color: dangerColor },
    ];

    for (const segment of segments) {
        if (segment.end <= segment.start) {
            continue;
        }

        ctx.strokeStyle = segment.color;
        ctx.shadowColor = segment.color;
        ctx.shadowBlur = shadowBlur;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle + sweep * segment.start, startAngle + sweep * segment.end);
        ctx.stroke();
    }

    ctx.shadowBlur = 0;
}

function getZoneColor(
    ratio: number,
    accentColor: string,
    warningColor: string,
    dangerColor: string,
    alpha: number,
): string {
    if (ratio >= 0.88) {
        return withAlpha(dangerColor, alpha);
    }

    if (ratio >= 0.78) {
        return withAlpha(warningColor, alpha);
    }

    return withAlpha(accentColor, alpha);
}

function withAlpha(color: string, alpha: number): string {
    if (!color.startsWith('#')) {
        return color;
    }

    const hex = color.slice(1);
    const value = hex.length === 3
        ? hex.split('').map((char) => char + char).join('')
        : hex;

    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
