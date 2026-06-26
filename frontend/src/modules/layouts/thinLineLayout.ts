import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { type MetricMap, type Orientation } from './shared';

export function drawThinLine(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const lineY = h - orientation.safePad - orientation.shortSide * 0.022;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(orientation.safePad, lineY);
    ctx.lineTo(w - orientation.safePad, lineY);
    ctx.stroke();

    const parts = [
        data.pace ? `${data.pace} min/km` : null,
        data.heartRate ? `${data.heartRate} bpm` : null,
        data.distance ? `${data.distance} km` : null,
        data.time ? data.time : null,
    ].filter(Boolean) as string[];
    if (parts.length === 0) return;
    const text = parts.join('   ~   ');
    ctx.textAlign = 'center';
    ctx.fillStyle = config.textColor || 'rgba(255,255,255,0.8)';
    ctx.font = `300 ${Math.max(10, Math.round(orientation.shortSide * 0.02 * tuning.textScale))}px ${config.fontFamily}`;
    ctx.fillText(text, w * 0.5, lineY + orientation.shortSide * 0.03);
}