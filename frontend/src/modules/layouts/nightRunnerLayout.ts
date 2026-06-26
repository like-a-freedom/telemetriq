import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawNightRunner(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (data.pace) {
        const paceSize = Math.max(28, Math.round(orientation.shortSide * (orientation.isPortrait ? 0.2 : 0.15) * tuning.textScale));
        const paceUnitSize = Math.max(8, Math.round(paceSize * 0.17));
        const paceY = orientation.safePad + paceSize + orientation.compactPad;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(251,191,36,0.45)';
        ctx.shadowBlur = Math.max(12, paceSize * 0.4);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `200 ${paceSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, w * 0.5, paceY);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(251,191,36,0.62)';
        ctx.font = `500 ${paceUnitSize}px ${config.fontFamily}`;
        ctx.fillText('MIN / KM', w * 0.5, paceY + paceUnitSize * 1.4);
    }

    const stripH = Math.round(h * (orientation.isPortrait ? 0.22 : 0.2));
    const grad = ctx.createLinearGradient(0, h - stripH, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.35, 'rgba(0,0,0,0.72)');
    grad.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - stripH, w, stripH);

    const metrics = [
        data.heartRate ? { label: 'HEART RATE', value: data.heartRate, unit: 'bpm', glow: 'rgba(248,113,113,0.45)', align: 'left' as const } : null,
        data.distance ? { label: 'DISTANCE', value: data.distance, unit: 'km', glow: 'rgba(251,191,36,0.35)', align: 'center' as const } : null,
        data.time ? { label: 'ELAPSED', value: data.time, unit: '', glow: 'rgba(255,255,255,0.22)', align: 'right' as const } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string; glow: string; align: 'left' | 'center' | 'right' }>;

    if (metrics.length === 0) return;

    const valSize = Math.max(14, Math.round(orientation.shortSide * 0.05 * tuning.textScale));
    const lblSize = Math.max(7, Math.round(valSize * 0.3));
    const baseY = h - orientation.safePad;

    if (metrics.length > 1) {
        const step = (w - orientation.safePad * 2) / metrics.length;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let i = 1; i < metrics.length; i++) {
            const lx = orientation.safePad + step * i;
            ctx.beginPath();
            ctx.moveTo(lx, baseY - valSize * 1.6);
            ctx.lineTo(lx, baseY - valSize * 0.1);
            ctx.stroke();
        }
    }

    const step = (w - orientation.safePad * 2) / (metrics.length || 1);
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < metrics.length; i++) {
        const m = metrics[i]!;
        let anchorX: number;
        if (m.align === 'left') {
            anchorX = orientation.safePad + step * i + step * 0.05;
        } else if (m.align === 'right') {
            anchorX = orientation.safePad + step * (i + 1) - step * 0.05;
        } else {
            anchorX = orientation.safePad + step * i + step * 0.5;
        }

        ctx.textAlign = m.align;
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(m.label, anchorX, baseY - valSize * 1.15);

        ctx.shadowColor = m.glow;
        ctx.shadowBlur = Math.max(8, valSize * 0.3);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(m.value, anchorX, baseY);
        ctx.shadowBlur = 0;

        if (m.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.font = `400 ${lblSize}px ${config.fontFamily}`;
            ctx.fillText(m.unit, anchorX, baseY + lblSize * 1.2);
        }
    }
}