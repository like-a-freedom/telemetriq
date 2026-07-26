import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type Orientation } from './shared';

export function drawWhisper(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const items = toStandardMetricItems(data, {
        pace: { label: 'PACE', unit: 'min/km' },
        heartRate: { label: 'HEART RATE', unit: 'bpm' },
        distance: { label: 'DISTANCE', unit: 'km' },
        time: { label: 'TIME', unit: '' },
    });
    if (items.length === 0) return;

    const textSize = Math.max(9, Math.round(orientation.shortSide * 0.019 * tuning.textScale));
    const labelSize = Math.max(8, Math.round(textSize * 0.82));
    const lineH = textSize * 3.0;
    const x = w - orientation.safePad;
    const y = h - orientation.safePad - lineH * items.length;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    items.forEach((item, idx) => {
        const yy = y + idx * lineH;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(item.label, x, yy);

        ctx.fillStyle = config.textColor || 'rgba(255,255,255,0.90)';
        ctx.font = `300 ${textSize}px ${config.fontFamily}`;
        ctx.fillText(item.unit ? `${item.value} ${item.unit}` : item.value, x, yy + labelSize + Math.max(2, textSize * 0.25));
    });
}
