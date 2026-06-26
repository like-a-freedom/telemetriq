import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { type MetricMap, type Orientation } from './shared';

export function drawTwoTone(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const heroSize = Math.max(34, Math.round(orientation.shortSide * (orientation.isPortrait ? 0.2 : 0.15) * tuning.textScale));
    const leftX = orientation.safePad;
    const bottomY = h - orientation.safePad;
    if (data.pace) {
        ctx.textAlign = 'left';
        ctx.fillStyle = config.accentColor || '#c8ff00';
        ctx.font = `800 ${heroSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, leftX, bottomY - heroSize * 0.35);
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.font = `500 ${Math.max(10, Math.round(heroSize * 0.16))}px ${config.fontFamily}`;
        ctx.fillText('MIN/KM', leftX, bottomY);
    }

    const rightX = w - orientation.safePad;
    const valSize = Math.max(14, Math.round(heroSize * 0.35));
    const lblSize = Math.max(8, Math.round(valSize * 0.35));
    const rows = [
        data.heartRate ? ['HEART RATE', `${data.heartRate} bpm`] : null,
        data.distance ? ['DISTANCE', `${data.distance} km`] : null,
        data.time ? ['TIME', data.time] : null,
    ].filter(Boolean) as Array<[string, string]>;
    if (rows.length === 0) return;
    const rowH = valSize * 1.35 + lblSize * 1.15;
    const startY = bottomY - rowH * rows.length;
    ctx.textBaseline = 'top';
    for (let i = 0; i < rows.length; i++) {
        const y = startY + i * rowH;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(rows[i]![0]!, rightX, y);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(rows[i]![1]!, rightX, y + lblSize + Math.max(2, valSize * 0.16));
    }
}