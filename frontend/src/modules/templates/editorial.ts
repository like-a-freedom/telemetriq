/**
 * Editorial template - Magazine-inspired serif hero pace with small side stats.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const editorialTemplate = defineTemplate({
  id: 'editorial',
  metadata: {
    name: 'Editorial',
    description: 'A serif pace headline with quiet side statistics',
    previewColors: { bg: '#121212', accent: '#d1d5db', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'editorial',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.1,
    fontFamily: '"Georgia", "Times New Roman", serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowBlur: 0,
    lineSpacing: 1.1,
    layout: 'vertical',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'normal',
    valueSizeMultiplier: 2.2,
    labelSizeMultiplier: 0.34,
    labelLetterSpacing: 0.12,
    accentColor: '#e5e7eb',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsBackgroundOpacity: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: true,
    supportsAccentColor: false,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: '"Georgia", "Times New Roman", serif',
      valueFontWeight: 'normal',
      labelFontWeight: 'medium',
      valueSizeMultiplier: 2.2,
      labelSizeMultiplier: 0.34,
      labelLetterSpacing: 0.12,
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.1,
    },
    visual: {
      textShadow: true,
      textShadowBlur: 0,
      labelStyle: 'uppercase',
    },
  },
});
