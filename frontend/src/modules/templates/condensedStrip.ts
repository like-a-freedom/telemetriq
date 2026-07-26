/**
 * Condensed Strip template - Dense horizontal strip for compact telemetry.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const condensedStripTemplate = defineTemplate({
  id: 'condensed-strip',
  metadata: {
    name: 'Condensed Strip',
    description: 'Dense horizontal strip for compact telemetry',
    previewColors: { bg: '#ffffff', accent: '#111111', text: '#111111' },
  },
  config: {
    layoutMode: 'condensed-strip',
    position: 'bottom-left',
    backgroundOpacity: 1,
    fontSizePercent: 1.75,
    fontFamily: '"Arial Narrow", "Helvetica Neue", Arial, sans-serif',
    textColor: '#111111',
    backgroundColor: '#FFFFFF',
    lineSpacing: 1,
    layout: 'horizontal',
    gradientBackground: false,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#ffffff',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.15,
    labelSizeMultiplier: 0.45,
    labelLetterSpacing: 0.08,
    accentColor: '#111111',
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
