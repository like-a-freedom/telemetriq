import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const sportsBroadcastTemplate = defineTemplate({
  id: 'sports-broadcast',
  metadata: {
    name: 'Sports Broadcast',
    description: 'TV lower-third: orange accent line + RUN label, orange metric labels, large values',
    previewColors: { bg: '#000000', accent: '#f97316', text: '#ffffff' },
  },
  config: {
    layoutMode: 'sports-broadcast',
    position: 'bottom-left',
    backgroundOpacity: 0.88,
    fontSizePercent: 2.0,
    fontFamily: '"Space Grotesk", Inter, -apple-system, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.88)',
    lineSpacing: 1.0,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'light',
    valueSizeMultiplier: 1.6,
    labelSizeMultiplier: 0.38,
    labelLetterSpacing: 0.2,
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
