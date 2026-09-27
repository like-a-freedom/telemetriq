/**
 * Margin template - Large typography on left and right margins with vertical labels.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const marginTemplate = defineTemplate({
  id: 'margin',
  metadata: {
    name: 'Margin',
    description: 'Edge metrics with outward labels and a clear center',
    previewColors: { bg: '#111111', accent: '#ffffff', text: '#ffffff' },
  },
  config: {
    layoutMode: 'side-margins',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.0,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowBlur: 0,
    lineSpacing: 1.2,
    layout: 'vertical',
    labelStyle: 'uppercase',
    valueFontWeight: 'normal',
    valueSizeMultiplier: 3.5,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.12,
    accentColor: '#FFFFFF',
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
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'medium',
      labelFontWeight: 'semibold',
      valueSizeMultiplier: 3.5,
      labelSizeMultiplier: 0.5,
      labelLetterSpacing: 0.12,
    },
    spacing: {
      basePaddingPercent: 0.045,
      metricGapPercent: 0.015,
      lineSpacing: 1.2,
    },
    visual: {
      textShadow: true,
      textShadowBlur: 0,
      labelStyle: 'uppercase',
    },
  },
});
