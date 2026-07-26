import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type Orientation } from './shared';

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
    const items = toStandardMetricItems(data, {
        pace: { label: 'PACE', unit: 'min/km' },
        heartRate: { label: 'HEART RATE', unit: 'bpm' },
        distance: { label: 'DISTANCE', unit: 'km' },
        time: { label: 'TIME', unit: '' },
    });
    if (items.length === 0) return;
    const sidePad = orientation.safePad;
    const contentX = sidePad;
    const contentW = w - sidePad * 2;
    const colW = contentW / items.length;
    const labelSize = Math.max(8, Math.round(barH * 0.10 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(barH * 0.20 * tuning.textScale));
    const unitSize = Math.max(8, Math.round(labelSize * 0.9));

    for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
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
        ctx.fillText(item.label, centerX, y + barH * 0.27);

        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(item.value, centerX, y + barH * 0.58);

        if (item.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.font = `400 ${unitSize}px ${config.fontFamily}`;
            ctx.fillText(item.unit, centerX, y + barH * 0.76);
        }
    }
}
