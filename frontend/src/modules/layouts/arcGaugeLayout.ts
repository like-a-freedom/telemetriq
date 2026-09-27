import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { fontWeightValue, getStableMetricValue } from '../overlayUtils';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';
import { parsePace, toStandardMetricItems, type MetricMap, type Orientation } from './shared';

export function drawArcGauge(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;
    const radius = Math.min(h * 0.22, Math.max(28,
        orientation.shortSide * (orientation.isPortrait ? 0.18 : 0.13)));
    const cx = w * 0.5;
    const cy = orientation.safePad + radius + orientation.compactPad;
    const stroke = Math.max(2, radius * 0.08);
    const textOutline = Math.max(1.2, orientation.shortSide * 0.003);
    const family = config.fontFamily || TRAIL_RUN_FONT_FAMILY;
    const accent = config.accentColor || '#00E676';
    const fontScale = Math.max(0.7, Math.min(1.4, (config.fontSizePercent || 2.2) / 2.2));
    const valueScale = Math.max(0.75, Math.min(1.3, (config.valueSizeMultiplier || 1.8) / 1.8));
    const labelScale = Math.max(0.75, Math.min(1.3, (config.labelSizeMultiplier || 0.55) / 0.55));
    const labelTracking = Number.isFinite(config.labelLetterSpacing)
        ? Math.max(0, Math.min(0.24, config.labelLetterSpacing!)) : 0.18;
    const valueWeight = arcGaugeValueWeight(config.valueFontWeight || 'normal');

    if (data.pace) {
        const pace = parsePace(data.pace);
        const progress = Number.isFinite(pace) ? Math.max(0, Math.min(1, (10 - pace) / 7)) : 0;
        const start = Math.PI;
        const trackEnd = start + Math.PI;
        const end = start + Math.PI * progress;

        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (config.textShadow) {
            ctx.strokeStyle = config.textShadowColor || 'rgba(0,0,0,0.7)';
            ctx.lineWidth = stroke + Math.max(0.8, stroke * 0.18) * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, start, trackEnd, false);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.24)';
        ctx.lineWidth = stroke;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, start, trackEnd, false);
        ctx.stroke();

        if (progress > 0) {
            ctx.strokeStyle = accent;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, start, end, false);
            ctx.stroke();
        }

        const paceBaseSize = Math.max(14, Math.round(radius * 0.58 * tuning.textScale * fontScale * valueScale));
        ctx.letterSpacing = '0px';
        ctx.font = `${valueWeight} ${paceBaseSize}px ${family}`;
        const paceWidth = Math.max(
            ctx.measureText(data.pace).width,
            ctx.measureText(getStableMetricValue('pace')).width,
        );
        const paceSize = paceBaseSize * Math.min(1, radius * 1.55 / Math.max(1, paceWidth), radius * 0.48 / paceBaseSize);
        const labelSize = Math.max(8, Math.round(radius * 0.15 * tuning.textScale * fontScale * labelScale));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const paceY = cy + radius * 0.08;
        const unitY = cy + radius * 0.72;
        drawArcText(ctx, data.pace, cx, paceY, `${valueWeight} ${paceSize}px ${family}`, config, textOutline);
        drawArcText(ctx, 'MIN / KM', cx, unitY, `500 ${labelSize}px ${family}`, config,
            textOutline, 0.82, labelSize * labelTracking);
        ctx.restore();
    }

    const sideValueSize = Math.max(14, Math.round(radius * 0.38 * tuning.textScale * fontScale * valueScale));
    const sideLabelSize = Math.max(9, Math.round(radius * 0.2 * tuning.textScale * fontScale * labelScale));
    const leftItems = toStandardMetricItems(
        data,
        {
            heartRate: { label: 'HR', unit: 'bpm' },
            distance: { label: 'DIST', unit: 'km' },
        },
        ['heartRate', 'distance'],
    );
    const leftX = orientation.safePad;
    const leftMaxWidth = Math.max(12, cx - radius - leftX - orientation.safePad * 0.7);
    const topY = orientation.isPortrait ? h * 0.42 : h * 0.34;
    const sideGap = Math.max(3, sideLabelSize * 0.22);
    const sideBlockHeight = sideLabelSize + sideGap + sideValueSize * 1.16 + sideLabelSize * 0.95;
    const sideStep = Math.max(sideValueSize * 2.5 * Math.max(0.9, config.lineSpacing || 1.1),
        sideBlockHeight + orientation.shortSide * 0.025);
    leftItems.forEach((item, index) => {
        drawSideMetric(ctx, item.label, item.value, item.unit ?? '', leftX,
            topY + index * sideStep, 'left', leftMaxWidth,
            sideLabelSize, sideValueSize, family, config, textOutline, labelTracking);
    });

    if (data.time) {
        const rightX = w - orientation.safePad;
        const rightMaxWidth = Math.max(12, rightX - (cx + radius + orientation.safePad * 0.7));
        const label = config.labelStyle === 'hidden' ? '' : 'ELAPSED';
        const elapsedValueSize = fitSize(ctx, data.time, 'time', family,
            sideValueSize, rightMaxWidth, valueWeight);
        const elapsedLabelSize = fitSize(ctx, label, label, family,
            sideLabelSize, rightMaxWidth, 600, labelTracking);
        const top = h - orientation.safePad - elapsedLabelSize - elapsedValueSize * 1.18;
        drawSideMetric(ctx, label, data.time, '', rightX, top, 'right', rightMaxWidth,
            elapsedLabelSize, elapsedValueSize, family, config, textOutline, labelTracking);
    }
}

function fitSize(
    ctx: OverlayContext2D,
    text: string,
    reservation: string,
    family: string,
    size: number,
    maxWidth: number,
    weight: number,
    letterSpacingEm = 0,
): number {
    ctx.letterSpacing = '0px';
    ctx.font = `${weight} ${size}px ${family}`;
    const trackedWidth = (value: string): number =>
        ctx.measureText(value).width + Math.max(0, value.length - 1) * size * letterSpacingEm;
    const width = Math.max(trackedWidth(text), trackedWidth(getStableMetricValue(reservation)));
    return size * Math.min(1, maxWidth / Math.max(1, width));
}

function drawSideMetric(
    ctx: OverlayContext2D,
    label: string,
    value: string,
    unit: string,
    x: number,
    y: number,
    align: 'left' | 'right',
    maxWidth: number,
    labelSize: number,
    valueSize: number,
    family: string,
    config: ExtendedOverlayConfig,
    textOutline: number,
    letterSpacingEm = 0,
): void {
    const labelText = config.labelStyle === 'hidden' ? '' : label.toUpperCase();
    const valueWeight = arcGaugeValueWeight(config.valueFontWeight || 'normal');
    const fittedLabelSize = labelText ? fitSize(ctx, labelText, labelText, family, labelSize, maxWidth, 600,
        letterSpacingEm) : 0;
    const fittedValueSize = fitSize(ctx, value, labelText, family, valueSize, maxWidth, valueWeight);
    const unitSize = unit ? fitSize(ctx, unit, unit, family, labelSize * 0.95, maxWidth, 500) : 0;
    const gap = labelText ? Math.max(3, labelSize * 0.22) : 0;

    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.strokeStyle = config.textShadowColor || 'rgba(0,0,0,0.7)';
    ctx.lineWidth = textOutline;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.82;
    ctx.font = `600 ${fittedLabelSize}px ${family}`;
    ctx.letterSpacing = `${fittedLabelSize * letterSpacingEm}px`;
    if (labelText) {
        if (config.textShadow) ctx.strokeText(labelText, x, y);
        ctx.fillText(labelText, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.letterSpacing = '0px';
    ctx.font = `${valueWeight} ${fittedValueSize}px ${family}`;
    if (config.textShadow) ctx.strokeText(value, x, y + fittedLabelSize + gap);
    ctx.fillText(value, x, y + fittedLabelSize + gap);
    if (unit) {
        ctx.globalAlpha = 0.82;
        ctx.font = `500 ${unitSize}px ${family}`;
        if (config.textShadow) ctx.strokeText(unit, x, y + fittedLabelSize + gap + fittedValueSize * 1.16);
        ctx.fillText(unit, x, y + fittedLabelSize + gap + fittedValueSize * 1.16);
    }
    ctx.restore();
}

function drawArcText(
    ctx: OverlayContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    config: ExtendedOverlayConfig,
    textOutline: number,
    opacity = 1,
    letterSpacingPx = 0,
): void {
    ctx.font = font;
    ctx.letterSpacing = `${letterSpacingPx}px`;
    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.strokeStyle = config.textShadowColor || 'rgba(0,0,0,0.7)';
    ctx.lineWidth = textOutline;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;
    if (config.textShadow) ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
}

function arcGaugeValueWeight(weight: string): number {
    if (weight === 'light') return 300;
    if (weight === 'bold') return fontWeightValue(weight);
    return 500;
}
