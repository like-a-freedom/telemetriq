import type { MetricItem } from '../../core/types';
import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { fontWeightValue, getStableMetricValue } from '../overlayUtils';

export type MetricMap = {
    pace?: string;
    heartRate?: string;
    distance?: string;
    time?: string;
};

export type Orientation = {
    isPortrait: boolean;
    shortSide: number;
    longSide: number;
    safePad: number;
    compactPad: number;
};

export function toMetricMap(metrics: MetricItem[]): MetricMap {
    const find = (label: string): string | undefined =>
        metrics.find((m) => m.label.toLowerCase() === label.toLowerCase())?.value;
    return {
        pace: find('Pace'),
        heartRate: find('Heart Rate'),
        distance: find('Distance'),
        time: find('Time'),
    };
}

export function parsePace(pace?: string): number {
    if (!pace) return 6;
    const [m = Number.NaN, s = Number.NaN] = pace.split(':').map(Number);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return 6;
    return m + s / 60;
}

export function getOrientation(w: number, h: number): Orientation {
    const isPortrait = h > w;
    const shortSide = Math.min(w, h);
    const longSide = Math.max(w, h);
    return {
        isPortrait,
        shortSide,
        longSide,
        safePad: shortSide * (isPortrait ? 0.04 : 0.03),
        compactPad: shortSide * (isPortrait ? 0.02 : 0.015),
    };
}

export function drawMetricBlock(
    ctx: OverlayContext2D,
    x: number,
    y: number,
    label: string,
    value: string,
    unit: string,
    labelSize: number,
    valueSize: number,
    config: ExtendedOverlayConfig,
    align: 'left' | 'right',
): void {
    ctx.textAlign = align;
    ctx.fillStyle = `rgba(255,255,255,${label === 'HEART RATE' ? 0.62 : 0.5})`;
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(label, x, y);
    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.font = `${fontWeightValue(config.valueFontWeight || 'light')} ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(value, x, y + valueSize * 0.95);
    if (unit) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `400 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
        ctx.fillText(unit, x, y + valueSize * 1.45);
    }
}

export function condensedStripStableValue(label: string): string {
    switch (label.toUpperCase()) {
        case 'PACE':
            return `${getStableMetricValue('pace')} min/km`;
        case 'HR':
            return `${getStableMetricValue('heart rate')} bpm`;
        case 'DIST':
            return `${getStableMetricValue('distance')} km`;
        case 'TIME':
            return getStableMetricValue('time');
        default:
            return `${getStableMetricValue(label)} ${label}`;
    }
}

export type { OverlayContext2D, ExtendedOverlayConfig };