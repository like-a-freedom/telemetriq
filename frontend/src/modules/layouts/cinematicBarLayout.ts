import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { type MetricMap, type Orientation } from './shared';

export function drawCinematicBar(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const topBar = Math.round(h * (orientation.isPortrait ? 0.075 : 0.06));
    const bottomBar = Math.round(h * (orientation.isPortrait ? 0.1 : 0.085));
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, w, topBar);
    ctx.fillRect(0, h - bottomBar, w, bottomBar);

    const items = [
        data.pace ? ['PACE', `${data.pace} min/km`] : null,
        data.heartRate ? ['HR', `${data.heartRate} bpm`] : null,
        data.distance ? ['DIST', `${data.distance} km`] : null,
        data.time ? ['TIME', data.time] : null,
    ].filter(Boolean) as Array<[string, string]>;
    if (items.length === 0) return;
    const labelSize = Math.max(9, Math.round(orientation.shortSide * 0.018 * tuning.textScale));
    const valueSize = Math.max(14, Math.round(orientation.shortSide * 0.030 * tuning.textScale));
    const segmentW = (w - orientation.safePad * 2) / items.length;
    for (let i = 0; i < items.length; i++) {
        const x = orientation.safePad + segmentW * i + segmentW * 0.5;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, x, h - bottomBar * 0.62);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, x, h - bottomBar * 0.28);
        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.16)';
            ctx.beginPath();
            ctx.moveTo(orientation.safePad + segmentW * i, h - bottomBar * 0.72);
            ctx.lineTo(orientation.safePad + segmentW * i, h - bottomBar * 0.18);
            ctx.stroke();
        }
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
    ctx.fillText('REC ●', orientation.safePad, topBar * 0.63);
    ctx.textAlign = 'right';
    ctx.fillText('GPX TELEMETRY', w - orientation.safePad, topBar * 0.63);
}