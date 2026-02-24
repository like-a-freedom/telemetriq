import type { MetricItem } from '../overlayRenderer';
import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import {
    getResolutionTuning,
    applyTextShadow,
    getStableMetricValue,
} from '../overlayUtils';

export function renderClassicLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    const tuning = getResolutionTuning(w, h);
    const fontSize = Math.round(h * (config.fontSizePercent / 100) * tuning.textScale);
    const lineHeight = fontSize * (config.lineSpacing || 1.5);
    const padding = fontSize * 0.6 * tuning.spacingScale;
    const borderRadius = config.cornerRadius !== undefined
        ? Math.round(h * (config.cornerRadius / 100))
        : Math.round(h * 0.005);

    const lines = buildOverlayLines(metrics);
    if (lines.length === 0) return;

    const stableLines = buildStableOverlayLines(metrics);

    const fontFamily = config.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.font = `bold ${fontSize}px ${fontFamily}`;

    const maxWidth = calculateMaxLineWidth(ctx, stableLines);
    const bgWidth = maxWidth + padding * 2;
    const bgHeight = lines.length * lineHeight + padding * 2;

    const { x, y } = calculatePosition(config.position || 'bottom-left', w, h, bgWidth, bgHeight, fontSize);

    ctx.save();

    drawBackground(ctx, x, y, bgWidth, bgHeight, borderRadius, config);
    drawBorder(ctx, x, y, bgWidth, bgHeight, borderRadius, config);

    ctx.fillStyle = config.textColor || '#FFFFFF';
    applyTextShadow(ctx, config);
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i]!, x + padding, y + padding + i * lineHeight);
    }

    ctx.restore();
}

function calculateMaxLineWidth(ctx: OverlayContext2D, lines: string[]): number {
    let maxWidth = 0;
    for (const line of lines) {
        const m = ctx.measureText(line);
        if (m.width > maxWidth) maxWidth = m.width;
    }
    return maxWidth;
}

interface PositionResult {
    x: number;
    y: number;
}

function calculatePosition(
    position: string,
    w: number,
    h: number,
    bgWidth: number,
    bgHeight: number,
    margin: number,
): PositionResult {
    switch (position) {
        case 'top-left':
            return { x: margin, y: margin };
        case 'top-right':
            return { x: w - bgWidth - margin, y: margin };
        case 'bottom-left':
            return { x: margin, y: h - bgHeight - margin };
        case 'bottom-right':
        default:
            return { x: w - bgWidth - margin, y: h - bgHeight - margin };
    }
}

function drawBackground(
    ctx: OverlayContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    borderRadius: number,
    config: ExtendedOverlayConfig,
): void {
    if (!hasVisibleBackground(config)) return;

    if (config.gradientBackground && config.gradientStartColor && config.gradientEndColor) {
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, config.gradientStartColor);
        gradient.addColorStop(1, config.gradientEndColor);
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = config.backgroundColor || `rgba(0, 0, 0, ${config.backgroundOpacity})`;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, width, height, borderRadius);
    ctx.fill();
}

function drawBorder(
    ctx: OverlayContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    borderRadius: number,
    config: ExtendedOverlayConfig,
): void {
    if (!config.borderWidth || !config.borderColor) return;

    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = config.borderWidth;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, borderRadius);
    ctx.stroke();
}

function hasVisibleBackground(config: ExtendedOverlayConfig): boolean {
    const hasGradient = config.gradientBackground && !!config.gradientStartColor && !!config.gradientEndColor;
    const hasBackgroundColor = !!config.backgroundColor
        && config.backgroundColor !== 'transparent'
        && config.backgroundColor !== 'rgba(0, 0, 0, 0)';
    const hasOpacity = (config.backgroundOpacity || 0) > 0;

    return hasGradient || hasBackgroundColor || hasOpacity;
}

function buildOverlayLines(metrics: MetricItem[]): string[] {
    return metrics.map(m => {
        const icon = metricIcon(m.label);
        return `${icon} ${m.value} ${m.unit}`.trim();
    });
}

function buildStableOverlayLines(metrics: MetricItem[]): string[] {
    return metrics.map(m => {
        const icon = metricIcon(m.label);
        const stableValue = getStableMetricValue(m.label);
        return `${icon} ${stableValue} ${m.unit}`.trim();
    });
}

function metricIcon(label: string): string {
    switch (label.toLowerCase()) {
        case 'heart rate': return '❤️';
        case 'pace': return '🏃';
        case 'distance': return '📏';
        case 'time': return '⏱️';
        default: return '';
    }
}
