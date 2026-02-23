/**
 * Classic template - Simple positioned overlay with rounded rectangle background.
 */

import type { TemplateDefinition } from './types';
import { DEFAULT_CAPABILITIES } from './types';

export const classicTemplate: TemplateDefinition = {
  id: 'classic',
  metadata: {
    id: 'classic',
    name: 'Classic',
    description: 'Simple positioned overlay with rounded rectangle background',
    previewColors: { bg: '#000000', accent: '#646cff', text: '#ffffff' },
  },
  config: {
    templateId: 'classic',
    layoutMode: 'box',
    position: 'top-right',
    backgroundOpacity: 0,
    fontSizePercent: 2.0,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: '#FFFFFF',
    cornerRadius: 4,
    textShadow: false,
    textShadowColor: '#000000',
    textShadowBlur: 2,
    lineSpacing: 1.2,
    layout: 'vertical',
    iconStyle: 'outline',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'hidden',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.0,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.1,
    accentColor: '#646cff',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time'],
    requiredMetrics: [],
    supportsPosition: true,
    supportsBackgroundOpacity: true,
    supportsGradient: true,
    supportsBorder: true,
    supportsTextShadow: true,
    supportsAccentColor: true,
    supportsLayoutDirection: true,
  },
  styles: {
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      valueFontWeight: 'bold',
      labelFontWeight: 'normal',
      valueSizeMultiplier: 1.0,
      labelSizeMultiplier: 0.5,
      labelLetterSpacing: 0.1,
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.2,
    },
    visual: {
      cornerRadius: 4,
      borderWidth: 0,
      textShadow: false,
      textShadowBlur: 2,
      iconStyle: 'outline',
      labelStyle: 'hidden',
    },
  },
};
