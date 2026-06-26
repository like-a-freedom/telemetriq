import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawSwissGrid(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const barH = Math.round(h * (orientation.isPortrait ? 0.17 : 0.2));
    const y = h - barH;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, y, w, barH);
    const items = [
        data.pace ? ['PACE', data.pace, 'min/km'] : null,
        data.heartRate ? ['HEART RATE', data.heartRate, 'bpm'] : null,
        data.distance ? ['DISTANCE', data.distance, 'km'] : null,
        data.time ? ['TIME', data.time, ''] : null,
    ].filter(Boolean) as Array<[string, string, string]>;
    if (items.length === 0) return;
    const sidePad = orientation.safePad;
    const contentX = sidePad;
    const contentW = w - sidePad * 2;
    const colW = contentW / items.length;
    const labelSize = Math.max(8, Math.round(barH * 0.10 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(barH * 0.20 * tuning.textScale));
    const unitSize = Math.max(8, Math.round(labelSize * 0.9));

    for (let i = 0; i < items.length; i++) {
        const colX = contentX + colW * i;
        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.moveTo(colX, y + barH * 0.12);
            ctx.lineTo(colX, y + barH * 0.88);
            ctx.stroke();
        }

        const centerX = colX + colW / 2;
        ctx.textAlign = 'center';

        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, centerX, y + barH * 0.27);

        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, centerX, y + barH * 0.58);

        if (items[i]![2]) {
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.font = `400 ${unitSize}px ${config.fontFamily}`;
            ctx.fillText(items[i]![2]!, centerX, y + barH * 0.76);
        }
    }
}