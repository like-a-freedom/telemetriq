/**
 * L-Frame template - Minimalist L-shaped frame with clean metric alignment.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const lframeTemplate = defineTemplate({
  id: 'l-frame',
  metadata: {
    name: 'L-Frame',
    description: 'Minimalist L-shaped frame with clean metric alignment',
    previewColors: { bg: '#1a1a2e', accent: '#ffffff', text: '#f0f0f0' },
  },
  config: {
    layoutMode: 'corner-frame',
    position: 'bottom-left',
    backgroundOpacity: 0.0,
    fontSizePercent: 2.0,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowBlur: 6,
    lineSpacing: 1.0,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'light',
    valueSizeMultiplier: 3.0,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.15,
    accentColor: '#ffffff',
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
