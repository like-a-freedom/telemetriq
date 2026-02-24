import type { ExtendedOverlayConfig } from '../core/types';

export type ResolutionTuning = {
    textScale: number;
    spacingScale: number;
    labelTrackingScale: number;
};

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function getResolutionTuning(width: number, height: number): ResolutionTuning {
    const shortSide = Math.min(width, height);
    const textScale = clamp(shortSide / 1080, 0.86, 1.18);
    const spacingScale = clamp(shortSide / 1080, 0.92, 1.1);
    const labelTrackingScale = shortSide < 900 ? 0.82 : 1;
    return {
        textScale,
        spacingScale,
        labelTrackingScale,
    };
}

export function fontWeightValue(weight: string): number {
    switch (weight) {
        case 'light': return 300;
        case 'normal': return 400;
        case 'bold': return 700;
        default: return 400;
    }
}

export type OverlayContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function applyTextShadow(ctx: OverlayContext2D, config: ExtendedOverlayConfig): void {
    if (config.textShadow && config.textShadowColor) {
        ctx.shadowColor = config.textShadowColor;
        ctx.shadowBlur = config.textShadowBlur || 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
}

export function drawTrackedText(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    letterSpacingEm: number,
    fontSize: number,
): void {
    const spacing = fontSize * letterSpacingEm;
    let curX = x;
    for (const char of text) {
        ctx.fillText(char, curX, y);
        curX += ctx.measureText(char).width + spacing;
    }
}

export function measureTrackedTextWidth(
    ctx: OverlayContext2D,
    text: string,
    letterSpacingEm: number,
    fontSize: number,
): number {
    if (!text) return 0;
    const spacing = fontSize * letterSpacingEm;
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        width += ctx.measureText(text[i]!).width;
        if (i < text.length - 1) width += spacing;
    }
    return width;
}

export function getMarginLabel(label: string): string {
    switch (label.toLowerCase()) {
        case 'heart rate': return 'HR';
        case 'distance': return 'DIST';
        default:
            return label.toUpperCase();
    }
}

/**
 * Returns a stable placeholder value for width/fit calculations.
 * Uses wide digits to avoid per-frame resize/jitter when real values change.
 */
export function getStableMetricValue(labelOrKey: string): string {
    switch (labelOrKey.toLowerCase()) {
        case 'pace':
            return '88:88';
        case 'heart rate':
        case 'heartrate':
        case 'heart':
        case 'hr':
            return '188';
        case 'distance':
        case 'dist':
            return '88.8';
        case 'time':
        case 'elapsed':
            return '88:88:88';
        default:
            return '888';
    }
}
