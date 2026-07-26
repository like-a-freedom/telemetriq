/**
 * Classic template - Simple positioned overlay with rounded rectangle background.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const classicTemplate = defineTemplate({
  id: 'classic',
  metadata: {
    name: 'Classic',
    description: 'Simple positioned overlay with rounded rectangle background',
    previewColors: { bg: '#000000', accent: '#646cff', text: '#ffffff' },
  },
  config: {
    layoutMode: 'box',
    position: 'top-right',
    backgroundOpacity: 0,
    fontSizePercent: 2.0,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    cornerRadius: 4,
    textShadowBlur: 2,
    lineSpacing: 1.2,
    layout: 'vertical',
    iconStyle: 'outline',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'hidden',
    valueFontWeight: 'bold',
    accentColor: '#646cff',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
  },
  styles: {
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      valueFontWeight: 'bold',
    },
    spacing: {
      basePaddingPercent: 0.02,
      metricGapPercent: 0.01,
      lineSpacing: 1.2,
    },
    visual: {
      cornerRadius: 4,
      textShadowBlur: 2,
      iconStyle: 'outline',
      labelStyle: 'hidden',
    },
  },
});
