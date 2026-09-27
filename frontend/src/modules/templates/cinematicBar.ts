import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const cinematicBarTemplate = defineTemplate({
  id: 'cinematic-bar',
  metadata: {
    name: 'Cinematic Bar',
    description: 'Letterbox bars with compact bottom telemetry strip',
    previewColors: { bg: '#000000', accent: '#ffffff', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'cinematic-bar',
    position: 'bottom-left',
    backgroundOpacity: 0.6,
    fontSizePercent: 1.85,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    lineSpacing: 1.15,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueSizeMultiplier: 1.05,
    labelSizeMultiplier: 0.48,
    labelLetterSpacing: 0.14,
    accentColor: '#FFFFFF',
  },
  styles: {
    typography: {
      fontFamily: TRAIL_RUN_FONT_FAMILY,
      valueFontWeight: 'bold',
      labelFontWeight: 'semibold',
      valueSizeMultiplier: 1.05,
      labelSizeMultiplier: 0.48,
      labelLetterSpacing: 0.14,
    },
    spacing: { lineSpacing: 1.15 },
    visual: { textShadow: false, textShadowBlur: 0, labelStyle: 'uppercase' },
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: false,
    supportsLayoutDirection: false,
  },
});
