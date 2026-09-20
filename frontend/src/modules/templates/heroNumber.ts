import { DEFAULT_CAPABILITIES, defineTemplate } from './types';
import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';

export const heroNumberTemplate = defineTemplate({
  id: 'hero-number',
  metadata: {
    name: 'Hero Number',
    description: 'Large pace number with compact secondary metrics',
    previewColors: { bg: '#111827', accent: '#00e676', text: '#ffffff' },
  },
  config: {
    layoutMode: 'hero-number',
    position: 'top-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.3,
    fontFamily: TRAIL_RUN_FONT_FAMILY,
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowBlur: 6,
    lineSpacing: 1.1,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.8,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.25,
    accentColor: '#00E676',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time'],
    supportsPosition: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsLayoutDirection: false,
  },
});
