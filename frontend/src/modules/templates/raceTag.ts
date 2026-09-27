import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const raceTagTemplate = defineTemplate({
  id: 'race-tag',
  metadata: {
    name: 'Race Tag',
    description: 'A chamfered pace bib with clear supporting race telemetry',
    previewColors: { bg: '#101820', accent: '#f97316', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'race-tag',
    position: 'top-left',
    backgroundOpacity: 0.98,
    fontSizePercent: 2.6,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#f8fafc',
    backgroundColor: '#fffaf2',
    borderWidth: 0,
    borderColor: 'transparent',
    lineSpacing: 1.15,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.9,
    labelSizeMultiplier: 0.46,
    labelLetterSpacing: 0.06,
    accentColor: '#f97316',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsBackgroundOpacity: true,
    supportsTextShadow: false,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      valueFontWeight: 'bold',
      labelFontWeight: 'normal',
      valueSizeMultiplier: 1.9,
      labelSizeMultiplier: 0.46,
      labelLetterSpacing: 0.06,
    },
    spacing: {
      basePaddingPercent: 0.025,
      metricGapPercent: 0.014,
      lineSpacing: 1.15,
    },
    visual: {
      textShadow: false,
      textShadowBlur: 0,
      labelStyle: 'uppercase',
    },
  },
});
