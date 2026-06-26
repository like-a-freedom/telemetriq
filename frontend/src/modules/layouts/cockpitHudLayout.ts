import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';

export function drawCockpitHud(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    _tuning: { textScale: number },
): void {
    const accent = config.accentColor || '#ff7a1a';
    const pad = orientation.safePad;
    const compact = orientation.compactPad;
    const panelW = w - pad * 2;
    const panelH = Math.round(orientation.shortSide * (orientation.isPortrait ? 0.25 : 0.21));
    const panelX = pad;
    const panelY = h - pad - panelH;
    const radius = Math.max(18, Math.round(panelH * 0.18));
    const innerPad = Math.max(16, Math.round(panelH * 0.16));

    const chipH = Math.max(18, Math.round(orientation.shortSide * 0.045));
    const chipRadius = Math.round(chipH / 2);

    ctx.fillStyle = 'rgba(5,10,18,0.36)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, radius);
    ctx.fill();

    const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    panelGrad.addColorStop(0, 'rgba(13,19,30,0.88)');
    panelGrad.addColorStop(1, 'rgba(7,10,18,0.58)');
    ctx.fillStyle = panelGrad;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, radius);
    ctx.stroke();

    const dividerY = panelY + Math.round(panelH * 0.38);
    const divider = ctx.createLinearGradient(panelX, dividerY, panelX + panelW, dividerY);
    divider.addColorStop(0, 'rgba(255,122,26,0)');
    divider.addColorStop(0.18, 'rgba(255,122,26,0.28)');
    divider.addColorStop(0.82, 'rgba(255,122,26,0.28)');
    divider.addColorStop(1, 'rgba(255,122,26,0)');
    ctx.strokeStyle = divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + innerPad, dividerY);
    ctx.lineTo(panelX + panelW - innerPad, dividerY);
    ctx.stroke();

    const statusWidth = Math.max(108, Math.round(panelW * 0.17));
    ctx.fillStyle = 'rgba(255,122,26,0.14)';
    ctx.beginPath();
    ctx.roundRect(panelX + innerPad, panelY + innerPad * 0.55, statusWidth, chipH, chipRadius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,122,26,0.28)';
    ctx.beginPath();
    ctx.roundRect(panelX + innerPad, panelY + innerPad * 0.55, statusWidth, chipH, chipRadius);
    ctx.stroke();

    const dotR = Math.max(3, Math.round(chipH * 0.16));
    const dotY = panelY + innerPad * 0.55 + chipH / 2;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(panelX + innerPad + chipH * 0.52, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,232,219,0.82)';
    ctx.font = `600 ${Math.max(8, Math.round(chipH * 0.34))}px ${config.fontFamily}`;
    ctx.fillText('SYSTEM ACTIVE', panelX + innerPad + chipH * 0.9, dotY);

    if (data.time) {
        const timeX = panelX + panelW - innerPad;
        const timeLabelSize = Math.max(8, Math.round(panelH * 0.08));
        const timeValueSize = Math.max(14, Math.round(panelH * 0.16));
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(170,182,201,0.7)';
        ctx.font = `600 ${timeLabelSize}px ${config.fontFamily}`;
        ctx.fillText('ELAPSED', timeX, panelY + innerPad + timeLabelSize * 0.95);
        ctx.fillStyle = 'rgba(247,250,255,0.94)';
        ctx.font = `700 ${timeValueSize}px ${config.fontFamily}`;
        ctx.fillText(data.time, timeX, panelY + innerPad + timeLabelSize + timeValueSize * 1.08);
    }

    const bottomTop = dividerY + compact * 1.2;
    const bottomHeight = panelY + panelH - innerPad - bottomTop;
    const paceWidth = data.pace ? panelW * (orientation.isPortrait ? 0.46 : 0.42) : 0;

    if (data.pace) {
        const paceX = panelX + innerPad;
        const paceValueSize = Math.max(34, Math.round(bottomHeight * (orientation.isPortrait ? 0.74 : 0.82)));
        const paceLabelSize = Math.max(9, Math.round(paceValueSize * 0.16));
        const paceUnitSize = Math.max(8, Math.round(paceValueSize * 0.2));
        const paceBaseline = panelY + panelH - innerPad * 0.6;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(162,176,197,0.72)';
        ctx.font = `700 ${paceLabelSize}px ${config.fontFamily}`;
        ctx.fillText('PACE', paceX, bottomTop + paceLabelSize);
        ctx.fillStyle = config.textColor || '#FFFFFF';
        ctx.font = `800 ${paceValueSize}px ${config.fontFamily}`;
        ctx.fillText(data.pace, paceX, paceBaseline);
        ctx.fillStyle = accent;
        ctx.font = `600 ${paceUnitSize}px ${config.fontFamily}`;
        ctx.fillText('MIN / KM', paceX, paceBaseline + paceUnitSize * 1.2);
    }

    const secondaryItems = [
        data.distance ? { label: 'DISTANCE', value: data.distance, unit: 'km' } : null,
        data.heartRate ? { label: 'HEART RATE', value: data.heartRate, unit: 'bpm' } : null,
        !data.pace && data.time ? { label: 'ELAPSED', value: data.time, unit: '' } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; unit: string }>;

    if (secondaryItems.length > 0) {
        const secondaryX = panelX + innerPad + paceWidth + (data.pace ? innerPad : 0);
        const secondaryW = panelX + panelW - innerPad - secondaryX;
        const cardGap = Math.max(10, Math.round(panelW * 0.014));
        const cardW = secondaryItems.length === 1
            ? secondaryW
            : (secondaryW - cardGap * (secondaryItems.length - 1)) / secondaryItems.length;
        const cardH = Math.max(54, Math.round(bottomHeight * 0.94));
        const cardY = panelY + panelH - innerPad - cardH;

        secondaryItems.forEach((item, index) => {
            const cardX = secondaryX + index * (cardW + cardGap);
            const cardRadius = Math.max(14, Math.round(cardH * 0.22));
            const labelSize = Math.max(8, Math.round(cardH * 0.13));
            const valueSize = Math.max(18, Math.round(cardH * 0.28));
            const unitSize = Math.max(8, Math.round(cardH * 0.12));

            ctx.fillStyle = 'rgba(255,255,255,0.045)';
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
            ctx.fill();
            ctx.strokeStyle = index === secondaryItems.length - 1 && item.label === 'HEART RATE'
                ? 'rgba(255,122,26,0.22)'
                : 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = 'rgba(170,182,201,0.74)';
            ctx.font = `700 ${labelSize}px ${config.fontFamily}`;
            ctx.fillText(item.label, cardX + innerPad * 0.55, cardY + labelSize + innerPad * 0.45);

            ctx.fillStyle = config.textColor || '#FFFFFF';
            ctx.font = `700 ${valueSize}px ${config.fontFamily}`;
            ctx.fillText(item.value, cardX + innerPad * 0.55, cardY + cardH * 0.72);

            if (item.unit) {
                ctx.fillStyle = item.label === 'HEART RATE' ? accent : 'rgba(255,255,255,0.42)';
                ctx.font = `600 ${unitSize}px ${config.fontFamily}`;
                ctx.fillText(item.unit.toUpperCase(), cardX + innerPad * 0.55, cardY + cardH - innerPad * 0.35);
            }

            if (item.label === 'HEART RATE') {
                const hrVal = parseInt(item.value, 10);
                const hrPercent = Math.min(1, Math.max(0, hrVal / 200));
                const bars = 10;
                const barW = Math.max(3, Math.round(cardW * 0.035));
                const barGap = Math.max(2, Math.round(barW * 0.6));
                const barsAreaW = bars * barW + (bars - 1) * barGap;
                const barsX = cardX + cardW - innerPad * 0.55 - barsAreaW;
                const barsBaseY = cardY + cardH - innerPad * 0.6;
                const maxBarH = Math.max(12, Math.round(cardH * 0.26));

                for (let i = 0; i < bars; i++) {
                    const barH = Math.round(maxBarH * (0.35 + Math.abs(Math.sin(i * 0.9)) * 0.65));
                    ctx.fillStyle = (i + 1) / bars <= hrPercent ? accent : 'rgba(255,255,255,0.12)';
                    ctx.beginPath();
                    ctx.roundRect(barsX + i * (barW + barGap), barsBaseY - barH, barW, barH, Math.min(barW / 2, 2));
                    ctx.fill();
                }
            }
        });
    }
}