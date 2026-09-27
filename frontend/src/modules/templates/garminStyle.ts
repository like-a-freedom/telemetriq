import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const garminStyleTemplate = defineTemplate({
  id: 'garmin-style',
  metadata: {
    name: 'Garmin Style',
    description: 'A compact heart-rate dial paired with a responsive grid of orange-accented metrics',
    previewColors: { bg: '#111827', accent: '#f97316', text: '#f3f4f6' },
  },
  config: {
    layoutMode: 'garmin-style',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.82)',
    textShadowBlur: 2,
    lineSpacing: 1.15,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.4,
    labelSizeMultiplier: 0.62,
    labelLetterSpacing: 0.08,
    accentColor: '#f97316',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
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
      valueSizeMultiplier: 1.4,
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
