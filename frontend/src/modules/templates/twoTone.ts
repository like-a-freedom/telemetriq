/**
 * Two Tone template - High-contrast split typography with accent pace.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const twoToneTemplate = defineTemplate({
  id: 'two-tone',
  metadata: {
    name: 'Two Tone',
    description: 'Accent pace with essential metrics in a balanced side column',
    previewColors: { bg: '#050505', accent: '#c8ff00', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'two-tone',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.82)',
    textShadowBlur: 2,
    lineSpacing: 1.1,
    layout: 'vertical',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.4,
    labelSizeMultiplier: 0.44,
    labelLetterSpacing: 0.1,
    accentColor: '#c8ff00',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time'],
    supportsPosition: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: true,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'bold',
      valueSizeMultiplier: 2.4,
      labelSizeMultiplier: 0.44,
      labelLetterSpacing: 0.1,
    },
    spacing: {
      basePaddingPercent: 0.03,
      metricGapPercent: 0.01,
      lineSpacing: 1.1,
    },
    visual: {
      textShadow: true,
      textShadowBlur: 2,
      labelStyle: 'uppercase',
    },
  },
});
