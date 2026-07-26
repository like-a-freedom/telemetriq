import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { getStableMetricValue } from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type MetricItemSpec, type Orientation } from './shared';

const STABLE_KEY: Record<MetricItemSpec['key'], string> = {
    pace: 'pace',
    heartRate: 'heart rate',
    distance: 'distance',
    time: 'time',
};

function tickerParts(items: MetricItemSpec[], stable: (key: MetricItemSpec['key']) => string): string[] {
    return items.map((item) => {
        const head = `${item.label} ${stable(item.key)}`;
        return item.unit ? `${head} ${item.unit}` : head;
    });
}

export function drawTickerTape(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const barH = Math.max(24, Math.round(h * (orientation.isPortrait ? 0.052 : 0.046)));
    const y = h - barH;
    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(0, y, w, barH);

    const baseTextSize = Math.max(9, Math.round(barH * 0.36 * tuning.textScale));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = config.accentColor || '#ef4444';
    let textSize = baseTextSize;
    ctx.font = `700 ${Math.max(8, Math.round(textSize * 0.92))}px ${config.fontFamily}`;
    ctx.fillText('LIVE', orientation.safePad, y + barH / 2);

    const items = toStandardMetricItems(
        data,
        {
            pace: { label: 'PACE', unit: 'min/km' },
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DIST', unit: 'km' },
            time: { label: 'TIME', unit: '' },
        },
    );
    if (items.length === 0) return;

    const content = tickerParts(items, (key) => data[key] ?? '').join('  |  ');
    const worstCaseContent = tickerParts(items, (key) => getStableMetricValue(STABLE_KEY[key])).join('  |  ');
    const contentX = orientation.safePad + textSize * 4.4;
    const maxContentWidth = w - contentX - orientation.safePad;

    while (textSize > 7) {
        ctx.font = `500 ${textSize}px ${config.fontFamily}`;
        if (ctx.measureText(worstCaseContent).width <= maxContentWidth) break;
        textSize -= 1;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.84)';
    ctx.font = `500 ${textSize}px ${config.fontFamily}`;
    ctx.fillText(content, contentX, y + barH / 2);
}