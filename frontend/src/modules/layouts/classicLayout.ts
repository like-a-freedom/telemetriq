import type { MetricItem } from '../../core/types';
import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { clamp, getResolutionTuning, getStableMetricValue } from '../overlayUtils';

export function renderClassicLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
): void {
    if (!metrics.length || w <= 0 || h <= 0) return;

    const tuning = getResolutionTuning(w, h);
    const fontSizePercent = clamp(Number.isFinite(config.fontSizePercent) ? config.fontSizePercent : 3.5, 0.5, 10);
    const valueSizeMultiplier = clamp(Number.isFinite(config.valueSizeMultiplier) ? config.valueSizeMultiplier : 2.5, 0.5, 5);
    let fontSize = Math.max(12,
        Math.min(w, h) * (fontSizePercent / 100) * tuning.textScale * (valueSizeMultiplier / 2.5));
    // Keep enough physical room for the font's ink and optional shadow. Smaller
    // values let adjacent rows overlap even when their baselines are distinct.
    const spacing = Math.max(1.25, clamp(Number.isFinite(config.lineSpacing) ? config.lineSpacing : 1.5, 0.8, 2.4));
    const borderRadius = config.cornerRadius !== undefined
        ? Math.round(h * (config.cornerRadius / 100))
        : Math.round(h * 0.005);

    const classicLabels = config.templateId === 'classic';
    const plainLabels = classicLabels && config.labelStyle !== 'hidden';
    const hideLabels = classicLabels && config.labelStyle === 'hidden';
    let lines = buildOverlayLines(metrics, plainLabels, hideLabels);
    if (lines.length === 0) return;

    let stableLines = buildStableOverlayLines(metrics, plainLabels, hideLabels);
    if (config.layout === 'horizontal') {
        lines = [lines.join('   ·   ')];
        stableLines = [stableLines.join('   ·   ')];
    }

    const fontFamily = config.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const fontWeight = config.valueFontWeight === 'bold' ? 600 : 500;
    ctx.save();
    ctx.letterSpacing = '0px';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.textAlign = 'left';
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    const textLines = [...stableLines, ...lines];
    const measuredWidth = calculateMaxLineWidth(ctx, textLines);
    const margin = Math.min(w, h) * 0.04 + Math.max(0, config.borderWidth || 0) / 2;
    const availableWidth = Math.max(1, w - margin * 2);
    const fit = Math.min(1, availableWidth / (measuredWidth + fontSize * 1.2),
        (h - margin * 2) / (fontSize * (lines.length * spacing + 1.2)));
    fontSize *= Math.max(0.01, fit);

    // Canvas font metrics are not perfectly linear across fractional font sizes
    // on every platform. Remeasure at the actual draw size so narrow frames do
    // not clip long horizontal rows on Linux.
    for (let attempt = 0; attempt < 8; attempt++) {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const currentWidth = calculateMaxLineWidth(ctx, textLines);
        const requiredWidth = currentWidth + fontSize * 1.2;
        if (requiredWidth <= availableWidth) break;

        const correction = (availableWidth / requiredWidth) * 0.98;
        fontSize *= Math.max(0.01, Math.min(0.98, correction));
    }
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const maxWidth = calculateMaxLineWidth(ctx, textLines);

    const lineHeight = fontSize * spacing;
    const padding = fontSize * 0.6;
    const bgWidth = maxWidth + padding * 2;
    const bgHeight = lines.length * lineHeight + padding * 2;

    const { x, y } = calculatePosition(config.position || 'bottom-left', w, h, bgWidth, bgHeight, margin);

    drawBackground(ctx, x, y, bgWidth, bgHeight, borderRadius, config);
    drawBorder(ctx, x, y, bgWidth, bgHeight, borderRadius, config);

    ctx.fillStyle = config.textColor || '#FFFFFF';
    if (config.textShadow && config.textShadowColor) {
        ctx.shadowColor = config.textShadowColor;
        ctx.shadowBlur = clamp(config.textShadowBlur || 2, 1, 8);
        ctx.shadowOffsetY = Math.max(1, fontSize * 0.035);
    }
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
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
    if (!hasVisibleBackground(config) || config.backgroundOpacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, config.backgroundOpacity));

    if (config.gradientBackground && config.gradientStartColor && config.gradientEndColor) {
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, config.gradientStartColor);
        gradient.addColorStop(1, config.gradientEndColor);
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = !config.backgroundColor || config.backgroundColor === 'transparent' ? '#000000' : config.backgroundColor;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, width, height, borderRadius);
    ctx.fill();
    ctx.restore();
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

function buildOverlayLines(metrics: MetricItem[], plainLabels = false, hideLabels = false): string[] {
    return metrics.map(m => {
        if (hideLabels) return `${m.value} ${m.unit}`.trim();
        const icon = plainLabels ? `${m.label.toUpperCase()}  ` : metricIcon(m.label);
        return `${icon} ${m.value} ${m.unit}`.trim();
    });
}

function buildStableOverlayLines(metrics: MetricItem[], plainLabels = false, hideLabels = false): string[] {
    return metrics.map(m => {
        if (hideLabels) return `${getStableMetricValue(m.label)} ${m.unit}`.trim();
        const icon = plainLabels ? `${m.label.toUpperCase()}  ` : metricIcon(m.label);
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
