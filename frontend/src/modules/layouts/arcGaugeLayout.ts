import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { drawMetricBlock, parsePace, type MetricMap, type Orientation } from './shared';

export function drawArcGauge(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const paceNumber = parsePace(data.pace);
    const progress = Math.max(0, Math.min(1, (10 - paceNumber) / 7));
    const radius = orientation.shortSide * (orientation.isPortrait ? 0.18 : 0.13);
    const cx = w * 0.5;
    const cy = orientation.safePad + radius + orientation.compactPad;
    const start = Math.PI;
    const end = start + Math.PI * progress;
    const stroke = Math.max(2, radius * 0.08);

    if (data.pace) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = stroke;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, Math.PI, 0, false);
        ctx.stroke();

        ctx.strokeStyle = config.accentColor || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, start, end, false);
        ctx.stroke();

        const dotX = cx + Math.cos(end) * radius;
        const dotY = cy + Math.sin(end) * radius;
        ctx.fillStyle = config.accentColor || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(dotX, dotY, Math.max(3, stroke * 1.2), 0, Math.PI * 2);
        ctx.fill();

        const paceSize = Math.max(20, Math.round(radius * 0.58 * tuning.textScale));
        const labelSize = Math.max(8, Math.round(radius * 0.14 * tuning.textScale));
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `300 ${paceSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, cx, cy + radius * 0.35);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText('MIN / KM', cx, cy + radius * 0.58);
    }

    const sideValueSize = Math.max(16, Math.round(radius * 0.38));
    const sideLabelSize = Math.max(9, Math.round(radius * 0.18));
    const leftX = orientation.safePad;
    const topY = orientation.isPortrait ? h * 0.42 : h * 0.34;
    const leftItems = [
        data.heartRate ? { label: 'HR', value: data.heartRate, unit: 'bpm' } : null,
        data.distance ? { label: 'DIST', value: data.distance, unit: 'km' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;
    leftItems.forEach((item, idx) => {
        drawMetricBlock(
            ctx,
            leftX,
            topY + idx * sideValueSize * 2.5,
            item.label,
            item.value,
            item.unit,
            sideLabelSize,
            sideValueSize,
            config,
            'left',
        );
    });

    if (data.time) {
        drawMetricBlock(
            ctx,
            w - orientation.safePad,
            h - orientation.safePad - sideValueSize * 1.4,
            'ELAPSED',
            data.time,
            '',
            sideLabelSize,
            sideValueSize,
            config,
            'right',
        );
    }
}