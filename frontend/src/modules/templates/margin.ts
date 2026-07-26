/**
 * Margin template - Large typography on left and right margins with vertical labels.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const marginTemplate = defineTemplate({
  id: 'margin',
  metadata: {
    name: 'Margin',
    description: 'Large typography on left and right margins with vertical labels',
    previewColors: { bg: '#111111', accent: '#ef4444', text: '#ffffff' },
  },
  config: {
    layoutMode: 'side-margins',
    position: 'bottom-left',
    backgroundOpacity: 0.6,
    fontSizePercent: 2.0,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowBlur: 8,
    lineSpacing: 1.2,
    layout: 'vertical',
    labelStyle: 'uppercase',
    valueFontWeight: 'light',
    valueSizeMultiplier: 3.5,
    labelSizeMultiplier: 0.35,
    labelLetterSpacing: 0.25,
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
});
