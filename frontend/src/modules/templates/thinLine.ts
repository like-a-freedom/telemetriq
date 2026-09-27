/**
 * Thin Line template - a fine baseline with compact, readable telemetry.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const thinLineTemplate = defineTemplate({
  id: 'thin-line',
  metadata: {
    name: 'Thin Line',
    description: 'A fine telemetry baseline with clear values and units',
    previewColors: { bg: '#0f172a', accent: '#cbd5e1', text: '#ffffff' },
  },
  config: {
    layoutMode: 'thin-line',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#ffffff',
    backgroundColor: 'transparent',
    lineSpacing: 1.15,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'hidden',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1,
    labelSizeMultiplier: 0.52,
    labelLetterSpacing: 0.06,
    accentColor: '#cbd5e1',
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
      valueSizeMultiplier: 1,
      labelSizeMultiplier: 0.52,
      labelLetterSpacing: 0.06,
    },
    spacing: {
      basePaddingPercent: 0.03,
      metricGapPercent: 0.01,
      lineSpacing: 1.15,
    },
    visual: {
      textShadow: true,
      textShadowBlur: 2,
      labelStyle: 'hidden',
    },
  },
});
