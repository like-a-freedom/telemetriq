import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type Orientation } from './shared';

export function drawSoftRounded(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const items = toStandardMetricItems(data, {
        pace: { label: 'Pace', unit: 'min/km' },
        heartRate: { label: 'HR', unit: 'bpm' },
        distance: { label: 'Dist', unit: 'km' },
        time: { label: 'Time', unit: '' },
    });
    if (items.length === 0) return;
    const gap = orientation.shortSide * 0.01;
    const cardH = h * (orientation.isPortrait ? 0.09 : 0.12);
    const totalW = w - orientation.safePad * 2;
    const cardW = (totalW - gap * (items.length - 1)) / items.length;
    const y = h - orientation.safePad - cardH;
    const radius = Math.max(8, cardH * 0.24);
    const labelSize = Math.max(8, Math.round(cardH * 0.16 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(cardH * 0.33 * tuning.textScale));

    for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const x = orientation.safePad + i * (cardW + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, radius);
        ctx.fill();

        const textColor = 'rgba(24,24,27,0.92)';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(24,24,27,0.45)';
        ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(item.label, x + cardW / 2, y + cardH * 0.28);

        ctx.fillStyle = textColor;
        ctx.font = `600 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(item.value, x + cardW / 2, y + cardH * 0.64);

        if (item.unit) {
            ctx.fillStyle = 'rgba(24,24,27,0.35)';
            ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
            ctx.fillText(item.unit, x + cardW / 2, y + cardH * 0.86);
        }
    }
}
