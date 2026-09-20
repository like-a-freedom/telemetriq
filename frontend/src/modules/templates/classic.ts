/**
 * Classic template - Simple positioned overlay with rounded rectangle background.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const classicTemplate = defineTemplate({
  id: 'classic',
  metadata: {
    name: 'Classic',
    description: 'Simple positioned overlay with rounded rectangle background',
    previewColors: { bg: '#000000', accent: '#646cff', text: '#ffffff' },
  },
  config: {
    layoutMode: 'box',
    position: 'top-right',
    backgroundOpacity: 0,
    fontSizePercent: 3.0,
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
    iconStyle: 'outline',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'hidden',
    valueFontWeight: 'bold',
    accentColor: '#646cff',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
  },
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'bold',
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.5,
    },
    visual: {
      cornerRadius: 4,
      textShadowBlur: 2,
      iconStyle: 'outline',
      labelStyle: 'hidden',
    },
  },
});
