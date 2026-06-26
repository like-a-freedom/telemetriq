import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawSportsBroadcast(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const accent = config.accentColor || '#f97316';
    const barH = Math.round(h * (orientation.isPortrait ? 0.12 : 0.1));
    const accentLineH = Math.max(2, Math.round(barH * 0.03));
    const sideTagW = Math.max(18, Math.round(barH * 0.35));
    const y = h - barH - accentLineH;

    ctx.fillStyle = accent;
    ctx.fillRect(0, y, w, accentLineH);

    ctx.fillStyle = config.backgroundColor || 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, y + accentLineH, w, barH);

    ctx.fillStyle = accent;
    ctx.fillRect(0, y + accentLineH, sideTagW, barH);

    ctx.save();
    ctx.translate(sideTagW * 0.5, y + accentLineH + barH * 0.5);
    ctx.rotate(-Math.PI / 2);
    const tagFontSize = Math.max(7, Math.round(sideTagW * 0.38 * tuning.textScale));
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.font = `700 ${tagFontSize}px ${config.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RUN', 0, 0);
    ctx.restore();

    const items = [
        data.pace ? { label: 'PACE', unit: 'min/km', value: data.pace } : null,
        data.heartRate ? { label: 'HR', unit: 'bpm', value: data.heartRate } : null,
        data.distance ? { label: 'DIST', unit: 'km', value: data.distance } : null,
        data.time ? { label: 'TIME', unit: '', value: data.time } : null,
    ].filter(Boolean) as Array<{ label: string; unit: string; value: string }>;
    if (items.length === 0) return;

    const contentX = sideTagW;
    const contentW = w - sideTagW;
    const colW = contentW / items.length;
    const labelSize = Math.max(7, Math.round(barH * 0.14 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(barH * 0.26 * tuning.textScale));
    const panelY = y + accentLineH;

    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const colX = contentX + colW * i;

        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colX, panelY + barH * 0.18);
            ctx.lineTo(colX, panelY + barH * 0.82);
            ctx.stroke();
        }

        const centerColX = colX + colW * 0.5;
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(item.label, centerColX, panelY + barH * 0.27);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(item.value, centerColX, panelY + barH * 0.66);
        if (item.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.font = `400 ${Math.max(7, Math.round(labelSize * 0.86))}px ${config.fontFamily}`;
            ctx.fillText(item.unit, centerColX, panelY + barH * 0.86);
        }
    }
}