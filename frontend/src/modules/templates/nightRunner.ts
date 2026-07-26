import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const nightRunnerTemplate = defineTemplate({
  id: 'night-runner',
  metadata: {
    name: 'Night Runner',
    description: 'Amber-glow pace top center + gradient strip with three color-glowing metrics at bottom',
    previewColors: { bg: '#050505', accent: '#fbbf24', text: '#fde68a' },
  },
  config: {
    layoutMode: 'night-runner',
    position: 'top-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.4,
    fontFamily: '"DM Sans", Inter, -apple-system, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(251,191,36,0.35)',
    textShadowBlur: 20,
    lineSpacing: 1.1,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'light',
    valueSizeMultiplier: 1.9,
    labelSizeMultiplier: 0.35,
    labelLetterSpacing: 0.3,
    accentColor: '#fbbf24',
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
