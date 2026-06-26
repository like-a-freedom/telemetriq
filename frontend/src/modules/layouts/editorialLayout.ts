import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { type MetricMap, type Orientation } from './shared';

export function drawEditorial(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const heroSize = Math.max(34, Math.round(orientation.shortSide * 0.15 * tuning.textScale));
    const labelSize = Math.max(8, Math.round(heroSize * 0.14));
    const smallValue = Math.max(13, Math.round(heroSize * 0.32));

    const leftX = orientation.safePad;
    const baselineY = h - orientation.safePad - heroSize * 0.15;
    if (data.pace) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${labelSize}px Inter, sans-serif`;
        ctx.fillText('PACE', leftX, baselineY - heroSize * 1.05);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${heroSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, leftX, baselineY);
        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.font = `400 ${Math.max(10, Math.round(labelSize * 1.05))}px Inter, sans-serif`;
        ctx.fillText('min/km', leftX, baselineY + Math.max(12, Math.round(heroSize * 0.24)));
    }

    const rightX = w - orientation.safePad;
    const topY = orientation.safePad + smallValue;
    const lines = [
        data.heartRate ? ['HEART RATE', `${data.heartRate} bpm`] : null,
        data.distance ? ['DISTANCE', `${data.distance} km`] : null,
        data.time ? ['ELAPSED', data.time] : null,
    ].filter(Boolean) as Array<[string, string]>;
    for (let i = 0; i < lines.length; i++) {
        const y = topY + i * smallValue * 3.0;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.85))}px Inter, sans-serif`;
        ctx.fillText(lines[i]![0]!, rightX, y - smallValue * 1.2);
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = `400 ${smallValue}px ${config.fontFamily}`;
        ctx.fillText(lines[i]![1]!, rightX, y);
    }
}