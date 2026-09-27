/**
 * Condensed Strip template - Dense horizontal strip for compact telemetry.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const condensedStripTemplate = defineTemplate({
  id: 'condensed-strip',
  metadata: {
    name: 'Condensed Strip',
    description: 'Four crisp telemetry values in a single light strip',
    previewColors: { bg: '#ffffff', accent: '#111111', text: '#111111' },
  },
  config: {
    layoutMode: 'condensed-strip',
    position: 'bottom-left',
    backgroundOpacity: 1,
    fontSizePercent: 2.8,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#111111',
    backgroundColor: '#FFFFFF',
    lineSpacing: 1,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#ffffff',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.15,
    labelSizeMultiplier: 0.48,
    labelLetterSpacing: 0.08,
    accentColor: '#111111',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time'],
    supportsPosition: false,
    supportsBackgroundOpacity: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: false,
    supportsAccentColor: false,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'bold',
      labelFontWeight: 'medium',
      valueSizeMultiplier: 1.15,
      labelSizeMultiplier: 0.48,
      labelLetterSpacing: 0.08,
    },
    spacing: {
      basePaddingPercent: 0.03,
      metricGapPercent: 0.01,
      lineSpacing: 1,
    },
    visual: {
      textShadow: false,
      labelStyle: 'uppercase',
    },
  },
});
