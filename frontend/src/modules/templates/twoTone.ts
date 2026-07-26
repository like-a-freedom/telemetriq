/**
 * Two Tone template - High-contrast split typography with accent pace.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const twoToneTemplate = defineTemplate({
  id: 'two-tone',
  metadata: {
    name: 'Two Tone',
    description: 'High-contrast split typography with accent pace',
    previewColors: { bg: '#050505', accent: '#c8ff00', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'two-tone',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowBlur: 8,
    lineSpacing: 1.1,
    layout: 'vertical',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.4,
    labelSizeMultiplier: 0.36,
    labelLetterSpacing: 0.22,
    accentColor: '#c8ff00',
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
      textShadowBlur: 8,
      labelStyle: 'uppercase',
    },
  },
});
