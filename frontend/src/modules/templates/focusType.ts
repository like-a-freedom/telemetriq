import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

const INTER_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const focusTypeTemplate = defineTemplate({
  id: 'focus-type',
  metadata: {
    name: 'Focus Type',
    description: 'A clear pace-first type hierarchy with a low-noise row of supporting metrics',
    previewColors: { bg: '#101820', accent: '#f97316', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'focus-type',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    fontFamily: INTER_FONT,
    textColor: '#f8fafc',
    backgroundColor: 'transparent',
    textShadow: false,
    textShadowColor: 'transparent',
    textShadowBlur: 0,
    lineSpacing: 1.15,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.35,
    labelSizeMultiplier: 0.42,
    labelLetterSpacing: 0.06,
    accentColor: '#f97316',
    showPower: true,
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsBackgroundOpacity: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: false,
    supportsAccentColor: true,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: INTER_FONT,
      valueFontWeight: 'bold',
      labelFontWeight: 'normal',
      valueSizeMultiplier: 2.35,
      labelSizeMultiplier: 0.42,
      labelLetterSpacing: 0.06,
    },
    spacing: {
      basePaddingPercent: 0.025,
      metricGapPercent: 0.018,
      lineSpacing: 1.15,
    },
    visual: {
      cornerRadius: 0,
      borderWidth: 0,
      textShadow: false,
      textShadowBlur: 0,
      labelStyle: 'uppercase',
    },
  },
});
