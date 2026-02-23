/**
 * Horizon template - Bottom bar with gradient overlay and horizontal metric layout.
 */

import type { TemplateDefinition } from './types';
import { DEFAULT_CAPABILITIES } from './types';

export const horizonTemplate: TemplateDefinition = {
  id: 'horizon',
  metadata: {
    id: 'horizon',
    name: 'Horizon',
    description: 'Bottom bar with gradient overlay and horizontal metric layout',
    previewColors: { bg: '#0a0a0a', accent: '#ffffff', text: '#ffffff' },
  },
  config: {
    templateId: 'horizon',
    layoutMode: 'bottom-bar',
    position: 'bottom-left',
    backgroundOpacity: 0.85,
    fontSizePercent: 2.4,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    borderWidth: 0,
    borderColor: 'transparent',
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: '#000000',
    textShadowBlur: 0,
    lineSpacing: 1.2,
    layout: 'horizontal',
    iconStyle: 'none',
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
    supportedMetrics: ['pace', 'hr', 'distance', 'time'],
    requiredMetrics: [],
    supportsPosition: false,
    supportsBackgroundOpacity: true,
    supportsGradient: true,
    supportsBorder: false,
    supportsTextShadow: false,
    supportsAccentColor: true,
    supportsLayoutDirection: false,
  },
  styles: {
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      valueFontWeight: 'bold',
      labelFontWeight: 'normal',
      valueSizeMultiplier: 2.5,
      labelSizeMultiplier: 0.4,
      labelLetterSpacing: 0.15,
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.2,
    },
    visual: {
      cornerRadius: 0,
      borderWidth: 0,
      textShadow: false,
      textShadowBlur: 0,
      iconStyle: 'none',
      labelStyle: 'uppercase',
    },
  },
};
