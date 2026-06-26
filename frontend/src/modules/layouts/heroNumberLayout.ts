import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { type MetricMap, type Orientation } from './shared';

export function drawHeroNumber(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const heroSize = Math.round(orientation.shortSide * (orientation.isPortrait ? 0.23 : 0.18) * tuning.textScale);
    const unitSize = Math.max(12, Math.round(heroSize * 0.2));

    if (data.pace) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `900 ${heroSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, w * 0.5, h * (orientation.isPortrait ? 0.35 : 0.31));
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `600 ${unitSize}px ${config.fontFamily}`;
        ctx.fillText('MIN/KM', w * 0.5, h * (orientation.isPortrait ? 0.4 : 0.36));
    }

    const rowY = h - orientation.safePad;
    const cols = [
        data.heartRate ? `♥ ${data.heartRate} bpm` : null,
        data.distance ? `↗ ${data.distance} km` : null,
        data.time ? `◷ ${data.time}` : null,
    ].filter(Boolean) as string[];
    if (cols.length === 0) return;
    const step = w / (cols.length + 1);
    ctx.font = `400 ${Math.max(11, Math.round(unitSize * 0.95))}px ${config.fontFamily}`;
    for (let i = 0; i < cols.length; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillText(cols[i]!, step * (i + 1), rowY);
    }
}