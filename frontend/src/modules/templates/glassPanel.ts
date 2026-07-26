import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const glassPanelTemplate = defineTemplate({
  id: 'glass-panel',
  metadata: {
    name: 'Glass Panel',
    description: 'Floating liquid-glass telemetry capsule with layered highlights and frosted depth',
    previewColors: { bg: '#121a2d', accent: '#8fd3ff', text: '#f7fbff' },
  },
  config: {
    layoutMode: 'glass-panel',
    position: 'bottom-left',
    backgroundOpacity: 0.16,
    fontSizePercent: 2.0,
    fontFamily: '"SF Pro Display", "DM Sans", Inter, -apple-system, sans-serif',
    textColor: '#F9FCFF',
    backgroundColor: 'rgba(196,222,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    cornerRadius: 28,
    lineSpacing: 1.0,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.55,
    labelSizeMultiplier: 0.34,
    labelLetterSpacing: 0.18,
    accentColor: '#8fd3ff',
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
