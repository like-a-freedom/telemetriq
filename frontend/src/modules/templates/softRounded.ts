/**
 * Soft Rounded template - Rounded soft cards with gentle contrast.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const softRoundedTemplate = defineTemplate({
  id: 'soft-rounded',
  metadata: {
    name: 'Soft Rounded',
    description: 'Rounded soft cards with gentle contrast',
    previewColors: { bg: '#f8fafc', accent: '#fb7185', text: '#111827' },
  },
  config: {
    layoutMode: 'soft-rounded',
    position: 'bottom-left',
    backgroundOpacity: 0.9,
    fontSizePercent: 1.95,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#111827',
    backgroundColor: 'rgba(255,255,255,0.92)',
    cornerRadius: 20,
    lineSpacing: 1.1,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#ffffff',
    labelStyle: 'uppercase',
    valueFontWeight: 'normal',
    valueSizeMultiplier: 1.1,
    labelSizeMultiplier: 0.42,
    labelLetterSpacing: 0.1,
    accentColor: '#fb7185',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportsPosition: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: true,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      valueSizeMultiplier: 2.0,
      labelSizeMultiplier: 0.4,
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.2,
    },
    visual: {
      cornerRadius: 20,
      labelStyle: 'uppercase',
    },
  },
});
