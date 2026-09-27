import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D, ResolutionTuning } from '../overlayUtils';
import { clamp, drawTrackedText, fontWeightValue, measureTrackedTextWidth } from '../overlayUtils';
import { toStandardMetricItems, type MetricMap, type Orientation } from './shared';

function setFont(ctx: OverlayContext2D, family: string, weight: number, size: number): void {
    ctx.font = `${weight} ${size}px ${family}`;
}

function fitFontSize(
    ctx: OverlayContext2D,
    text: string,
    family: string,
    weight: number,
    preferred: number,
    minimum: number,
    maxWidth: number,
): number {
    for (let size = preferred; size >= minimum; size -= 1) {
        setFont(ctx, family, weight, size);
        if (ctx.measureText(text).width <= maxWidth) return size;
    }
    return minimum;
}

function fitTrackedLabel(
    ctx: OverlayContext2D,
    text: string,
    family: string,
    preferredSize: number,
    minimumSize: number,
    requestedSpacing: number,
    maxWidth: number,
): { size: number; spacing: number; trackedWidth: number; canTrack: boolean } {
    let size = preferredSize;
    while (size >= minimumSize) {
        setFont(ctx, family, 600, size);
        const trackedWidth = measureTrackedTextWidth(ctx, text, requestedSpacing, size);
        if (trackedWidth <= maxWidth) {
            return { size, spacing: requestedSpacing, trackedWidth, canTrack: true };
        }
        size -= 1;
    }

    size = minimumSize;
    setFont(ctx, family, 600, size);
    const trackedWidth = measureTrackedTextWidth(ctx, text, 0, size);
    return {
        size,
        spacing: 0,
        trackedWidth,
        canTrack: trackedWidth <= maxWidth,
    };
}

export function drawCinematicBar(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: ResolutionTuning,
): void {
    const items = toStandardMetricItems(data, {
        pace: { label: 'PACE', unit: 'min/km' },
        heartRate: { label: 'HR', unit: 'bpm' },
        distance: { label: 'DIST', unit: 'km' },
        time: { label: 'TIME', unit: '' },
        power: { label: 'POWER', unit: 'W' },
    }, ['pace', 'heartRate', 'distance', 'time', 'power']);
    if (items.length === 0 || w <= 0 || h <= 0) return;

    const family = config.fontFamily || '"Barlow Semi Condensed", sans-serif';
    const fontScale = clamp((config.fontSizePercent ?? 1.85) / 1.85, 0.7, 1.4);
    const labelScale = clamp((config.labelSizeMultiplier ?? 0.48) / 0.48, 0.75, 1.3);
    const valueScale = clamp((config.valueSizeMultiplier ?? 1.05) / 1.05, 0.75, 1.3);
    const labelWeight = 600;
    const valueWeight = fontWeightValue(config.valueFontWeight || 'bold');
    const showLabels = config.labelStyle !== 'hidden';
    const labelBaseSize = Math.max(9, Math.round(
        orientation.shortSide * 0.019 * tuning.textScale * fontScale * labelScale,
    ));
    const valueBaseSize = Math.max(12, Math.round(
        orientation.shortSide * 0.031 * tuning.textScale * fontScale * valueScale,
    ));
    const unitBaseSize = Math.max(8, Math.round(labelBaseSize * 0.78));
    const minimumLabelSize = Math.max(9, Math.round(labelBaseSize * 0.78));
    const minimumValueSize = Math.max(9, Math.round(valueBaseSize * 0.72));
    const lineSpacing = clamp(config.lineSpacing ?? 1.15, 0.9, 1.6) / 1.15;
    const unitGap = Math.max(2, Math.round(orientation.shortSide * 0.006 * lineSpacing));
    const rowGap = Math.max(2, Math.round(orientation.shortSide * 0.004 * lineSpacing));
    const bottomPadding = Math.max(3, Math.round(orientation.shortSide * 0.008));
    const segmentWidth = Math.max(1, (w - orientation.safePad * 2) / items.length);
    const columnInset = Math.min(Math.max(2, orientation.shortSide * 0.012), segmentWidth * 0.12);
    const maxTextWidth = Math.max(1, segmentWidth - columnInset * 2);
    const unitSpacing = Math.min(unitGap, maxTextWidth * 0.08);
    const unitSize = fitFontSize(
        ctx, 'MIN/KM', family, 500, unitBaseSize, Math.max(7, Math.round(unitBaseSize * 0.75)), maxTextWidth,
    );
    const unitWidth = (unit: string): number => {
        setFont(ctx, family, 500, unitSize);
        return ctx.measureText(unit).width;
    };
    const valueWidth = (value: string, size: number): number => {
        setFont(ctx, family, valueWeight, size);
        return ctx.measureText(value).width;
    };
    const requestedTracking = clamp(
        (config.labelLetterSpacing ?? 0.16) * tuning.labelTrackingScale,
        0,
        0.24,
    );
    const preparedItems = items.map((item) => {
        let valueSize: number;
        let unitPlacement: 'inline' | 'row' | 'none' = 'none';

        if (item.unit) {
            const inlineValueWidth = maxTextWidth - unitSpacing - unitWidth(item.unit);
            let candidateSize = valueBaseSize;
            while (candidateSize > minimumValueSize && valueWidth(item.value, candidateSize) > inlineValueWidth) {
                candidateSize -= 1;
            }
            if (inlineValueWidth > 0 && valueWidth(item.value, candidateSize) <= inlineValueWidth) {
                valueSize = candidateSize;
                unitPlacement = 'inline';
            } else {
                valueSize = fitFontSize(
                    ctx, item.value, family, valueWeight, valueBaseSize, minimumValueSize, maxTextWidth,
                );
                unitPlacement = 'row';
            }
        } else {
            valueSize = fitFontSize(
                ctx, item.value, family, valueWeight, valueBaseSize, minimumValueSize, maxTextWidth,
            );
        }

        const labelText = item.label;
        const label = showLabels
            ? fitTrackedLabel(ctx, labelText, family, labelBaseSize, minimumLabelSize, requestedTracking, maxTextWidth)
            : null;

        return { item, labelText, label, valueSize, unitPlacement };
    });

    const maxLabelSize = showLabels
        ? Math.max(...preparedItems.map(({ label }) => label?.size ?? 0))
        : 0;
    const maxValueSize = Math.max(...preparedItems.map(({ valueSize }) => valueSize));
    const hasUnitRow = preparedItems.some(({ unitPlacement }) => unitPlacement === 'row');
    const contentHeight = maxLabelSize
        + maxValueSize
        + (hasUnitRow ? unitSize : 0)
        + rowGap * (Number(showLabels) + Number(hasUnitRow));
    const topLabelSize = Math.max(11, Math.round(
        orientation.shortSide * 0.015 * tuning.textScale * fontScale,
    ));
    const topPadding = Math.max(2, Math.round(orientation.shortSide * 0.008));
    const topBar = Math.min(
        h * 0.18,
        Math.max(
            Math.round(h * (orientation.isPortrait ? 0.075 : 0.06)),
            topLabelSize + topPadding * 2,
        ),
    );
    const bottomBar = Math.min(
        h - topBar,
        Math.max(
            Math.round(h * (orientation.isPortrait ? 0.1 : 0.085)),
            contentHeight + bottomPadding * 2,
        ),
    );
    const bottomTop = h - bottomBar;
    const contentTop = bottomTop + Math.max(bottomPadding, (bottomBar - contentHeight) / 2);
    const labelY = contentTop + maxLabelSize / 2;
    const valueY = contentTop + maxLabelSize + (showLabels ? rowGap : 0) + maxValueSize / 2;
    const unitY = contentTop + maxLabelSize + (showLabels ? rowGap : 0)
        + maxValueSize + rowGap + unitSize / 2;

    ctx.fillStyle = `rgba(0,0,0,${clamp(config.backgroundOpacity ?? 0.6, 0, 1)})`;
    ctx.fillRect(0, 0, w, topBar);
    ctx.fillRect(0, bottomTop, w, bottomBar);

    const headerY = topBar / 2;
    ctx.textBaseline = 'middle';
    const headerText = ['SESSION DATA', 'GPX TELEMETRY'] as const;
    setFont(ctx, family, 500, topLabelSize);
    ctx.fillStyle = 'rgba(255,255,255,0.84)';
    ctx.textAlign = 'left';
    const headerGap = Math.max(8, orientation.shortSide * 0.02);
    const headerAvailableWidth = w - orientation.safePad * 2;
    const leftWidth = ctx.measureText(headerText[0]).width;
    const rightWidth = ctx.measureText(headerText[1]).width;
    if (leftWidth + rightWidth + headerGap <= headerAvailableWidth) {
        ctx.fillText(headerText[0], orientation.safePad, headerY, headerAvailableWidth / 2 - headerGap / 2);
        ctx.textAlign = 'right';
        ctx.fillText(headerText[1], w - orientation.safePad, headerY, headerAvailableWidth / 2 - headerGap / 2);
    } else {
        ctx.textAlign = 'center';
        ctx.fillText(headerText[1], w / 2, headerY, headerAvailableWidth);
    }

    const separatorTop = bottomTop + bottomPadding;
    const separatorBottom = h - bottomPadding;
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = config.accentColor || '#FFFFFF';
    ctx.lineWidth = Math.max(1, orientation.shortSide / 720);
    for (let i = 1; i < items.length; i++) {
        const x = orientation.safePad + segmentWidth * i;
        ctx.beginPath();
        ctx.moveTo(x, separatorTop);
        ctx.lineTo(x, Math.max(separatorTop, separatorBottom));
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    preparedItems.forEach(({ item, label, labelText, valueSize, unitPlacement }, index) => {
        const x = orientation.safePad + segmentWidth * index + segmentWidth / 2;
        const valueMaxWidth = unitPlacement === 'inline'
            ? maxTextWidth - unitSpacing - unitWidth(item.unit ?? '')
            : maxTextWidth;

        if (label) {
            ctx.fillStyle = 'rgba(255,255,255,0.84)';
            setFont(ctx, family, labelWeight, label.size);
            if (label.canTrack) {
                ctx.textAlign = 'left';
                drawTrackedText(
                    ctx,
                    labelText,
                    x - label.trackedWidth / 2,
                    labelY,
                    label.spacing,
                    label.size,
                );
            } else {
                ctx.textAlign = 'center';
                ctx.fillText(labelText, x, labelY, maxTextWidth);
            }
        }

        ctx.fillStyle = config.textColor || '#FFFFFF';
        setFont(ctx, family, valueWeight, valueSize);
        ctx.textAlign = unitPlacement === 'inline' ? 'left' : 'center';
        const fittedValueWidth = Math.min(ctx.measureText(item.value).width, valueMaxWidth);
        const unitTextWidth = unitPlacement === 'inline' ? unitWidth(item.unit ?? '') : 0;
        setFont(ctx, family, valueWeight, valueSize);
        const valueX = unitPlacement === 'inline'
            ? x - (fittedValueWidth + unitSpacing + unitTextWidth) / 2
            : x;
        ctx.fillText(item.value, valueX, valueY, valueMaxWidth);

        if (unitPlacement === 'inline') {
            ctx.fillStyle = 'rgba(255,255,255,0.84)';
            setFont(ctx, family, 500, unitSize);
            ctx.fillText(item.unit ?? '', valueX + fittedValueWidth + unitSpacing, valueY, unitWidth(item.unit ?? ''));
        } else if (unitPlacement === 'row') {
            ctx.fillStyle = 'rgba(255,255,255,0.84)';
            setFont(ctx, family, 500, unitSize);
            ctx.textAlign = 'center';
            ctx.fillText(item.unit ?? '', x, unitY, maxTextWidth);
        }
    });
}
