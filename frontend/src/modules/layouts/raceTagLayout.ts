import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawRaceTag(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const tagW = Math.round(w * (orientation.isPortrait ? 0.35 : 0.22));
    const tagH = Math.round(h * (orientation.isPortrait ? 0.25 : 0.28));
    const cutX = tagW * 0.82;
    const cutY = tagH * 0.78;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tagW, 0);
    ctx.lineTo(tagW, cutY);
    ctx.lineTo(cutX, tagH);
    ctx.lineTo(0, tagH);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = config.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, tagW, tagH);

    if (data.pace) {
        const paceSize = Math.max(20, Math.round(tagW * 0.38 * tuning.textScale));
        const tagLblSize = Math.max(7, Math.round(paceSize * 0.22));
        const innerPad = tagW * 0.1;
        const textColor = config.textColor === '#FFFFFF' ? '#111111' : config.textColor || '#111111';

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.font = `600 ${tagLblSize}px ${config.fontFamily}`;
        ctx.fillText('PACE', innerPad, tagH * 0.28);

        ctx.fillStyle = textColor;
        ctx.font = `400 ${paceSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, innerPad, tagH * 0.28 + paceSize * 0.95);

        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.font = `600 ${Math.max(7, Math.round(tagLblSize * 0.95))}px ${config.fontFamily}`;
        ctx.fillText('MIN/KM', innerPad, tagH * 0.28 + paceSize * 0.95 + tagLblSize * 1.3);
    }

    ctx.restore();

    const stripH = Math.round(h * (orientation.isPortrait ? 0.09 : 0.08));
    const stripY = h - stripH;
    ctx.fillStyle = 'rgba(0,0,0,0.76)';
    ctx.fillRect(0, stripY, w, stripH);

    const stripItems = [
        data.heartRate ? { label: 'HR', value: data.heartRate, unit: 'BPM' } : null,
        data.distance ? { label: 'DIST', value: data.distance, unit: 'KM' } : null,
        data.time ? { label: 'TIME', value: data.time, unit: '' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;
    if (stripItems.length === 0) return;

    const colW = w / stripItems.length;
    const valSize = Math.max(14, Math.round(stripH * 0.44 * tuning.textScale));
    const lblSize = Math.max(7, Math.round(valSize * 0.35));

    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < stripItems.length; i++) {
        const item = stripItems[i]!;

        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colW * i, stripY + stripH * 0.18);
            ctx.lineTo(colW * i, stripY + stripH * 0.82);
            ctx.stroke();
        }

        const colPad = Math.max(6, Math.round(stripH * 0.12));
        const textX = colW * i + colPad;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `600 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(item.label, textX, stripY + stripH * 0.38);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `400 ${valSize}px ${config.fontFamily}`;
        const displayVal = item.unit ? `${item.value} ${item.unit.toLowerCase()}` : item.value;
        ctx.fillText(displayVal, textX, stripY + stripH * 0.82);
    }
}