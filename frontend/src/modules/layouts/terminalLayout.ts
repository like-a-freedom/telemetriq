import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type Orientation } from './shared';

export function drawTerminal(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    _h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const rows = toStandardMetricItems(
        data,
        {
            pace: { label: 'PACE', unit: 'min/km' },
            heartRate: { label: 'hr', unit: 'bpm' },
            distance: { label: 'dist', unit: 'km' },
            time: { label: 'time', unit: '' },
        },
        ['pace', 'heartRate', 'distance', 'time'],
    );
    if (rows.length === 0) return;

    const textSize = Math.max(10, Math.round(orientation.shortSide * 0.025 * tuning.textScale));
    const headerSize = Math.max(8, Math.round(textSize * 0.74));
    const lineH = textSize * 1.6;
    const innerPad = textSize * 0.9;
    const boxW = Math.round(w * (orientation.isPortrait ? 0.52 : 0.36));
    const boxH = lineH * rows.length + innerPad * 2 + headerSize * 1.6;
    const boxX = orientation.safePad;
    const boxY = orientation.safePad;
    const radius = Math.max(3, textSize * 0.4);

    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(34,197,94,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const green = config.textColor || '#86efac';
    const greenDim = 'rgba(74,222,128,0.5)';
    const greenFaint = 'rgba(34,197,94,0.3)';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = 'rgba(74,222,128,0.45)';
    ctx.font = `500 ${headerSize}px ${config.fontFamily}`;
    ctx.fillText('// GPX TELEMETRY', boxX + innerPad, boxY + innerPad + headerSize);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const rowY = boxY + innerPad + headerSize * 1.6 + (i + 0.85) * lineH;

        ctx.fillStyle = greenFaint;
        ctx.font = `500 ${textSize}px ${config.fontFamily}`;
        ctx.fillText('›', boxX + innerPad, rowY);

        const promptW = ctx.measureText('› ').width;
        ctx.fillStyle = greenDim;
        ctx.font = `400 ${textSize}px ${config.fontFamily}`;
        ctx.fillText(row.label, boxX + innerPad + promptW, rowY);

        const promptKeyW = ctx.measureText(row.label + ' ').width;
        ctx.fillStyle = greenFaint;
        ctx.fillText('=', boxX + innerPad + promptW + promptKeyW, rowY);

        const eqW = ctx.measureText('= ').width;
        ctx.fillStyle = green;
        ctx.font = `500 ${textSize}px ${config.fontFamily}`;
        ctx.fillText(row.value, boxX + innerPad + promptW + promptKeyW + eqW, rowY);

        if (row.unit) {
            const valW = ctx.measureText(row.value + ' ').width;
            ctx.fillStyle = 'rgba(34,197,94,0.32)';
            ctx.font = `400 ${Math.max(8, Math.round(textSize * 0.78))}px ${config.fontFamily}`;
            ctx.fillText(row.unit, boxX + innerPad + promptW + promptKeyW + eqW + valW, rowY);
        }
    }

    const cursorY = boxY + innerPad + headerSize * 1.6 + rows.length * lineH + lineH * 0.55;
    ctx.fillStyle = 'rgba(34,197,94,0.22)';
    ctx.font = `400 ${textSize}px ${config.fontFamily}`;
    ctx.fillText('_', boxX + innerPad, cursorY);
}