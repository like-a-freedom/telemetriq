/**
 * Horizon template - Bottom bar with gradient overlay and horizontal metric layout.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const horizonTemplate = defineTemplate({
  id: 'horizon',
  metadata: {
    name: 'Horizon',
    description: 'Bottom bar with gradient overlay and horizontal metric layout',
    previewColors: { bg: '#0a0a0a', accent: '#ffffff', text: '#ffffff' },
  },
  config: {
    layoutMode: 'bottom-bar',
    position: 'bottom-left',
    backgroundOpacity: 0.85,
    fontSizePercent: 2.4,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    textShadowColor: '#000000',
    lineSpacing: 1.2,
    layout: 'horizontal',
    gradientBackground: true,
    gradientStartColor: 'rgba(0,0,0,0)',
    gradientEndColor: 'rgba(0,0,0,0.9)',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.5,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.15,
    accentColor: '#ef4444',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsBorder: false,
    supportsTextShadow: false,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      valueFontWeight: 'bold',
      valueSizeMultiplier: 2.5,
      labelSizeMultiplier: 0.4,
      labelLetterSpacing: 0.15,
    },
    visual: {
      labelStyle: 'uppercase',
    },
  },
});
