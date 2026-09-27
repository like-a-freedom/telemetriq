/**
 * Swiss Grid template - Structured typographic grid with fine, open dividers.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const swissGridTemplate = defineTemplate({
  id: 'swiss-grid',
  metadata: {
    name: 'Swiss Grid',
    description: 'A precise typographic grid with compact metric columns',
    previewColors: { bg: '#0b1118', accent: '#d1d5db', text: '#ffffff' },
  },
  config: {
    layoutMode: 'swiss-grid',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#ffffff',
    backgroundColor: '#0b1118',
    lineSpacing: 1.15,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.1,
    labelSizeMultiplier: 0.62,
    labelLetterSpacing: 0.08,
    accentColor: '#d1d5db',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.82)',
    textShadowBlur: 2,
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time'],
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
      valueFontWeight: 'bold',
      labelFontWeight: 'medium',
      valueSizeMultiplier: 1.1,
      labelSizeMultiplier: 0.62,
      labelLetterSpacing: 0.08,
    },
    spacing: {
      basePaddingPercent: 0.03,
      metricGapPercent: 0.02,
      lineSpacing: 1.15,
    },
    visual: {
      textShadow: true,
      textShadowBlur: 2,
      labelStyle: 'uppercase',
    },
  },
});
