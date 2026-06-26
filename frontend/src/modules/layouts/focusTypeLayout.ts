import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawFocusType(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const paceExists = Boolean(data.pace);
    const centerX = w * 0.5;

    if (paceExists) {
        const heroSize = Math.max(60, Math.round(Math.min(w, h) * (orientation.isPortrait ? 0.34 : 0.26) * tuning.textScale));
        const paceUnitSize = Math.max(11, Math.round(heroSize * 0.12));
        const centerY = h * (orientation.isPortrait ? 0.44 : 0.4);

        ctx.save();
        ctx.font = `italic 900 ${heroSize}px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(0,0,0,0.42)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.fillText(data.pace!, centerX, centerY);
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.68)';
        ctx.font = `700 ${paceUnitSize}px "DM Sans", Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('MIN / KM', centerX, centerY + paceUnitSize * 2.55);
    }

    const subItems = [
        data.heartRate ? { label: 'HEART RATE', value: data.heartRate, unit: 'BPM' } : null,
        data.distance ? { label: 'DISTANCE', value: data.distance, unit: 'KM' } : null,
        data.time ? { label: 'TIME', value: data.time, unit: '' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;

    if (subItems.length === 0) return;

    const pillH = Math.max(54, Math.round(orientation.shortSide * 0.1));
    const pillGap = Math.max(12, Math.round(pillH * 0.18));
    const totalGap = pillGap * (subItems.length - 1);
    const availableW = Math.min(w - orientation.safePad * 2, w * (orientation.isPortrait ? 0.84 : 0.72));
    const pillW = (availableW - totalGap) / subItems.length;
    const startX = (w - (pillW * subItems.length + totalGap)) * 0.5;
    const pillY = paceExists
        ? h - orientation.safePad - pillH
        : h * (orientation.isPortrait ? 0.6 : 0.56);
    const labelSize = Math.max(8, Math.round(pillH * 0.15));
    const valueSize = Math.max(16, Math.round(pillH * 0.27));
    const unitSize = Math.max(8, Math.round(pillH * 0.13));

    for (let i = 0; i < subItems.length; i++) {
        const item = subItems[i]!;
        const x = startX + i * (pillW + pillGap);
        const radius = Math.max(16, Math.round(pillH * 0.34));
        const glass = ctx.createLinearGradient(x, pillY, x, pillY + pillH);
        glass.addColorStop(0, 'rgba(255,255,255,0.16)');
        glass.addColorStop(1, 'rgba(255,255,255,0.06)');
        ctx.fillStyle = glass;
        ctx.beginPath();
        ctx.roundRect(x, pillY, pillW, pillH, radius);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(x, pillY, pillW, pillH, radius);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(255,255,255,0.58)';
        ctx.font = `700 ${labelSize}px "DM Sans", Inter, sans-serif`;
        ctx.fillText(item.label, x + pillW / 2, pillY + labelSize + pillH * 0.18);

        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `500 ${valueSize}px "DM Sans", Inter, sans-serif`;
        ctx.fillText(item.value, x + pillW / 2, pillY + pillH * 0.66);

        if (item.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.42)';
            ctx.font = `600 ${unitSize}px "DM Sans", Inter, sans-serif`;
            ctx.fillText(item.unit, x + pillW / 2, pillY + pillH - pillH * 0.16);
        }
    }
}