import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { clamp, fontWeightValue, getStableMetricValue, measureTrackedTextWidth } from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type Orientation } from './shared';

const INTER_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function finiteSetting(value: number | undefined, fallback: number, min: number, max: number): number {
    return Number.isFinite(value) ? clamp(value!, min, max) : fallback;
}

function measure(
    ctx: OverlayContext2D,
    text: string,
    fontFamily: string,
    size: number,
    weight: number,
    tracking = 0,
): number {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    return measureTrackedTextWidth(ctx, text, tracking, size);
}

function drawOutlined(ctx: OverlayContext2D, text: string, x: number, y: number): void {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
}

function drawTrackedOutlined(
    ctx: OverlayContext2D,
    text: string,
    centerX: number,
    y: number,
    tracking: number,
    size: number,
): void {
    const width = measureTrackedTextWidth(ctx, text, tracking, size);
    const spacing = size * tracking;
    let cursorX = centerX - width / 2;
    for (const character of text) {
        drawOutlined(ctx, character, cursorX, y);
        cursorX += ctx.measureText(character).width + spacing;
    }
}

export function drawFocusType(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: { textScale: number; labelTrackingScale?: number },
): void {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 96 || h < 96) return;

    const items = toStandardMetricItems(
        data,
        {
            heartRate: { label: 'HR', unit: 'BPM' },
            distance: { label: 'DISTANCE', unit: 'KM' },
            time: { label: 'ELAPSED', unit: '' },
            power: { label: 'POWER', unit: 'W' },
        },
        ['heartRate', 'distance', 'time', 'power'],
    );
    const hasPace = Boolean(data.pace);
    if (!hasPace && items.length === 0) return;

    const fontFamily = config.fontFamily || INTER_FONT;
    const textColor = config.textColor || '#f8fafc';
    const accentColor = config.accentColor || '#f97316';
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const labelVisible = config.labelStyle !== 'hidden';
    const labelMultiplier = finiteSetting(config.labelSizeMultiplier, 0.42, 0.3, 0.9);
    const labelTracking = finiteSetting(config.labelLetterSpacing, 0.06, 0, 0.12)
        * finiteSetting(tuning.labelTrackingScale, 1, 0.5, 1.5);
    const lineSpacing = finiteSetting(config.lineSpacing, 1.15, 0.9, 1.8);
    const safePad = clamp(orientation.safePad, 8, Math.min(w * 0.08, h * 0.1));
    const availableW = Math.max(0, w - safePad * 2);
    const availableH = Math.max(0, h - safePad * 2);
    const columns = items.length === 0 ? 0 : orientation.isPortrait || w < 560 ? Math.min(2, items.length) : items.length;
    const rowCount = columns > 0 ? Math.ceil(items.length / columns) : 0;
    const unitGap = 4;

    let selected: {
        valueSize: number;
        unitSize: number;
        labelSize: number;
        labelGap: number;
        itemHeight: number;
        columnGap: number;
        rowGap: number;
        cellWidth: number;
        gridWidth: number;
        gridHeight: number;
    } | undefined;

    const requestedValueSize = Math.min(
        52,
        orientation.shortSide
            * finiteSetting(config.fontSizePercent, 2.2, 0.5, 8)
            * finiteSetting(config.valueSizeMultiplier, 2.35, 0.5, 4)
            * finiteSetting(tuning.textScale, 1, 0.5, 4)
            / 100,
    );
    for (let valueSize = Math.max(11, Math.floor(requestedValueSize)); valueSize >= 8; valueSize -= 1) {
        const labelSize = labelVisible ? Math.max(7, Math.round(valueSize * labelMultiplier)) : 0;
        const unitSize = Math.max(8, Math.round(valueSize * 0.68));
        const labelGap = labelVisible ? Math.max(3, Math.round(valueSize * 0.18 * lineSpacing)) : 0;
        const itemHeight = (labelVisible ? labelSize + labelGap : 0) + Math.max(valueSize, unitSize);
        const columnGap = clamp(orientation.shortSide * 0.025, 8, 24);
        const rowGap = clamp(valueSize * 0.4, 5, 16);
        const cellWidth = items.length === 0
            ? 0
            : Math.max(56, ...items.map((item) => {
                const unit = (item.unit ?? '').toUpperCase();
                const labelWidth = labelVisible
                    ? measure(ctx, item.label, fontFamily, labelSize, 500, labelTracking)
                    : 0;
                const valueWidth = Math.max(
                    measure(ctx, item.value, fontFamily, valueSize, valueWeight),
                    measure(ctx, getStableMetricValue(item.label), fontFamily, valueSize, valueWeight),
                );
                const unitWidth = measure(ctx, unit, fontFamily, unitSize, 500);
                return Math.max(labelWidth, valueWidth + (unit ? unitGap + unitWidth : 0)) + 8;
            }));
        const gridWidth = columns > 0 ? columns * cellWidth + (columns - 1) * columnGap : 0;
        const gridHeight = rowCount > 0 ? rowCount * itemHeight + (rowCount - 1) * rowGap : 0;

        if (gridWidth > availableW || gridHeight > availableH) continue;
        selected = {
            valueSize,
            unitSize,
            labelSize,
            labelGap,
            itemHeight,
            columnGap,
            rowGap,
            cellWidth,
            gridWidth,
            gridHeight,
        };
        break;
    }

    if (!selected) return;

    const metricGridTop = hasPace
        ? h - safePad - selected.gridHeight
        : h / 2 - selected.gridHeight / 2;
    const heroScale = finiteSetting(config.valueSizeMultiplier, 2.35, 0.5, 4) / 2.35;
    let heroSize = clamp(
        Math.round(orientation.shortSide * (orientation.isPortrait ? 0.2 : 0.25) * finiteSetting(tuning.textScale, 1, 0.5, 4) * heroScale),
        22,
        220,
    );
    const heroUnitSize = Math.max(8, Math.round(heroSize * 0.13));
    const heroGap = Math.max(5, Math.round(heroSize * 0.12));
    const heroHeight = heroSize + heroGap + heroUnitSize;
    const heroWidthLimit = availableW * 0.94;
    const heroBottomLimit = hasPace ? metricGridTop - clamp(orientation.shortSide * 0.045, 8, 34) : h - safePad;

    if (hasPace) {
        while (heroSize > 18 && (
            Math.max(
                measure(ctx, data.pace!, fontFamily, heroSize, valueWeight),
                measure(ctx, getStableMetricValue('pace'), fontFamily, heroSize, valueWeight),
            ) > heroWidthLimit
            || heroHeight > heroBottomLimit - safePad
        )) {
            heroSize -= 1;
        }
    }

    const finalHeroUnitSize = Math.max(8, Math.round(heroSize * 0.13));
    const finalHeroGap = Math.max(5, Math.round(heroSize * 0.12));
    const finalHeroHeight = heroSize + finalHeroGap + finalHeroUnitSize;
    const desiredHeroCenter = h * (orientation.isPortrait ? 0.33 : 0.37);
    const heroTop = Math.max(safePad, Math.min(
        desiredHeroCenter - finalHeroHeight / 2,
        heroBottomLimit - finalHeroHeight,
    ));

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(3,9,16,0.9)';

    if (data.pace) {
        ctx.fillStyle = textColor;
        ctx.font = `${valueWeight} ${heroSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(heroSize * 0.1, 1.2, 3);
        drawOutlined(ctx, data.pace, w / 2, heroTop);

        ctx.fillStyle = accentColor;
        ctx.font = `500 ${finalHeroUnitSize}px ${fontFamily}`;
        ctx.lineWidth = clamp(finalHeroUnitSize * 0.12, 0.9, 1.8);
        drawTrackedOutlined(ctx, 'MIN/KM', w / 2, heroTop + heroSize + finalHeroGap, labelTracking, finalHeroUnitSize);
    }

    if (items.length > 0) {
        const gridLeft = (w - selected.gridWidth) / 2;
        const gridTop = metricGridTop;
        for (let row = 0; row < rowCount; row += 1) {
            const rowItems = items.slice(row * columns, (row + 1) * columns);
            const rowWidth = rowItems.length * selected.cellWidth + Math.max(0, rowItems.length - 1) * selected.columnGap;
            const rowLeft = gridLeft + (selected.gridWidth - rowWidth) / 2;
            const rowTop = gridTop + row * (selected.itemHeight + selected.rowGap);

            for (let column = 0; column < rowItems.length; column += 1) {
                const item = rowItems[column]!;
                const centerX = rowLeft + column * (selected.cellWidth + selected.columnGap) + selected.cellWidth / 2;
                const unit = (item.unit ?? '').toUpperCase();
                const valueWidth = measure(ctx, item.value, fontFamily, selected.valueSize, valueWeight);
                const unitWidth = measure(ctx, unit, fontFamily, selected.unitSize, 500);
                const groupWidth = valueWidth + (unit ? unitGap + unitWidth : 0);
                const groupLeft = centerX - groupWidth / 2;
                const valueY = rowTop + (labelVisible ? selected.labelSize + selected.labelGap : 0);

                if (labelVisible) {
                    ctx.textAlign = 'left';
                    ctx.fillStyle = 'rgba(248,250,252,0.82)';
                    ctx.font = `500 ${selected.labelSize}px ${fontFamily}`;
                    ctx.lineWidth = clamp(selected.labelSize * 0.16, 1, 2);
                    drawTrackedOutlined(ctx, item.label, centerX, rowTop, labelTracking, selected.labelSize);
                }

                ctx.textAlign = 'left';
                ctx.fillStyle = textColor;
                ctx.font = `${valueWeight} ${selected.valueSize}px ${fontFamily}`;
                ctx.lineWidth = clamp(selected.valueSize * 0.1, 0.9, 2.2);
                drawOutlined(ctx, item.value, groupLeft, valueY);

                if (unit) {
                    ctx.fillStyle = accentColor;
                    ctx.font = `500 ${selected.unitSize}px ${fontFamily}`;
                    ctx.lineWidth = clamp(selected.unitSize * 0.12, 0.9, 1.6);
                    drawOutlined(ctx, unit, groupLeft + valueWidth + unitGap,
                        valueY + (selected.valueSize - selected.unitSize) * 0.12);
                }
            }
        }
    }

    ctx.restore();
}
