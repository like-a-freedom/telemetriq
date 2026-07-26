import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const arcGaugeTemplate = defineTemplate({
    id: 'arc-gauge',
    metadata: {
        name: 'Arc Gauge',
        description: 'Pace-focused arc gauge with secondary side metrics',
        previewColors: { bg: '#0a0f1f', accent: '#ffffff', text: '#e5e7eb' },
    },
    config: {
        layoutMode: 'arc-gauge',
        position: 'top-left',
        backgroundOpacity: 0,
        fontSizePercent: 2.2,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
        accentColor: '#ffffff',
    },
    capabilities: {
        ...DEFAULT_CAPABILITIES,
        supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
        supportsPosition: false,
        supportsGradient: false,
        supportsBorder: false,
        supportsTextShadow: true,
        supportsLayoutDirection: false,
    },
});
