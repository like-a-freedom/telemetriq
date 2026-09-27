/**
 * Horizon template - Bottom bar with gradient overlay and horizontal metric layout.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const horizonTemplate = defineTemplate({
  id: 'horizon',
  metadata: {
    name: 'Horizon',
    description: 'A clear metric grid over a fading bottom edge',
    previewColors: { bg: '#0a0a0a', accent: '#ffffff', text: '#ffffff' },
  },
  config: {
    layoutMode: 'bottom-bar',
    position: 'bottom-left',
    backgroundOpacity: 0.85,
    fontSizePercent: 2.4,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    textShadowColor: '#000000',
    lineSpacing: 1.2,
    layout: 'horizontal',
    gradientBackground: true,
    gradientStartColor: 'rgba(0,0,0,0)',
    gradientEndColor: 'rgba(0,0,0,0.9)',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.5,
    labelSizeMultiplier: 0.52,
    labelLetterSpacing: 0.15,
    accentColor: '#FFFFFF',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsBorder: false,
    supportsTextShadow: false,
    supportsAccentColor: false,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'bold',
      labelFontWeight: 'semibold',
      valueSizeMultiplier: 2.5,
      labelSizeMultiplier: 0.52,
      labelLetterSpacing: 0.15,
    },
    spacing: {
      basePaddingPercent: 0.045,
      metricGapPercent: 0.035,
      lineSpacing: 1.2,
    },
    visual: {
      textShadow: false,
      labelStyle: 'uppercase',
    },
  },
});
