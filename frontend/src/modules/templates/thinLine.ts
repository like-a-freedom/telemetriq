/**
 * Thin Line template - Ultra-thin baseline and lightweight inline metrics.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const thinLineTemplate = defineTemplate({
  id: 'thin-line',
  metadata: {
    name: 'Thin Line',
    description: 'Ultra-thin baseline and lightweight inline metrics',
    previewColors: { bg: '#0f172a', accent: '#cbd5e1', text: '#e2e8f0' },
  },
  config: {
    layoutMode: 'thin-line',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 1.55,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'transparent',
    lineSpacing: 1,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'hidden',
    valueFontWeight: 'light',
    valueSizeMultiplier: 1,
    labelSizeMultiplier: 0.3,
    labelLetterSpacing: 0.1,
    accentColor: '#cbd5e1',
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
      labelStyle: 'uppercase',
    },
  },
});
