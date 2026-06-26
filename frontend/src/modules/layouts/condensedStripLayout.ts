import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { condensedStripStableValue, type MetricMap, type Orientation } from './shared';

export function drawCondensedStrip(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const barH = Math.max(24, Math.round(h * (orientation.isPortrait ? 0.06 : 0.05)));
    const y = h - barH;
    ctx.fillStyle = config.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, y, w, barH);
    const items = [
        data.pace ? ['PACE', `${data.pace} min/km`] : null,
        data.heartRate ? ['HR', `${data.heartRate} bpm`] : null,
        data.distance ? ['DIST', `${data.distance} km`] : null,
        data.time ? ['TIME', data.time] : null,
    ].filter(Boolean) as Array<[string, string]>;
    if (items.length === 0) return;
    const segW = w / items.length;
    const labelSize = Math.max(8, Math.round(barH * 0.18 * tuning.textScale));
    const baseValueSize = Math.max(9, Math.round(barH * 0.48 * tuning.textScale));

    let valueSize = baseValueSize;
    while (valueSize > 8) {
        let allFit = true;
        ctx.font = `700 ${valueSize}px ${config.fontFamily}`;
        for (const item of items) {
            const stableValue = condensedStripStableValue(item[0]);
            if (ctx.measureText(stableValue).width > segW * 0.9) {
                allFit = false;
                break;
            }
        }
        if (allFit) break;
        valueSize -= 1;
    }

    for (let i = 0; i < items.length; i++) {
        const x = segW * i + segW * 0.5;
        if (i > 0) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();
            ctx.moveTo(segW * i, y + 2);
            ctx.lineTo(segW * i, y + barH - 2);
            ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.font = `400 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, x, y + barH * 0.32);
        ctx.fillStyle = '#111111';
        ctx.font = `700 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, x, y + barH * 0.82);
    }
}