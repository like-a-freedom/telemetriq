import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const heroNumberTemplate = defineTemplate({
  id: 'hero-number',
  metadata: {
    name: 'Hero Number',
    description: 'Large pace number with compact secondary metrics',
    previewColors: { bg: '#111827', accent: '#f8fafc', text: '#ffffff' },
  },
  config: {
    layoutMode: 'hero-number',
    position: 'top-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.3,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowBlur: 14,
    lineSpacing: 1.1,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.8,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.25,
    accentColor: '#FFFFFF',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsLayoutDirection: false,
  },
});
