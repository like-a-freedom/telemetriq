/**
 * Ticker Tape template - Live ticker strip at the bottom edge.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const tickerTapeTemplate = defineTemplate({
  id: 'ticker-tape',
  metadata: {
    name: 'Ticker Tape',
    description: 'Compact telemetry strip along the bottom edge',
    previewColors: { bg: '#0a0a0a', accent: '#ef4444', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'ticker-tape',
    position: 'bottom-left',
    backgroundOpacity: 0.95,
    fontSizePercent: 4.2,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    lineSpacing: 1.2,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.0,
    labelSizeMultiplier: 0.55,
    labelLetterSpacing: 0.08,
    accentColor: '#ef4444',
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
      valueFontWeight: 'bold',
      valueSizeMultiplier: 1.0,
      labelSizeMultiplier: 0.55,
      labelLetterSpacing: 0.08,
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.2,
    },
    visual: {
      labelStyle: 'uppercase',
    },
  },
});
