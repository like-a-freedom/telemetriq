/**
 * Soft Rounded template - Rounded soft cards with gentle contrast.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const softRoundedTemplate = defineTemplate({
  id: 'soft-rounded',
  metadata: {
    name: 'Soft Rounded',
    description: 'Rounded telemetry cards with a clear pace accent',
    previewColors: { bg: '#f8fafc', accent: '#fb7185', text: '#111827' },
  },
  config: {
    layoutMode: 'soft-rounded',
    position: 'bottom-left',
    backgroundOpacity: 0.92,
    fontSizePercent: 2.8,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#111827',
    backgroundColor: '#F8FAFC',
    cornerRadius: 16,
    lineSpacing: 0.9,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#ffffff',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.1,
    labelSizeMultiplier: 0.68,
    labelLetterSpacing: 0.08,
    accentColor: '#fb7185',
    textShadow: false,
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time'],
    supportsPosition: false,
    supportsBackgroundOpacity: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: false,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'bold',
      labelFontWeight: 'medium',
      valueSizeMultiplier: 1.1,
      labelSizeMultiplier: 0.68,
      labelLetterSpacing: 0.08,
    },
    spacing: {
      basePaddingPercent: 0.03,
      metricGapPercent: 0.01,
      lineSpacing: 0.9,
    },
    visual: {
      cornerRadius: 16,
      textShadow: false,
      labelStyle: 'uppercase',
    },
  },
});
