import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawGlassPanel(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const items = [
        data.pace ? { label: 'PACE', value: data.pace, unit: 'min/km' } : null,
        data.heartRate ? { label: 'HR', value: data.heartRate, unit: 'bpm' } : null,
        data.distance ? { label: 'DIST', value: data.distance, unit: 'km' } : null,
        data.time ? { label: 'TIME', value: data.time, unit: '' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;
    if (items.length === 0) return;

    const valSize = Math.max(15, Math.round(orientation.shortSide * 0.048 * tuning.textScale));
    const lblSize = Math.max(8, Math.round(valSize * 0.32));
    const itemPad = Math.max(18, Math.round(valSize * 0.88));
    const innerPadV = Math.max(12, Math.round(valSize * 0.7));
    const totalW = items.length * itemPad * 2 + items.reduce((sum, item) => {
        ctx.font = `500 ${valSize}px ${config.fontFamily}`;
        return sum + Math.max(ctx.measureText(item.value).width, ctx.measureText(item.label).width);
    }, 0) + (items.length - 1) * itemPad;

    const panelW = Math.min(w * 0.9, Math.max(totalW, items.length * Math.round(valSize * 3.5)));
    const panelH = valSize + lblSize * 2.2 + innerPadV * 2.2 + lblSize * 0.9;
    const panelX = (w - panelW) * 0.5;
    const panelY = h - orientation.safePad - panelH;
    const radius = Math.max(18, Math.round(panelH * 0.42));

    const halo = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    halo.addColorStop(0, 'rgba(160,205,255,0.12)');
    halo.addColorStop(0.45, 'rgba(255,255,255,0.04)');
    halo.addColorStop(1, 'rgba(120,190,255,0.16)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, radius + 2);
    ctx.fill();

    const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    panelGrad.addColorStop(0, 'rgba(248,252,255,0.28)');
    panelGrad.addColorStop(0.22, config.backgroundColor || 'rgba(196,222,255,0.16)');
    panelGrad.addColorStop(1, 'rgba(85,107,146,0.18)');
    ctx.fillStyle = panelGrad;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, radius);
    ctx.fill();

    const innerHighlight = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH * 0.55);
    innerHighlight.addColorStop(0, 'rgba(255,255,255,0.34)');
    innerHighlight.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = innerHighlight;
    ctx.beginPath();
    ctx.roundRect(panelX + 1, panelY + 1, panelW - 2, panelH * 0.52, radius - 2);
    ctx.fill();

    ctx.strokeStyle = config.borderColor || 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(panelX + innerPadV * 0.6, panelY + innerPadV * 0.5, panelW * 0.24, lblSize * 1.8, lblSize);
    ctx.fill();
    ctx.fillStyle = 'rgba(247,251,255,0.72)';
    ctx.font = `700 ${Math.max(8, Math.round(lblSize * 0.9))}px ${config.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('LIQUID GLASS', panelX + innerPadV * 1.1, panelY + innerPadV * 1.55);

    const colW = panelW / items.length;
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const cx2 = panelX + colW * i + colW * 0.5;

        if (i > 0) {
            const separator = ctx.createLinearGradient(panelX + colW * i, panelY + panelH * 0.18, panelX + colW * i, panelY + panelH * 0.82);
            separator.addColorStop(0, 'rgba(255,255,255,0.05)');
            separator.addColorStop(0.5, 'rgba(255,255,255,0.22)');
            separator.addColorStop(1, 'rgba(255,255,255,0.05)');
            ctx.strokeStyle = separator;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(panelX + colW * i, panelY + panelH * 0.15);
            ctx.lineTo(panelX + colW * i, panelY + panelH * 0.85);
            ctx.stroke();
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(245,250,255,0.72)';
        ctx.font = `700 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(item.label, cx2, panelY + innerPadV * 1.8 + lblSize);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `700 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(item.value, cx2, panelY + innerPadV * 1.8 + lblSize + valSize * 1.08);
        if (item.unit) {
            ctx.fillStyle = item.label === 'PACE' ? (config.accentColor || '#8fd3ff') : 'rgba(235,244,255,0.42)';
            ctx.font = `600 ${Math.max(7, Math.round(lblSize * 0.88))}px ${config.fontFamily}`;
            ctx.fillText(item.unit.toUpperCase(), cx2, panelY + innerPadV * 1.8 + lblSize + valSize * 1.08 + lblSize * 1.45);
        }
    }
}