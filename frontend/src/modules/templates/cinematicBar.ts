import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const cinematicBarTemplate = defineTemplate({
  id: 'cinematic-bar',
  metadata: {
    name: 'Cinematic Bar',
    description: 'Letterbox bars with compact bottom telemetry strip',
    previewColors: { bg: '#000000', accent: '#ffffff', text: '#f8fafc' },
  },
  config: {
    layoutMode: 'cinematic-bar',
    position: 'bottom-left',
    backgroundOpacity: 0.6,
    fontSizePercent: 1.85,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    lineSpacing: 1.15,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueSizeMultiplier: 1.05,
    labelSizeMultiplier: 0.42,
    labelLetterSpacing: 0.16,
    accentColor: '#FFFFFF',
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
