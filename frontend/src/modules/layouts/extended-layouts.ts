import type { MetricItem } from '../overlay-renderer';
import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlay-utils';
import { applyTextShadow, fontWeightValue, getResolutionTuning, getStableMetricValue } from '../overlay-utils';

type MetricMap = {
    pace?: string;
    heartRate?: string;
    distance?: string;
    time?: string;
};

type Orientation = {
    isPortrait: boolean;
    shortSide: number;
    longSide: number;
    safePad: number;
    compactPad: number;
};

export function renderExtendedLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    layoutMode: string,
): void {
    const data = toMetricMap(metrics);
    const orientation = getOrientation(w, h);
    const tuning = getResolutionTuning(w, h);

    ctx.save();
    applyTextShadow(ctx, config);

    switch (layoutMode) {
        case 'arc-gauge':
            drawArcGauge(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'hero-number':
            drawHeroNumber(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'cinematic-bar':
            drawCinematicBar(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'editorial':
            drawEditorial(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'ticker-tape':
            drawTickerTape(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'whisper':
            drawWhisper(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'two-tone':
            drawTwoTone(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'condensed-strip':
            drawCondensedStrip(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'soft-rounded':
            drawSoftRounded(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'thin-line':
            drawThinLine(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'swiss-grid':
            drawSwissGrid(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'garmin-style':
            drawGarminStyle(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'sports-broadcast':
            drawSportsBroadcast(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'cockpit-hud':
            drawCockpitHud(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'terminal':
            drawTerminal(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'night-runner':
            drawNightRunner(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'data-block':
            drawDataBlock(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'race-tag':
            drawRaceTag(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'glass-panel':
            drawGlassPanel(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'minimal-ring':
            drawMinimalRing(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'stretched-bar':
            drawStretchedBar(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'focus-type':
            drawFocusType(ctx, data, w, h, config, orientation, tuning);
            break;
        default:
            break;
    }

    ctx.restore();
}

function drawArcGauge(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const paceNumber = parsePace(data.pace);
    const progress = Math.max(0, Math.min(1, (10 - paceNumber) / 7));
    const radius = orientation.shortSide * (orientation.isPortrait ? 0.18 : 0.13);
    const cx = w * 0.5;
    const cy = orientation.safePad + radius + orientation.compactPad;
    const start = Math.PI;
    const end = start + Math.PI * progress;
    const stroke = Math.max(2, radius * 0.08);

    if (data.pace) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = stroke;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, Math.PI, 0, false);
        ctx.stroke();

        ctx.strokeStyle = config.accentColor || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, start, end, false);
        ctx.stroke();

        const dotX = cx + Math.cos(end) * radius;
        const dotY = cy + Math.sin(end) * radius;
        ctx.fillStyle = config.accentColor || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(dotX, dotY, Math.max(3, stroke * 1.2), 0, Math.PI * 2);
        ctx.fill();

        const paceSize = Math.max(20, Math.round(radius * 0.58 * tuning.textScale));
        const labelSize = Math.max(8, Math.round(radius * 0.14 * tuning.textScale));
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `300 ${paceSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, cx, cy + radius * 0.35);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText('MIN / KM', cx, cy + radius * 0.58);
    }

    const sideValueSize = Math.max(16, Math.round(radius * 0.38));
    const sideLabelSize = Math.max(9, Math.round(radius * 0.18));
    const leftX = orientation.safePad;
    const topY = orientation.isPortrait ? h * 0.42 : h * 0.34;
    const leftItems = [
        data.heartRate ? { label: 'HR', value: data.heartRate, unit: 'bpm' } : null,
        data.distance ? { label: 'DIST', value: data.distance, unit: 'km' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;
    leftItems.forEach((item, idx) => {
        drawMetricBlock(
            ctx,
            leftX,
            topY + idx * sideValueSize * 2.5,
            item.label,
            item.value,
            item.unit,
            sideLabelSize,
            sideValueSize,
            config,
            'left',
        );
    });

    if (data.time) {
        drawMetricBlock(ctx, w - orientation.safePad, h - orientation.safePad - sideValueSize * 1.4, 'ELAPSED', data.time, '', sideLabelSize, sideValueSize, config, 'right');
    }
}

function drawHeroNumber(
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

function drawCinematicBar(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const topBar = Math.round(h * (orientation.isPortrait ? 0.075 : 0.06));
    const bottomBar = Math.round(h * (orientation.isPortrait ? 0.1 : 0.085));
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, w, topBar);
    ctx.fillRect(0, h - bottomBar, w, bottomBar);

    const items = [
        data.pace ? ['PACE', `${data.pace} min/km`] : null,
        data.heartRate ? ['HR', `${data.heartRate} bpm`] : null,
        data.distance ? ['DIST', `${data.distance} km`] : null,
        data.time ? ['TIME', data.time] : null,
    ].filter(Boolean) as Array<[string, string]>;
    if (items.length === 0) return;
    const labelSize = Math.max(9, Math.round(orientation.shortSide * 0.018 * tuning.textScale));
    const valueSize = Math.max(14, Math.round(orientation.shortSide * 0.030 * tuning.textScale));
    const segmentW = (w - orientation.safePad * 2) / items.length;
    for (let i = 0; i < items.length; i++) {
        const x = orientation.safePad + segmentW * i + segmentW * 0.5;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, x, h - bottomBar * 0.62);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, x, h - bottomBar * 0.28);
        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.16)';
            ctx.beginPath();
            ctx.moveTo(orientation.safePad + segmentW * i, h - bottomBar * 0.72);
            ctx.lineTo(orientation.safePad + segmentW * i, h - bottomBar * 0.18);
            ctx.stroke();
        }
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
    ctx.fillText('REC ●', orientation.safePad, topBar * 0.63);
    ctx.textAlign = 'right';
    ctx.fillText('GPX TELEMETRY', w - orientation.safePad, topBar * 0.63);
}

function drawEditorial(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const heroSize = Math.max(34, Math.round(orientation.shortSide * 0.15 * tuning.textScale));
    const labelSize = Math.max(8, Math.round(heroSize * 0.14));
    const smallValue = Math.max(13, Math.round(heroSize * 0.32));

    const leftX = orientation.safePad;
    const baselineY = h - orientation.safePad - heroSize * 0.15;
    if (data.pace) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${labelSize}px Inter, sans-serif`;
        ctx.fillText('PACE', leftX, baselineY - heroSize * 1.05);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${heroSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, leftX, baselineY);
        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.font = `400 ${Math.max(10, Math.round(labelSize * 1.05))}px Inter, sans-serif`;
        ctx.fillText('min/km', leftX, baselineY + Math.max(12, Math.round(heroSize * 0.24)));
    }

    const rightX = w - orientation.safePad;
    const topY = orientation.safePad + smallValue;
    const lines = [
        data.heartRate ? ['HEART RATE', `${data.heartRate} bpm`] : null,
        data.distance ? ['DISTANCE', `${data.distance} km`] : null,
        data.time ? ['ELAPSED', data.time] : null,
    ].filter(Boolean) as Array<[string, string]>;
    for (let i = 0; i < lines.length; i++) {
        const y = topY + i * smallValue * 3.0;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.85))}px Inter, sans-serif`;
        ctx.fillText(lines[i]![0]!, rightX, y - smallValue * 1.2);
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = `400 ${smallValue}px ${config.fontFamily}`;
        ctx.fillText(lines[i]![1]!, rightX, y);
    }
}

function drawTickerTape(
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

    const parts = [
        data.pace ? `PACE ${data.pace} min/km` : null,
        data.heartRate ? `HR ${data.heartRate} bpm` : null,
        data.distance ? `DIST ${data.distance} km` : null,
        data.time ? `TIME ${data.time}` : null,
    ].filter(Boolean) as string[];
    if (parts.length === 0) return;

    const content = parts.join('  |  ');
    const worstCaseContent = [
        data.pace ? `PACE ${getStableMetricValue('pace')} min/km` : null,
        data.heartRate ? `HR ${getStableMetricValue('heart rate')} bpm` : null,
        data.distance ? `DIST ${getStableMetricValue('distance')} km` : null,
        data.time ? `TIME ${getStableMetricValue('time')}` : null,
    ].filter(Boolean).join('  |  ');
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

function drawWhisper(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const rows = [
        data.pace ? { label: 'PACE', value: `${data.pace} min/km` } : null,
        data.heartRate ? { label: 'HEART RATE', value: `${data.heartRate} bpm` } : null,
        data.distance ? { label: 'DISTANCE', value: `${data.distance} km` } : null,
        data.time ? { label: 'TIME', value: data.time } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    if (rows.length === 0) return;

    const textSize = Math.max(9, Math.round(orientation.shortSide * 0.019 * tuning.textScale));
    const labelSize = Math.max(8, Math.round(textSize * 0.82));
    const lineH = textSize * 3.0;
    const x = w - orientation.safePad;
    const y = h - orientation.safePad - lineH * rows.length;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    rows.forEach((row, idx) => {
        const yy = y + idx * lineH;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(row.label, x, yy);

        ctx.fillStyle = config.textColor || 'rgba(255,255,255,0.90)';
        ctx.font = `300 ${textSize}px ${config.fontFamily}`;
        ctx.fillText(row.value, x, yy + labelSize + Math.max(2, textSize * 0.25));
    });
}

function drawTwoTone(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const heroSize = Math.max(34, Math.round(orientation.shortSide * (orientation.isPortrait ? 0.2 : 0.15) * tuning.textScale));
    const leftX = orientation.safePad;
    const bottomY = h - orientation.safePad;
    if (data.pace) {
        ctx.textAlign = 'left';
        ctx.fillStyle = config.accentColor || '#c8ff00';
        ctx.font = `800 ${heroSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, leftX, bottomY - heroSize * 0.35);
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.font = `500 ${Math.max(10, Math.round(heroSize * 0.16))}px ${config.fontFamily}`;
        ctx.fillText('MIN/KM', leftX, bottomY);
    }

    const rightX = w - orientation.safePad;
    const valSize = Math.max(14, Math.round(heroSize * 0.35));
    const lblSize = Math.max(8, Math.round(valSize * 0.35));
    const rows = [
        data.heartRate ? ['HEART RATE', `${data.heartRate} bpm`] : null,
        data.distance ? ['DISTANCE', `${data.distance} km`] : null,
        data.time ? ['TIME', data.time] : null,
    ].filter(Boolean) as Array<[string, string]>;
    if (rows.length === 0) return;
    const rowH = valSize * 1.35 + lblSize * 1.15;
    const startY = bottomY - rowH * rows.length;
    ctx.textBaseline = 'top';
    for (let i = 0; i < rows.length; i++) {
        const y = startY + i * rowH;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(rows[i]![0]!, rightX, y);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(rows[i]![1]!, rightX, y + lblSize + Math.max(2, valSize * 0.16));
    }
}

function drawCondensedStrip(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const barH = Math.max(24, Math.round(h * (orientation.isPortrait ? 0.06 : 0.05)));
    const y = h - barH;
    ctx.fillStyle = config.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, y, w, barH);
    const items = [
        data.pace ? ['PACE', `${data.pace} min/km`] : null,
        data.heartRate ? ['HR', `${data.heartRate} bpm`] : null,
        data.distance ? ['DIST', `${data.distance} km`] : null,
        data.time ? ['TIME', data.time] : null,
    ].filter(Boolean) as Array<[string, string]>;
    if (items.length === 0) return;
    const segW = w / items.length;
    const labelSize = Math.max(8, Math.round(barH * 0.18 * tuning.textScale));
    const baseValueSize = Math.max(9, Math.round(barH * 0.48 * tuning.textScale));

    let valueSize = baseValueSize;
    while (valueSize > 8) {
        let allFit = true;
        ctx.font = `700 ${valueSize}px ${config.fontFamily}`;
        for (const item of items) {
            const stableValue = condensedStripStableValue(item[0]);
            if (ctx.measureText(stableValue).width > segW * 0.9) {
                allFit = false;
                break;
            }
        }
        if (allFit) break;
        valueSize -= 1;
    }

    for (let i = 0; i < items.length; i++) {
        const x = segW * i + segW * 0.5;
        if (i > 0) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();
            ctx.moveTo(segW * i, y + 2);
            ctx.lineTo(segW * i, y + barH - 2);
            ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.font = `400 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, x, y + barH * 0.32);
        ctx.fillStyle = '#111111';
        ctx.font = `700 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, x, y + barH * 0.82);
    }
}

function condensedStripStableValue(label: string): string {
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

function drawSoftRounded(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const items = [
        data.pace ? ['Pace', data.pace, 'min/km'] : null,
        data.heartRate ? ['HR', data.heartRate, 'bpm'] : null,
        data.distance ? ['Dist', data.distance, 'km'] : null,
        data.time ? ['Time', data.time, ''] : null,
    ].filter(Boolean) as Array<[string, string, string]>;
    if (items.length === 0) return;
    const gap = orientation.shortSide * 0.01;
    const cardH = h * (orientation.isPortrait ? 0.09 : 0.12);
    const totalW = w - orientation.safePad * 2;
    const cardW = (totalW - gap * (items.length - 1)) / items.length;
    const y = h - orientation.safePad - cardH;
    const radius = Math.max(8, cardH * 0.24);
    const labelSize = Math.max(8, Math.round(cardH * 0.16 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(cardH * 0.33 * tuning.textScale));

    for (let i = 0; i < items.length; i++) {
        const x = orientation.safePad + i * (cardW + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, radius);
        ctx.fill();

        const textColor = 'rgba(24,24,27,0.92)';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(24,24,27,0.45)';
        ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, x + cardW / 2, y + cardH * 0.28);

        ctx.fillStyle = textColor;
        ctx.font = `600 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, x + cardW / 2, y + cardH * 0.64);

        if (items[i]![2]) {
            ctx.fillStyle = 'rgba(24,24,27,0.35)';
            ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
            ctx.fillText(items[i]![2]!, x + cardW / 2, y + cardH * 0.86);
        }
    }
}

function drawThinLine(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const lineY = h - orientation.safePad - orientation.shortSide * 0.022;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(orientation.safePad, lineY);
    ctx.lineTo(w - orientation.safePad, lineY);
    ctx.stroke();

    const parts = [
        data.pace ? `${data.pace} min/km` : null,
        data.heartRate ? `${data.heartRate} bpm` : null,
        data.distance ? `${data.distance} km` : null,
        data.time ? data.time : null,
    ].filter(Boolean) as string[];
    if (parts.length === 0) return;
    const text = parts.join('   ~   ');
    ctx.textAlign = 'center';
    ctx.fillStyle = config.textColor || 'rgba(255,255,255,0.8)';
    ctx.font = `300 ${Math.max(10, Math.round(orientation.shortSide * 0.02 * tuning.textScale))}px ${config.fontFamily}`;
    ctx.fillText(text, w * 0.5, lineY + orientation.shortSide * 0.03);
}

function drawSwissGrid(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const barH = Math.round(h * (orientation.isPortrait ? 0.17 : 0.2));
    const y = h - barH;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, y, w, barH);
    const items = [
        data.pace ? ['PACE', data.pace, 'min/km'] : null,
        data.heartRate ? ['HEART RATE', data.heartRate, 'bpm'] : null,
        data.distance ? ['DISTANCE', data.distance, 'km'] : null,
        data.time ? ['TIME', data.time, ''] : null,
    ].filter(Boolean) as Array<[string, string, string]>;
    if (items.length === 0) return;
    const sidePad = orientation.safePad;
    const contentX = sidePad;
    const contentW = w - sidePad * 2;
    const colW = contentW / items.length;
    const labelSize = Math.max(8, Math.round(barH * 0.10 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(barH * 0.20 * tuning.textScale));
    const unitSize = Math.max(8, Math.round(labelSize * 0.9));

    for (let i = 0; i < items.length; i++) {
        const colX = contentX + colW * i;
        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.moveTo(colX, y + barH * 0.12);
            ctx.lineTo(colX, y + barH * 0.88);
            ctx.stroke();
        }

        // Center-align all text within the column
        const centerX = colX + colW / 2;
        ctx.textAlign = 'center';

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, centerX, y + barH * 0.27);

        // Value
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, centerX, y + barH * 0.58);

        // Unit
        if (items[i]![2]) {
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.font = `400 ${unitSize}px ${config.fontFamily}`;
            ctx.fillText(items[i]![2]!, centerX, y + barH * 0.76);
        }
    }
}

// ─── Template 27: Garmin Style ───────────────────────────────────────────────
function drawGarminStyle(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const accent = config.accentColor || '#f97316';
    const gaugeR = Math.round(orientation.shortSide * (orientation.isPortrait ? 0.14 : 0.1));
    const cx = orientation.safePad + gaugeR + gaugeR * 0.15;
    const cy = h - orientation.safePad - gaugeR - gaugeR * 0.15;
    const strokeW = Math.max(3, gaugeR * 0.1);

    // Background circle
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.arc(cx, cy, gaugeR, 0, Math.PI * 2);
    ctx.stroke();

    // HR arc
    if (data.heartRate) {
        const hrVal = parseInt(data.heartRate, 10);
        const hrPercent = Math.min(1, hrVal / 200);
        const startA = 2.44; // ~140 deg in radians
        const sweepA = 4.54; // ~260 deg sweep
        const endA = startA + sweepA * hrPercent;
        ctx.strokeStyle = accent;
        ctx.lineWidth = strokeW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, gaugeR, startA, endA, false);
        ctx.stroke();

        // Dot at end
        const dotX = cx + Math.cos(endA) * gaugeR;
        const dotY = cy + Math.sin(endA) * gaugeR;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(dotX, dotY, Math.max(3, strokeW * 1.2), 0, Math.PI * 2);
        ctx.fill();

        // HR value inside circle
        const hrValSize = Math.max(12, Math.round(gaugeR * 0.5 * tuning.textScale));
        const hrUnitSize = Math.max(8, Math.round(gaugeR * 0.16 * tuning.textScale));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${hrValSize}px ${config.fontFamily}`;
        ctx.fillText(data.heartRate, cx, cy + hrValSize * 0.35);
        ctx.fillStyle = accent;
        ctx.font = `500 ${hrUnitSize}px ${config.fontFamily}`;
        ctx.fillText('bpm', cx, cy + hrValSize * 0.7);
    }

    // Right side: stacked metrics
    const rightX = w - orientation.safePad;
    const metricRows = [
        data.pace ? { label: 'PACE', unit: 'min/km', value: data.pace } : null,
        data.distance ? { label: 'DIST', unit: 'km', value: data.distance } : null,
        data.time ? { label: 'TIME', unit: '', value: data.time } : null,
    ].filter(Boolean) as Array<{ label: string; unit: string; value: string }>;

    const valSize = Math.max(16, Math.round(orientation.shortSide * 0.055 * tuning.textScale));
    const lblSize = Math.max(7, Math.round(valSize * 0.32));
    const rowH = valSize * 1.6;
    const totalH = rowH * metricRows.length;
    const startY = cy - totalH / 2 + rowH * 0.5;

    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < metricRows.length; i++) {
        const row = metricRows[i]!;
        const baseY = startY + i * rowH;

        // Label + unit column (right-aligned before value)
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(row.label, rightX - valSize * (row.value.length > 5 ? 3.8 : 3.0) - lblSize, baseY - lblSize * 0.6);
        if (row.unit) {
            ctx.fillStyle = accent;
            ctx.font = `400 ${lblSize}px ${config.fontFamily}`;
            ctx.fillText(row.unit, rightX - valSize * (row.value.length > 5 ? 3.8 : 3.0) - lblSize, baseY + lblSize * 0.9);
        }

        // Value
        const fontSize = row.value.length > 5 ? Math.round(valSize * 0.8) : valSize;
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${fontSize}px ${config.fontFamily}`;
        ctx.fillText(row.value, rightX, baseY);
    }
}

// ─── Template 28: Sports Broadcast ───────────────────────────────────────────
function drawSportsBroadcast(
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

    // Orange top line
    ctx.fillStyle = accent;
    ctx.fillRect(0, y, w, accentLineH);

    // Dark background panel
    ctx.fillStyle = config.backgroundColor || 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, y + accentLineH, w, barH);

    // Orange side tag "RUN"
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

    // Metrics grid
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

        // Separator
        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colX, panelY + barH * 0.18);
            ctx.lineTo(colX, panelY + barH * 0.82);
            ctx.stroke();
        }

        const centerColX = colX + colW * 0.5;
        // Label (orange, top-center)
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(item.label, centerColX, panelY + barH * 0.27);
        // Value (large, center)
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(item.value, centerColX, panelY + barH * 0.66);
        // Unit (below value, center)
        if (item.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.font = `400 ${Math.max(7, Math.round(labelSize * 0.86))}px ${config.fontFamily}`;
            ctx.fillText(item.unit, centerColX, panelY + barH * 0.86);
        }
    }
}

// ─── Template 29: Cockpit HUD ─────────────────────────────────────────────────
function drawCockpitHud(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const accent = config.accentColor || '#f97316';
    const pad = orientation.safePad;

    // Top-left status indicator
    const dotR = Math.max(3, Math.round(orientation.shortSide * 0.008));
    const statusY = pad + dotR + pad * 0.3;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(pad + dotR, statusY, dotR, 0, Math.PI * 2);
    ctx.fill();
    const statusSize = Math.max(7, Math.round(dotR * 2.5 * tuning.textScale));
    ctx.fillStyle = 'rgba(249,115,22,0.62)';
    ctx.font = `500 ${statusSize}px ${config.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SYS ACTIVE', pad + dotR * 2.8, statusY);

    // Top-right: elapsed time
    if (data.time) {
        const timeSize = Math.max(11, Math.round(orientation.shortSide * 0.035 * tuning.textScale));
        const timeLabelSize = Math.max(7, Math.round(timeSize * 0.38));
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${timeLabelSize}px ${config.fontFamily}`;
        ctx.fillText('ELAPSED', w - pad, pad + timeLabelSize + pad * 0.3);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `300 ${timeSize}px ${config.fontFamily}`;
        ctx.fillText(data.time, w - pad, pad + timeLabelSize + timeSize + pad * 0.3);
    }

    // Bottom-left: large pace
    if (data.pace) {
        const paceSize = Math.max(28, Math.round(orientation.shortSide * (orientation.isPortrait ? 0.18 : 0.13) * tuning.textScale));
        const paceLabelSize = Math.max(7, Math.round(paceSize * 0.17));
        const baseY = h - pad;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = accent;
        ctx.font = `500 ${paceLabelSize}px ${config.fontFamily}`;
        ctx.fillText('min / km', pad, baseY - paceSize - paceLabelSize * 1.8);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('PACE', pad, baseY - paceSize - paceLabelSize * 0.3);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${paceSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, pad, baseY);
    }

    // Bottom-right: waveform heart rate
    if (data.heartRate) {
        const hrVal = parseInt(data.heartRate, 10);
        const hrPercent = Math.min(1, hrVal / 200);
        const valSize = Math.max(18, Math.round(orientation.shortSide * 0.075 * tuning.textScale));
        const lblSize = Math.max(7, Math.round(valSize * 0.27));
        const barCount = 20;
        const barW = Math.max(2, Math.round(orientation.shortSide * 0.006));
        const barGap = Math.max(1, Math.round(barW * 0.5));
        const maxBarH = Math.max(14, Math.round(valSize * 0.55));
        const barsW = (barW + barGap) * barCount - barGap;
        const baseX = w - pad;
        const baseY = h - pad;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';

        // HR label
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText('HEART RATE', baseX, baseY - valSize - maxBarH - lblSize * 1.4);

        // Waveform bars — bottom anchored above HR value
        const barsBaseY = baseY - lblSize * 1.8 - valSize * 0.1;
        for (let i = 0; i < barCount; i++) {
            const barH2 = Math.round(maxBarH * (0.35 + Math.abs(Math.sin(i * 0.8)) * 0.65));
            const bx = baseX - barsW + i * (barW + barGap);
            const by = barsBaseY - barH2;
            ctx.fillStyle = (i / barCount) < hrPercent ? accent : 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.roundRect(bx, by, barW, barH2, Math.min(barW / 2, 2));
            ctx.fill();
        }

        // HR value + bpm unit
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(data.heartRate, baseX, baseY - lblSize * 1.8);
        ctx.fillStyle = accent;
        ctx.font = `400 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText('bpm', baseX, baseY);
    }

    // Bottom-center: distance (elevated to avoid overlapping pace/HR)
    if (data.distance) {
        const distSize = Math.max(14, Math.round(orientation.shortSide * 0.05 * tuning.textScale));
        const distLblSize = Math.max(7, Math.round(distSize * 0.32));
        const cx = w * 0.5;
        const distBaseY = Math.round(h * 0.85) - pad;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${distLblSize}px ${config.fontFamily}`;
        ctx.fillText('DISTANCE · KM', cx, distBaseY - distSize - distLblSize * 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = `200 ${distSize}px ${config.fontFamily}`;
        ctx.fillText(data.distance, cx, distBaseY);
    }

    // Bottom orange gradient divider line
    const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.5, 'rgba(249,115,22,0.42)');
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h - 1);
    ctx.stroke();
}


// ─── Template 31: Terminal ────────────────────────────────────────────────────
function drawTerminal(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    _h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const rows = [
        data.pace ? { key: 'pace', value: data.pace, unit: 'min/km' } : null,
        data.heartRate ? { key: 'hr', value: data.heartRate, unit: 'bpm' } : null,
        data.distance ? { key: 'dist', value: data.distance, unit: 'km' } : null,
        data.time ? { key: 'time', value: data.time, unit: '' } : null,
    ].filter(Boolean) as Array<{ key: string; value: string; unit: string }>;
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

    // Dark background
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, radius);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(34,197,94,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const green = config.textColor || '#86efac';
    const greenDim = 'rgba(74,222,128,0.5)';
    const greenFaint = 'rgba(34,197,94,0.3)';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Header comment
    ctx.fillStyle = 'rgba(74,222,128,0.45)';
    ctx.font = `500 ${headerSize}px ${config.fontFamily}`;
    ctx.fillText('// GPX TELEMETRY', boxX + innerPad, boxY + innerPad + headerSize);

    // Rows
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const rowY = boxY + innerPad + headerSize * 1.6 + (i + 0.85) * lineH;

        // › prompt
        ctx.fillStyle = greenFaint;
        ctx.font = `500 ${textSize}px ${config.fontFamily}`;
        ctx.fillText('›', boxX + innerPad, rowY);

        // key =
        const promptW = ctx.measureText('› ').width;
        ctx.fillStyle = greenDim;
        ctx.font = `400 ${textSize}px ${config.fontFamily}`;
        ctx.fillText(row.key, boxX + innerPad + promptW, rowY);

        const keyW = ctx.measureText(row.key + ' ').width;
        ctx.fillStyle = greenFaint;
        ctx.fillText('=', boxX + innerPad + promptW + keyW, rowY);

        const eqW = ctx.measureText('= ').width;
        ctx.fillStyle = green;
        ctx.font = `500 ${textSize}px ${config.fontFamily}`;
        ctx.fillText(row.value, boxX + innerPad + promptW + keyW + eqW, rowY);

        if (row.unit) {
            const valW = ctx.measureText(row.value + ' ').width;
            ctx.fillStyle = 'rgba(34,197,94,0.32)';
            ctx.font = `400 ${Math.max(8, Math.round(textSize * 0.78))}px ${config.fontFamily}`;
            ctx.fillText(row.unit, boxX + innerPad + promptW + keyW + eqW + valW, rowY);
        }
    }

    // Cursor
    const cursorY = boxY + innerPad + headerSize * 1.6 + rows.length * lineH + lineH * 0.55;
    ctx.fillStyle = 'rgba(34,197,94,0.22)';
    ctx.font = `400 ${textSize}px ${config.fontFamily}`;
    ctx.fillText('_', boxX + innerPad, cursorY);
}

// ─── Template 32: Night Runner ────────────────────────────────────────────────
function drawNightRunner(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    // amber accent via config.accentColor: config.accentColor || '#fbbf24'

    // Top-center: large glowing pace
    if (data.pace) {
        const paceSize = Math.max(28, Math.round(orientation.shortSide * (orientation.isPortrait ? 0.2 : 0.15) * tuning.textScale));
        const paceUnitSize = Math.max(8, Math.round(paceSize * 0.17));
        const paceY = orientation.safePad + paceSize + orientation.compactPad;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(251,191,36,0.45)';
        ctx.shadowBlur = Math.max(12, paceSize * 0.4);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `200 ${paceSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, w * 0.5, paceY);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(251,191,36,0.62)';
        ctx.font = `500 ${paceUnitSize}px ${config.fontFamily}`;
        ctx.fillText('MIN / KM', w * 0.5, paceY + paceUnitSize * 1.4);
    }

    // Bottom gradient strip
    const stripH = Math.round(h * (orientation.isPortrait ? 0.22 : 0.2));
    const grad = ctx.createLinearGradient(0, h - stripH, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.35, 'rgba(0,0,0,0.72)');
    grad.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - stripH, w, stripH);

    // Three bottom metrics
    const metrics = [
        data.heartRate ? { label: 'HEART RATE', value: data.heartRate, unit: 'bpm', glow: 'rgba(248,113,113,0.45)', align: 'left' as const } : null,
        data.distance ? { label: 'DISTANCE', value: data.distance, unit: 'km', glow: `rgba(251,191,36,0.35)`, align: 'center' as const } : null,
        data.time ? { label: 'ELAPSED', value: data.time, unit: '', glow: 'rgba(255,255,255,0.22)', align: 'right' as const } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string; glow: string; align: 'left' | 'center' | 'right' }>;

    if (metrics.length === 0) return;

    const valSize = Math.max(14, Math.round(orientation.shortSide * 0.05 * tuning.textScale));
    const lblSize = Math.max(7, Math.round(valSize * 0.3));
    const baseY = h - orientation.safePad;

    // Vertical separators between metrics
    if (metrics.length > 1) {
        const step = (w - orientation.safePad * 2) / metrics.length;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let i = 1; i < metrics.length; i++) {
            const lx = orientation.safePad + step * i;
            ctx.beginPath();
            ctx.moveTo(lx, baseY - valSize * 1.6);
            ctx.lineTo(lx, baseY - valSize * 0.1);
            ctx.stroke();
        }
    }

    const step = (w - orientation.safePad * 2) / (metrics.length || 1);
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < metrics.length; i++) {
        const m = metrics[i]!;
        let anchorX: number;
        if (m.align === 'left') {
            anchorX = orientation.safePad + step * i + step * 0.05;
        } else if (m.align === 'right') {
            anchorX = orientation.safePad + step * (i + 1) - step * 0.05;
        } else {
            anchorX = orientation.safePad + step * i + step * 0.5;
        }

        ctx.textAlign = m.align;
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(m.label, anchorX, baseY - valSize * 1.15);

        ctx.shadowColor = m.glow;
        ctx.shadowBlur = Math.max(8, valSize * 0.3);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(m.value, anchorX, baseY);
        ctx.shadowBlur = 0;

        if (m.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.font = `400 ${lblSize}px ${config.fontFamily}`;
            ctx.fillText(m.unit, anchorX, baseY + lblSize * 1.2);
        }
    }
}

// ─── Template 33: Data Block ──────────────────────────────────────────────────
function drawDataBlock(
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

        // Label (left-aligned column)
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(row.label, orientation.safePad, curY + rh * 0.28);

        // Unit (orange, left-aligned below label)
        if (row.unit) {
            ctx.fillStyle = accent;
            ctx.font = `400 ${Math.max(7, Math.round(lblSize * 0.95))}px ${config.fontFamily}`;
            ctx.fillText(row.unit, orientation.safePad, curY + rh * 0.52);
        }

        // Value (right-aligned)
        ctx.textAlign = 'right';
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `300 ${vs}px ${config.fontFamily}`;
        ctx.fillText(row.value, rightX, curY + rh * 0.68);

        curY += rh;
    }
}

// ─── Template 34: Race Tag ────────────────────────────────────────────────────
function drawRaceTag(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    // Top-left bib tag with clip-path polygon
    const tagW = Math.round(w * (orientation.isPortrait ? 0.35 : 0.22));
    const tagH = Math.round(h * (orientation.isPortrait ? 0.25 : 0.28));
    const cutX = tagW * 0.82;
    const cutY = tagH * 0.78;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tagW, 0);
    ctx.lineTo(tagW, cutY);
    ctx.lineTo(cutX, tagH);
    ctx.lineTo(0, tagH);
    ctx.closePath();
    ctx.clip();

    // White bib background
    ctx.fillStyle = config.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, tagW, tagH);

    // Pace on bib
    if (data.pace) {
        const paceSize = Math.max(20, Math.round(tagW * 0.38 * tuning.textScale));
        const tagLblSize = Math.max(7, Math.round(paceSize * 0.22));
        const innerPad = tagW * 0.1;
        const textColor = config.textColor === '#FFFFFF' ? '#111111' : config.textColor || '#111111';

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.font = `600 ${tagLblSize}px ${config.fontFamily}`;
        ctx.fillText('PACE', innerPad, tagH * 0.28);

        ctx.fillStyle = textColor;
        ctx.font = `400 ${paceSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, innerPad, tagH * 0.28 + paceSize * 0.95);

        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.font = `600 ${Math.max(7, Math.round(tagLblSize * 0.95))}px ${config.fontFamily}`;
        ctx.fillText('MIN/KM', innerPad, tagH * 0.28 + paceSize * 0.95 + tagLblSize * 1.3);
    }

    ctx.restore();

    // Bottom strip with HR, dist, time
    const stripH = Math.round(h * (orientation.isPortrait ? 0.09 : 0.08));
    const stripY = h - stripH;
    ctx.fillStyle = 'rgba(0,0,0,0.76)';
    ctx.fillRect(0, stripY, w, stripH);

    const stripItems = [
        data.heartRate ? { label: 'HR', value: data.heartRate, unit: 'BPM' } : null,
        data.distance ? { label: 'DIST', value: data.distance, unit: 'KM' } : null,
        data.time ? { label: 'TIME', value: data.time, unit: '' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;
    if (stripItems.length === 0) return;

    const colW = w / stripItems.length;
    const valSize = Math.max(14, Math.round(stripH * 0.44 * tuning.textScale));
    const lblSize = Math.max(7, Math.round(valSize * 0.35));

    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < stripItems.length; i++) {
        const item = stripItems[i]!;

        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colW * i, stripY + stripH * 0.18);
            ctx.lineTo(colW * i, stripY + stripH * 0.82);
            ctx.stroke();
        }

        const colPad = Math.max(6, Math.round(stripH * 0.12));
        const textX = colW * i + colPad;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `600 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(item.label, textX, stripY + stripH * 0.38);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `400 ${valSize}px ${config.fontFamily}`;
        const displayVal = item.unit ? `${item.value} ${item.unit.toLowerCase()}` : item.value;
        ctx.fillText(displayVal, textX, stripY + stripH * 0.82);
    }
}

function drawMetricBlock(
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

// ─── Template 35: Glass Panel ─────────────────────────────────────────────────
function drawGlassPanel(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const items = [
        data.pace ? { label: 'PACE', value: data.pace, unit: 'min/km' } : null,
        data.heartRate ? { label: 'HR', value: data.heartRate, unit: 'bpm' } : null,
        data.distance ? { label: 'DIST', value: data.distance, unit: 'km' } : null,
        data.time ? { label: 'TIME', value: data.time, unit: '' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;
    if (items.length === 0) return;

    const valSize = Math.max(14, Math.round(orientation.shortSide * 0.05 * tuning.textScale));
    const lblSize = Math.max(7, Math.round(valSize * 0.36));
    const itemPad = Math.max(16, Math.round(valSize * 0.8));
    const innerPadV = Math.max(10, Math.round(valSize * 0.55));
    const totalW = items.length * itemPad * 2 + items.reduce((sum, item) => {
        ctx.font = `500 ${valSize}px ${config.fontFamily}`;
        return sum + Math.max(ctx.measureText(item.value).width, ctx.measureText(item.label).width);
    }, 0) + (items.length - 1) * itemPad;

    const panelW = Math.min(w * 0.9, Math.max(totalW, items.length * Math.round(valSize * 3.5)));
    const panelH = valSize + lblSize * 2 + innerPadV * 2 + lblSize * 0.6;
    const panelX = (w - panelW) * 0.5;
    const panelY = h - orientation.safePad - panelH;
    const radius = Math.max(12, Math.round(panelH * 0.3));

    // Frosted glass background — dark inner fill for legibility
    ctx.fillStyle = config.backgroundColor || 'rgba(10,10,20,0.65)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, radius);
    ctx.fill();

    // Border with stronger contrast
    ctx.strokeStyle = config.borderColor || 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const colW = panelW / items.length;
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const cx2 = panelX + colW * i + colW * 0.5;

        // Separator
        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(panelX + colW * i, panelY + panelH * 0.15);
            ctx.lineTo(panelX + colW * i, panelY + panelH * 0.85);
            ctx.stroke();
        }

        ctx.textAlign = 'center';
        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = `600 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText(item.label, cx2, panelY + innerPadV + lblSize);
        // Value
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `500 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(item.value, cx2, panelY + innerPadV + lblSize + valSize * 1.05);
        // Unit
        if (item.unit) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = `400 ${Math.max(7, Math.round(lblSize * 0.9))}px ${config.fontFamily}`;
            ctx.fillText(item.unit, cx2, panelY + innerPadV + lblSize + valSize * 1.05 + lblSize * 1.2);
        }
    }
}


// ─── Template 37: Minimal Ring ────────────────────────────────────────────────
function drawMinimalRing(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!data.pace) return;

    const ringRadius = Math.round(orientation.shortSide * (orientation.isPortrait ? 0.12 : 0.09));
    const strokeW = Math.max(2, Math.round(ringRadius * 0.07));
    const cx = w - orientation.safePad - ringRadius;
    const cy = h - orientation.safePad - ringRadius;

    // Background ring
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Progress arc based on pace (3–10 min/km range)
    const paceVal = parsePace(data.pace);
    const progress = Math.min(1, Math.max(0, (10 - paceVal) / 8));
    const startAngle = -(Math.PI / 2);
    const endAngle = startAngle + Math.PI * 2 * progress;

    ctx.strokeStyle = config.textColor || '#FFFFFF';
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, startAngle, endAngle, false);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Pace value inside ring
    const paceSize = Math.max(12, Math.round(ringRadius * 0.52 * tuning.textScale));
    const paceUnitSize = Math.max(7, Math.round(paceSize * 0.3));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.font = `300 ${paceSize}px ${config.fontFamily}`;
    ctx.fillText(data.pace, cx, cy + paceSize * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `500 ${paceUnitSize}px ${config.fontFamily}`;
    ctx.fillText('MIN/KM', cx, cy + paceSize * 0.3 + paceUnitSize * 1.3);

    // Sub-metrics below the ring
    const subItems = [
        data.heartRate ? { label: 'BPM', value: data.heartRate } : null,
        data.distance ? { label: 'KM', value: data.distance } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    if (subItems.length > 0) {
        const subSize = Math.max(11, Math.round(ringRadius * 0.4 * tuning.textScale));
        const subLblSize = Math.max(7, Math.round(subSize * 0.35));
        const subGap = Math.max(20, ringRadius * 0.6);
        const subY = cy + ringRadius + subSize * 1.4 + strokeW;

        if (subY < h - orientation.safePad * 0.5) {
            for (let i = 0; i < subItems.length; i++) {
                const item = subItems[i]!;
                const offsetX = (i - (subItems.length - 1) * 0.5) * subGap;
                ctx.textAlign = 'center';
                ctx.fillStyle = config.textColor || '#FFFFFF';
                ctx.font = `300 ${subSize}px ${config.fontFamily}`;
                ctx.fillText(item.value, cx + offsetX, subY);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.font = `500 ${subLblSize}px ${config.fontFamily}`;
                ctx.fillText(item.label, cx + offsetX, subY + subLblSize * 1.3);
            }
        }
    }
}

// ─── Template 38: Stretched Bar ───────────────────────────────────────────────
function drawStretchedBar(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    _h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const pad = orientation.safePad;
    const valSize = Math.max(20, Math.round(orientation.shortSide * (orientation.isPortrait ? 0.1 : 0.075) * tuning.textScale));
    const lblSize = Math.max(7, Math.round(valSize * 0.32));
    const lineY = pad + valSize + lblSize * 1.8 + lblSize;
    const lineW = 1;

    // Dark background strip covering the full top block
    const bgH = lineY + Math.max(16, Math.round(valSize * 0.65)) + Math.max(7, Math.round(lblSize * 0.95)) * 2.5;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, bgH);

    ctx.textBaseline = 'alphabetic';

    // Top row: PACE (left) + HR (right) above divider
    if (data.pace) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText('PACE', pad, pad + lblSize);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, pad, pad + lblSize + valSize);
    }
    if (data.heartRate) {
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
        ctx.fillText('HR', w - pad, pad + lblSize);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${valSize}px ${config.fontFamily}`;
        ctx.fillText(data.heartRate, w - pad, pad + lblSize + valSize);
    }

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(pad, lineY);
    ctx.lineTo(w - pad, lineY);
    ctx.stroke();

    // Bottom row: DIST (left) + TIME (right) below divider
    const sub = Math.max(16, Math.round(valSize * 0.65));
    const subLbl = Math.max(7, Math.round(lblSize * 0.95));
    const subBaseY = lineY + sub + subLbl;
    if (data.distance) {
        ctx.textAlign = 'left';
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${sub}px ${config.fontFamily}`;
        ctx.fillText(data.distance, pad, subBaseY);
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.font = `500 ${subLbl}px ${config.fontFamily}`;
        ctx.fillText('DIST', pad, subBaseY + subLbl * 1.4);
    }
    if (data.time) {
        ctx.textAlign = 'right';
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${sub}px ${config.fontFamily}`;
        ctx.fillText(data.time, w - pad, subBaseY);
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.font = `500 ${subLbl}px ${config.fontFamily}`;
        ctx.fillText('TIME', w - pad, subBaseY + subLbl * 1.4);
    }
}



// ─── Template 41: Focus Type ──────────────────────────────────────────────────
function drawFocusType(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    if (!data.pace) return;

    // Giant italic pace number centered
    const heroSize = Math.max(60, Math.round(Math.min(w, h) * (orientation.isPortrait ? 0.38 : 0.28) * tuning.textScale));
    const paceUnitSize = Math.max(10, Math.round(heroSize * 0.12));
    const centerX = w * 0.5;
    const centerY = h * 0.46;

    ctx.save();
    ctx.font = `italic 900 ${heroSize}px ${config.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Text shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.fillText(data.pace, centerX, centerY);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Unit
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `700 ${paceUnitSize}px "DM Sans", Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('MIN/KM', centerX, centerY + paceUnitSize * 2.8);

    // Small secondary metrics below
    const subItems = [
        data.heartRate ? { icon: '♥', value: data.heartRate, unit: 'bpm' } : null,
        data.distance ? { icon: '↗', value: data.distance, unit: 'km' } : null,
        data.time ? { icon: '◷', value: data.time, unit: '' } : null,
    ].filter(Boolean) as Array<{ icon: string; value: string; unit: string }>;

    if (subItems.length > 0) {
        const subSize = Math.max(12, Math.round(heroSize * 0.16 * tuning.textScale));
        const subY = h - orientation.safePad;
        const subGap = Math.max(40, Math.round(subSize * 3.5));
        const subStartX = centerX - (subItems.length - 1) * subGap * 0.5;

        ctx.textBaseline = 'alphabetic';
        for (let i = 0; i < subItems.length; i++) {
            const item = subItems[i]!;
            const ix = subStartX + i * subGap;
            const display = item.unit ? `${item.value} ${item.unit}` : item.value;
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = `300 ${subSize}px "DM Sans", sans-serif`;
            ctx.fillText(display, ix, subY);
        }
    }
}


function toMetricMap(metrics: MetricItem[]): MetricMap {
    const find = (label: string): string | undefined => metrics.find(m => m.label.toLowerCase() === label.toLowerCase())?.value;
    return {
        pace: find('Pace'),
        heartRate: find('Heart Rate'),
        distance: find('Distance'),
        time: find('Time'),
    };
}

function parsePace(pace?: string): number {
    if (!pace) return 6;
    const [m = Number.NaN, s = Number.NaN] = pace.split(':').map(Number);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return 6;
    return m + s / 60;
}

function getOrientation(w: number, h: number): Orientation {
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
