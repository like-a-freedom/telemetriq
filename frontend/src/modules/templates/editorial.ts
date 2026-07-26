/**
 * Editorial template - Magazine-inspired serif hero pace with small side stats.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const editorialTemplate = defineTemplate({
  id: 'editorial',
  metadata: {
    name: 'Editorial',
    description: 'Magazine-inspired serif hero pace with small side stats',
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
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowBlur: 3,
    lineSpacing: 1.1,
    layout: 'vertical',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'normal',
    valueSizeMultiplier: 2.2,
    labelSizeMultiplier: 0.34,
    labelLetterSpacing: 0.2,
    accentColor: '#e5e7eb',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportsPosition: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: true,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      valueFontWeight: 'normal',
      valueSizeMultiplier: 2.0,
      labelSizeMultiplier: 0.4,
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.2,
    },
    visual: {
      textShadow: true,
      textShadowBlur: 3,
      labelStyle: 'uppercase',
    },
  },
});
