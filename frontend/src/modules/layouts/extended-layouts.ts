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
        case 'floating-pills':
            drawFloatingPills(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'arc-gauge':
            drawArcGauge(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'hero-number':
            drawHeroNumber(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'dashboard-hud':
            drawDashboardHud(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'cinematic-bar':
            drawCinematicBar(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'split-edges':
            drawSplitEdges(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'stacked-serif':
            drawStackedSerif(ctx, data, w, h, config, orientation, tuning);
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
        default:
            break;
    }

    ctx.restore();
}

function drawFloatingPills(
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
        data.time ? { label: 'TIME', value: data.time, unit: 'min' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;
    if (items.length === 0) return;
    const gap = orientation.shortSide * (orientation.isPortrait ? 0.012 : 0.009);
    const pillH = orientation.shortSide * (orientation.isPortrait ? 0.085 : 0.07);
    const totalW = w - orientation.safePad * 2;
    const pillW = (totalW - gap * (items.length - 1)) / items.length;
    const y = h - orientation.safePad - pillH;
    const labelSize = Math.max(8, Math.round(pillH * 0.18 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(pillH * 0.3 * tuning.textScale));
    const unitSize = Math.max(8, Math.round(pillH * 0.16 * tuning.textScale));
    const radius = pillH / 2;

    for (let i = 0; i < items.length; i++) {
        const x = orientation.safePad + i * (pillW + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.roundRect(x, y, pillW, pillH, radius);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(items[i]!.label, x + pillW * 0.5, y + pillH * 0.14);

        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `${fontWeightValue(config.valueFontWeight || 'normal')} ${valueSize}px ${config.fontFamily}`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(items[i]!.value, x + pillW * 0.5, y + pillH * 0.66);

        ctx.fillStyle = 'rgba(255,255,255,0.58)';
        ctx.font = `500 ${unitSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]!.unit, x + pillW * 0.5, y + pillH * 0.9);
    }
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

    const sideValueSize = Math.max(14, Math.round(radius * 0.32));
    const sideLabelSize = Math.max(8, Math.round(radius * 0.12));
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

function drawDashboardHud(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const valueSize = Math.max(18, Math.round(orientation.shortSide * 0.06 * tuning.textScale));
    const labelSize = Math.max(8, Math.round(valueSize * 0.28));

    if (data.pace) {
        drawMetricBlock(ctx, orientation.safePad, orientation.safePad, 'PACE', data.pace, 'min/km', labelSize, valueSize, config, 'left');
    }
    if (data.heartRate) {
        drawMetricBlock(ctx, w - orientation.safePad, orientation.safePad, 'HEART RATE', data.heartRate, 'bpm', labelSize, valueSize, { ...config, accentColor: '#ef4444' }, 'right');
    }

    const y = h - orientation.safePad;
    if (data.distance) {
        drawMetricInline(ctx, orientation.safePad, y, 'DISTANCE', `${data.distance} km`, labelSize, valueSize * 0.7, config, 'left');
    }
    if (data.time) {
        drawMetricInline(ctx, w - orientation.safePad, y, 'ELAPSED', data.time, labelSize, valueSize * 0.7, config, 'right');
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h - orientation.safePad - valueSize * 0.35);
    ctx.lineTo(w * 0.65, h - orientation.safePad - valueSize * 0.35);
    ctx.stroke();
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
    const labelSize = Math.max(8, Math.round(orientation.shortSide * 0.014 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(orientation.shortSide * 0.024 * tuning.textScale));
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

function drawSplitEdges(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const cardW = w * (orientation.isPortrait ? 0.36 : 0.24);
    const cardH = h * (orientation.isPortrait ? 0.13 : 0.18);
    const labelSize = Math.max(8, Math.round(orientation.shortSide * 0.012 * tuning.textScale));
    const valueSize = Math.max(14, Math.round(orientation.shortSide * 0.04 * tuning.textScale));
    const p = orientation.safePad;

    const cards = [
        data.pace ? { label: 'PACE', value: data.pace, unit: 'min/km', align: 'left' as const } : null,
        data.heartRate ? { label: 'HEART RATE', value: data.heartRate, unit: 'bpm', align: 'right' as const } : null,
        data.distance ? { label: 'DISTANCE', value: data.distance, unit: 'km', align: 'left' as const } : null,
        data.time ? { label: 'ELAPSED', value: data.time, unit: 'min', align: 'right' as const } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string; align: 'left' | 'right' }>;

    const slots = [
        { x: p, y: p },
        { x: w - p - cardW, y: p },
        { x: p, y: h - p - cardH },
        { x: w - p - cardW, y: h - p - cardH },
    ];

    cards.forEach((card, idx) => {
        const slot = slots[idx]!;
        drawCornerCard(ctx, slot.x, slot.y, cardW, cardH, card.label, card.value, card.unit, labelSize, valueSize, config, card.align);
    });

    if (cards.length > 1) {
        const cx = w * 0.5;
        const cy = h * 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.moveTo(cx - 16, cy);
        ctx.lineTo(cx + 16, cy);
        ctx.moveTo(cx, cy - 16);
        ctx.lineTo(cx, cy + 16);
        ctx.stroke();
    }
}

function drawStackedSerif(
    ctx: OverlayContext2D,
    data: MetricMap,
    _w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number },
): void {
    const items = [
        data.pace ? ['pace', data.pace, 'min/km'] : null,
        data.heartRate ? ['heart', data.heartRate, 'bpm'] : null,
        data.distance ? ['dist', data.distance, 'km'] : null,
        data.time ? ['time', data.time, ''] : null,
    ].filter(Boolean) as Array<[string, string, string]>;
    if (items.length === 0) return;
    const valueSize = Math.max(16, Math.round(orientation.shortSide * 0.045 * tuning.textScale));
    const labelSize = Math.max(9, Math.round(valueSize * 0.28));
    const unitSize = Math.max(8, Math.round(labelSize * 0.95));
    const x = orientation.safePad;
    const rowH = valueSize * 1.35;
    const startY = h - orientation.safePad - rowH * (items.length - 0.2);

    ctx.font = `400 ${valueSize}px ${config.fontFamily}`;
    const maxValueWidth = Math.max(...items.map((item) => ctx.measureText(getStableMetricValue(stackedSerifKeyToLabel(item[0]))).width));
    const labelX = x;
    const valueX = x + labelSize * 6;
    const unitX = valueX + maxValueWidth + Math.max(10, labelSize * 0.9);

    for (let i = 0; i < items.length; i++) {
        const y = startY + i * rowH;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = `500 ${labelSize}px Inter, sans-serif`;
        ctx.fillText(items[i]![0]!, labelX, y);

        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `400 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, valueX, y);

        if (items[i]![2]) {
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            ctx.font = `400 ${unitSize}px Inter, sans-serif`;
            ctx.fillText(items[i]![2]!, unitX, y);
        }
    }
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
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = `500 ${labelSize}px Inter, sans-serif`;
        ctx.fillText('CURRENT PACE', leftX, baselineY - heroSize * 1.18);
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
        const y = topY + i * smallValue * 2.15;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.85))}px Inter, sans-serif`;
        ctx.fillText(lines[i]![0]!, rightX, y - smallValue * 0.8);
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
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(row.label, x, yy);

        ctx.fillStyle = config.textColor || 'rgba(255,255,255,0.28)';
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
    const labelSize = Math.max(8, Math.round(barH * (orientation.isPortrait ? 0.22 : 0.24) * tuning.textScale));
    const baseValueSize = Math.max(9, Math.round(barH * (orientation.isPortrait ? 0.44 : 0.54) * tuning.textScale));

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
        ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, x, y + barH * 0.32);
        ctx.fillStyle = '#111111';
        ctx.font = `700 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, x, y + barH * 0.82);
    }
}

function stackedSerifKeyToLabel(key: string): string {
    switch (key) {
        case 'pace':
            return 'pace';
        case 'heart':
            return 'heart rate';
        case 'dist':
            return 'distance';
        case 'time':
            return 'time';
        default:
            return key;
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
        ctx.fillStyle = i === 1 ? 'rgba(255,236,240,0.92)' : 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, radius);
        ctx.fill();

        const textColor = i === 1 ? 'rgba(120,24,54,0.92)' : 'rgba(24,24,27,0.92)';
        ctx.textAlign = 'center';
        ctx.fillStyle = i === 1 ? 'rgba(120,24,54,0.52)' : 'rgba(24,24,27,0.45)';
        ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![0]!, x + cardW / 2, y + cardH * 0.28);

        ctx.fillStyle = textColor;
        ctx.font = `600 ${valueSize}px ${config.fontFamily}`;
        ctx.fillText(items[i]![1]!, x + cardW / 2, y + cardH * 0.64);

        if (items[i]![2]) {
            ctx.fillStyle = i === 1 ? 'rgba(120,24,54,0.4)' : 'rgba(24,24,27,0.35)';
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
        data.pace ? ['Pace', data.pace, 'min/km'] : null,
        data.heartRate ? ['Heart Rate', data.heartRate, 'bpm'] : null,
        data.distance ? ['Distance', data.distance, 'km'] : null,
        data.time ? ['Time', data.time, ''] : null,
    ].filter(Boolean) as Array<[string, string, string]>;
    if (items.length === 0) return;
    const sidePad = orientation.safePad;
    const contentX = sidePad;
    const contentW = w - sidePad * 2;
    const colW = contentW / items.length;
    const labelSize = Math.max(8, Math.round(barH * 0.12 * tuning.textScale));
    const valueSize = Math.max(12, Math.round(barH * 0.26 * tuning.textScale));
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

function drawMetricInline(
    ctx: OverlayContext2D,
    x: number,
    y: number,
    label: string,
    value: string,
    labelSize: number,
    valueSize: number,
    config: ExtendedOverlayConfig,
    align: 'left' | 'right',
): void {
    ctx.textAlign = align;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(label, x, y - valueSize * 0.95);
    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(value, x, y);
}

function drawCornerCard(
    ctx: OverlayContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    unit: string,
    labelSize: number,
    valueSize: number,
    config: ExtendedOverlayConfig,
    align: 'left' | 'right',
): void {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, Math.max(8, height * 0.18));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    const textX = align === 'left' ? x + width * 0.12 : x + width * 0.88;
    ctx.textAlign = align;
    ctx.fillStyle = 'rgba(255,255,255,0.52)';
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(label, textX, y + height * 0.28);
    ctx.fillStyle = config.textColor || '#FFFFFF';
    ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(value, textX, y + height * 0.68);
    if (unit) {
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.font = `400 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
        ctx.fillText(unit, textX, y + height * 0.88);
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
    const [m, s] = pace.split(':').map(Number);
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
