/**
 * Whisper template - Quiet corner metrics without a backdrop panel.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const whisperTemplate = defineTemplate({
  id: 'whisper',
  metadata: {
    name: 'Whisper',
    description: 'Quiet corner telemetry with clear labels and no backdrop',
    previewColors: { bg: '#101218', accent: '#9ca3af', text: '#e5e7eb' },
  },
  config: {
    layoutMode: 'whisper',
    position: 'bottom-right',
    backgroundOpacity: 0,
    fontSizePercent: 4.2,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: 'rgba(255,255,255,0.94)',
    backgroundColor: 'transparent',
    lineSpacing: 1.05,
    layout: 'vertical',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowBlur: 2,
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'normal',
    valueSizeMultiplier: 1.0,
    labelSizeMultiplier: 0.62,
    labelLetterSpacing: 0.08,
    accentColor: '#9ca3af',
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
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'normal',
      valueSizeMultiplier: 1.0,
      labelSizeMultiplier: 0.62,
      labelLetterSpacing: 0.08,
    },
    spacing: {
      basePaddingPercent: 0.03,
      metricGapPercent: 0.01,
      lineSpacing: 1.05,
    },
    visual: {
      textShadow: true,
      textShadowBlur: 2,
      labelStyle: 'uppercase',
    },
  },
});
