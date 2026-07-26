import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const garminStyleTemplate = defineTemplate({
  id: 'garmin-style',
  metadata: {
    name: 'Garmin Style',
    description: 'Circular arc HR gauge bottom-left + stacked orange-unit metrics on the right',
    previewColors: { bg: '#111827', accent: '#f97316', text: '#f3f4f6' },
  },
  config: {
    layoutMode: 'garmin-style',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    fontFamily: '"Space Grotesk", Inter, -apple-system, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowBlur: 8,
    lineSpacing: 1.1,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'light',
    valueSizeMultiplier: 1.8,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.18,
    accentColor: '#f97316',
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
