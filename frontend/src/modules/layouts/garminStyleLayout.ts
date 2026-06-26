import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawGarminStyle(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const accent = config.accentColor || '#f97316';
    const gaugeR = Math.round(orientation.shortSide * (orientation.isPortrait ? 0.14 : 0.1));
    const cx = orientation.safePad + gaugeR + gaugeR * 0.15;
    const cy = h - orientation.safePad - gaugeR - gaugeR * 0.15;
    const strokeW = Math.max(3, gaugeR * 0.1);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.arc(cx, cy, gaugeR, 0, Math.PI * 2);
    ctx.stroke();

    if (data.heartRate) {
        const hrVal = parseInt(data.heartRate, 10);
        const hrPercent = Math.min(1, hrVal / 200);
        const startA = 2.44;
        const sweepA = 4.54;
        const endA = startA + sweepA * hrPercent;
        ctx.strokeStyle = accent;
        ctx.lineWidth = strokeW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, gaugeR, startA, endA, false);
        ctx.stroke();

        const dotX = cx + Math.cos(endA) * gaugeR;
        const dotY = cy + Math.sin(endA) * gaugeR;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(dotX, dotY, Math.max(3, strokeW * 1.2), 0, Math.PI * 2);
        ctx.fill();

        const hrValSize = Math.max(12, Math.round(gaugeR * 0.5 * tuning.textScale));
        const hrUnitSize = Math.max(8, Math.round(gaugeR * 0.16 * tuning.textScale));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${hrValSize}px ${config.fontFamily}`;
        ctx.fillText(data.heartRate, cx, cy + hrValSize * 0.35);
        ctx.fillStyle = accent;
        ctx.font = `500 ${hrUnitSize}px ${config.fontFamily}`;
        ctx.fillText('bpm', cx, cy + hrValSize * 0.7);
    }

    const rightX = w - orientation.safePad;
    const metricRows = [
        data.pace ? { label: 'PACE', unit: 'min/km', value: data.pace } : null,
        data.distance ? { label: 'DIST', unit: 'km', value: data.distance } : null,
        data.time ? { label: 'TIME', unit: '', value: data.time } : null,
    ].filter(Boolean) as Array<{ label: string; unit: string; value: string }>;

    const valSize = Math.max(16, Math.round(orientation.shortSide * 0.055 * tuning.textScale));
    const lblSize = Math.max(7, Math.round(valSize * 0.32));
    const rowH = valSize * 1.6;
    const totalH = rowH * metricRows.length;
    const startY = cy - totalH / 2 + rowH * 0.5;

    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < metricRows.length; i++) {
        const row = metricRows[i]!;
        const baseY = startY + i * rowH;

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(row.label, rightX - valSize * (row.value.length > 5 ? 3.8 : 3.0) - lblSize, baseY - lblSize * 0.6);
        if (row.unit) {
            ctx.fillStyle = accent;
            ctx.font = `400 ${lblSize}px ${config.fontFamily}`;
            ctx.fillText(row.unit, rightX - valSize * (row.value.length > 5 ? 3.8 : 3.0) - lblSize, baseY + lblSize * 0.9);
        }

        const fontSize = row.value.length > 5 ? Math.round(valSize * 0.8) : valSize;
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${fontSize}px ${config.fontFamily}`;
        ctx.fillText(row.value, rightX, baseY);
    }
}