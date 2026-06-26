import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawDataBlock(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const accent = config.accentColor || '#f97316';
    const rows = [
        data.pace ? { label: 'PACE', unit: 'min/km', value: data.pace, big: false } : null,
        data.distance ? { label: 'DIST', unit: 'km', value: data.distance, big: false } : null,
        data.heartRate ? { label: 'HR', unit: 'bpm', value: data.heartRate, big: true } : null,
    ].filter(Boolean) as Array<{ label: string; unit: string; value: string; big: boolean }>;
    if (rows.length === 0) return;

    const normalValSize = Math.max(16, Math.round(orientation.shortSide * 0.05 * tuning.textScale));
    const bigValSize = Math.max(30, Math.round(orientation.shortSide * 0.1 * tuning.textScale));
    const lblSize = Math.max(7, Math.round(normalValSize * 0.36));
    const rowH = normalValSize * 1.7;
    const bigRowH = bigValSize * 1.3;

    let totalH = 0;
    for (const row of rows) {
        totalH += row.big ? bigRowH : rowH;
    }
    const gap = lblSize;
    let curY = h - orientation.safePad - totalH - gap;

    const rightX = w - orientation.safePad;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';

    for (const row of rows) {
        const vs = row.big ? bigValSize : normalValSize;
        const rh = row.big ? bigRowH : rowH;

        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(row.label, orientation.safePad, curY + rh * 0.28);

        if (row.unit) {
            ctx.fillStyle = accent;
            ctx.font = `400 ${Math.max(7, Math.round(lblSize * 0.95))}px ${config.fontFamily}`;
            ctx.fillText(row.unit, orientation.safePad, curY + rh * 0.52);
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${vs}px ${config.fontFamily}`;
        ctx.fillText(row.value, rightX, curY + rh * 0.68);

        curY += rh;
    }
}