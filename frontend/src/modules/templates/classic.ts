/**
 * Classic template - Simple positioned overlay with rounded rectangle background.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const classicTemplate = defineTemplate({
  id: 'classic',
  metadata: {
    name: 'Classic',
    description: 'Plain-text metric rows in a compact corner block',
    previewColors: { bg: '#000000', accent: '#ffffff', text: '#ffffff' },
  },
  config: {
    layoutMode: 'box',
    position: 'top-right',
    backgroundOpacity: 0,
    fontSizePercent: 3.5,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    cornerRadius: 4,
    textShadowBlur: 2,
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.85)',
    lineSpacing: 1.5,
    layout: 'vertical',
    iconStyle: 'none',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.5,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0,
    accentColor: '#FFFFFF',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsAccentColor: false,
  },
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'semibold',
      labelFontWeight: 'semibold',
      valueSizeMultiplier: 2.5,
      labelSizeMultiplier: 0.5,
      labelLetterSpacing: 0,
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.5,
    },
    visual: {
      cornerRadius: 4,
      textShadow: true,
      textShadowBlur: 2,
      iconStyle: 'none',
      labelStyle: 'uppercase',
    },
  },
});
