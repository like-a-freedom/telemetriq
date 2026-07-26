/**
 * Swiss Grid template - Structured typographic grid in a clean bottom panel.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const swissGridTemplate = defineTemplate({
  id: 'swiss-grid',
  metadata: {
    name: 'Swiss Grid',
    description: 'Structured typographic grid in a clean bottom panel',
    previewColors: { bg: '#000000', accent: '#d1d5db', text: '#f3f4f6' },
  },
  config: {
    layoutMode: 'swiss-grid',
    position: 'bottom-left',
    backgroundOpacity: 0.72,
    fontSizePercent: 1.95,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.72)',
    lineSpacing: 1.1,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'normal',
    valueSizeMultiplier: 1.2,
    labelSizeMultiplier: 0.38,
    labelLetterSpacing: 0.16,
    accentColor: '#d1d5db',
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
