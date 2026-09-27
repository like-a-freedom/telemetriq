/**
 * L-Frame template - Minimalist L-shaped frame with clean metric alignment.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const lframeTemplate = defineTemplate({
  id: 'l-frame',
  metadata: {
    name: 'L-Frame',
    description: 'A light corner rule with balanced metric rows',
    previewColors: { bg: '#1a1a2e', accent: '#ffffff', text: '#f0f0f0' },
  },
  config: {
    layoutMode: 'corner-frame',
    position: 'bottom-left',
    backgroundOpacity: 0.0,
    fontSizePercent: 2.0,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowBlur: 0,
    lineSpacing: 1.15,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'normal',
    valueSizeMultiplier: 3.0,
    labelSizeMultiplier: 0.52,
    labelLetterSpacing: 0.12,
    accentColor: '#ffffff',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsBackgroundOpacity: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: true,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'medium',
      labelFontWeight: 'semibold',
      valueSizeMultiplier: 3,
      labelSizeMultiplier: 0.52,
      labelLetterSpacing: 0.12,
    },
    spacing: {
      basePaddingPercent: 0.065,
      metricGapPercent: 0.035,
      lineSpacing: 1.15,
    },
    visual: {
      textShadow: true,
      textShadowBlur: 0,
      labelStyle: 'uppercase',
    },
  },
});
