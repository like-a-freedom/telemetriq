import type { ExtendedOverlayConfig } from '../../core/types';
import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import type { ResolutionTuning } from '../overlayUtils';
import type { OverlayContext2D } from '../overlayUtils';
import { parsePace } from '../layouts/shared';
import type { MetricMap, Orientation } from '../layouts/shared';

export const minimalRingTemplate = defineTemplate({
    id: 'minimal-ring',
    metadata: {
        name: 'Minimal Ring',
        description: 'Thin, elegant circular progress ring for pace, bottom-right',
        previewColors: { bg: '#050505', accent: '#FFFFFF', text: '#FFFFFF' },
    },
    config: {
        layoutMode: 'minimal-ring',
        position: 'bottom-right',
        backgroundOpacity: 0,
        fontSizePercent: 2.0,
        showTime: false,
        fontFamily: '"Outfit", Inter, -apple-system, sans-serif',
        textColor: '#FFFFFF',
        backgroundColor: 'transparent',
        lineSpacing: 1.0,
        layout: 'vertical',
        labelStyle: 'uppercase',
        valueFontWeight: 'light',
        valueSizeMultiplier: 1.6,
        labelSizeMultiplier: 0.32,
        labelLetterSpacing: 0.25,
        accentColor: '#FFFFFF',
    },
    capabilities: {
        ...DEFAULT_CAPABILITIES,
        supportedMetrics: ['pace', 'hr', 'distance', 'power'],
        requiredMetrics: ['pace'],
        supportsPosition: false,
        supportsBackgroundOpacity: false,
        supportsGradient: false,
        supportsBorder: false,
        supportsTextShadow: false,
        supportsAccentColor: false,
        supportsLayoutDirection: false,
        getMetricUnavailableReason: (metric) => {
            if (metric === 'time') {
                return 'Minimal Ring only supports Pace, Heart Rate, Distance, and Power';
            }
            return undefined;
        },
    },
    styles: {
        typography: {
            fontFamily: '"Outfit", Inter, -apple-system, sans-serif',
            valueFontWeight: 'light',
            valueSizeMultiplier: 1.6,
            labelSizeMultiplier: 0.32,
            labelLetterSpacing: 0.25,
        },
        visual: {
            labelStyle: 'uppercase',
        },
    },
});

/**
 * Draw the Minimal Ring template.
 * Standard draw*(ctx, data, w, h, config, orientation, tuning) contract —
 * matches the dispatcher in layouts/extendedLayouts.ts.
 */
export function drawMinimalRing(
    ctx: OverlayContext2D,
    data: MetricMap,
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    orientation: Orientation,
    tuning: ResolutionTuning,
): void {
    if (!data.pace) return;

    ctx.save();

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

    // Progress arc based on pace (3-10 min/km range)
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

    ctx.restore();
}
