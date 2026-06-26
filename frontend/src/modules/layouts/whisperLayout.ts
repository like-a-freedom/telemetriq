import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { type MetricMap, type Orientation } from './shared';

export function drawWhisper(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const rows = [
        data.pace ? { label: 'PACE', value: `${data.pace} min/km` } : null,
        data.heartRate ? { label: 'HEART RATE', value: `${data.heartRate} bpm` } : null,
        data.distance ? { label: 'DISTANCE', value: `${data.distance} km` } : null,
        data.time ? { label: 'TIME', value: data.time } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    if (rows.length === 0) return;

    const textSize = Math.max(9, Math.round(orientation.shortSide * 0.019 * tuning.textScale));
    const labelSize = Math.max(8, Math.round(textSize * 0.82));
    const lineH = textSize * 3.0;
    const x = w - orientation.safePad;
    const y = h - orientation.safePad - lineH * rows.length;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    rows.forEach((row, idx) => {
        const yy = y + idx * lineH;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(row.label, x, yy);

        ctx.fillStyle = config.textColor || 'rgba(255,255,255,0.90)';
        ctx.font = `300 ${textSize}px ${config.fontFamily}`;
        ctx.fillText(row.value, x, yy + labelSize + Math.max(2, textSize * 0.25));
    });
}