/**
 * Ticker Tape template - Live ticker strip at the bottom edge.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const tickerTapeTemplate = defineTemplate({
  id: 'ticker-tape',
  metadata: {
    name: 'Ticker Tape',
    description: 'Live ticker strip at the bottom edge',
    previewColors: { bg: '#0a0a0a', accent: '#ef4444', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'ticker-tape',
    position: 'bottom-left',
    backgroundOpacity: 0.95,
    fontSizePercent: 1.7,
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    lineSpacing: 1.2,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'hidden',
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.12,
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
