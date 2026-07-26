import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const focusTypeTemplate = defineTemplate({
  id: 'focus-type',
  metadata: {
    name: 'Focus Type',
    description: 'Editorial hero pace with refined secondary metric row and graceful fallback when pace is hidden',
    previewColors: { bg: '#030303', accent: '#FFFFFF', text: '#FFFFFF' },
  },
  config: {
    layoutMode: 'focus-type',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    fontFamily: '"Instrument Serif", "Iowan Old Style", Georgia, serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowBlur: 24,
    lineSpacing: 1.0,
    layout: 'vertical',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.35,
    labelSizeMultiplier: 0.32,
    labelLetterSpacing: 0.32,
    accentColor: '#FFFFFF',
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
