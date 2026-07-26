/**
 * Whisper template - Ultra-subtle and low-contrast corner telemetry.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const whisperTemplate = defineTemplate({
  id: 'whisper',
  metadata: {
    name: 'Whisper',
    description: 'Ultra-subtle and low-contrast corner telemetry',
    previewColors: { bg: '#101218', accent: '#9ca3af', text: '#e5e7eb' },
  },
  config: {
    layoutMode: 'whisper',
    position: 'bottom-right',
    backgroundOpacity: 0,
    fontSizePercent: 1.5,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'transparent',
    lineSpacing: 1.05,
    layout: 'vertical',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'hidden',
    valueFontWeight: 'light',
    valueSizeMultiplier: 0.95,
    labelSizeMultiplier: 0.32,
    labelLetterSpacing: 0.08,
    accentColor: '#9ca3af',
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
