import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const raceTagTemplate = defineTemplate({
  id: 'race-tag',
  metadata: {
    name: 'Race Tag',
    description: 'White bib-number tag top-left with clip-path + dark bottom strip in Bebas Neue style',
    previewColors: { bg: '#ffffff', accent: '#000000', text: '#111111' },
  },
  config: {
    layoutMode: 'race-tag',
    position: 'top-left',
    backgroundOpacity: 1.0,
    fontSizePercent: 2.0,
    fontFamily: '"Bebas Neue", "Impact", "Arial Narrow", sans-serif',
    textColor: '#000000',
    backgroundColor: '#FFFFFF',
    lineSpacing: 1.0,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueSizeMultiplier: 2.0,
    labelSizeMultiplier: 0.35,
    labelLetterSpacing: 0.22,
    accentColor: '#000000',
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
});
