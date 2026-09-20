import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const arcGaugeTemplate = defineTemplate({
    id: 'arc-gauge',
    metadata: {
        name: 'Arc Gauge',
        description: 'Pace-focused arc gauge with secondary side metrics',
        previewColors: { bg: '#0a0f1f', accent: '#00e676', text: '#ffffff' },
    },
    config: {
        layoutMode: 'arc-gauge',
        position: 'top-left',
        backgroundOpacity: 0,
        fontSizePercent: 2.2,
        fontFamily: TRAIL_RUN_FONT_FAMILY,
        textColor: '#FFFFFF',
        backgroundColor: 'transparent',
        textShadow: true,
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowBlur: 6,
        lineSpacing: 1.1,
        layout: 'horizontal',
        labelStyle: 'uppercase',
        valueFontWeight: 'light',
        valueSizeMultiplier: 1.8,
        labelSizeMultiplier: 0.45,
        labelLetterSpacing: 0.18,
        accentColor: '#00E676',
    },
    capabilities: {
        ...DEFAULT_CAPABILITIES,
        supportedMetrics: ['pace', 'hr', 'distance', 'time'],
        supportsPosition: false,
        supportsGradient: false,
        supportsBorder: false,
        supportsTextShadow: true,
        supportsLayoutDirection: false,
    },
});
