import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const cockpitHudTemplate = defineTemplate({
  id: 'cockpit-hud',
  metadata: {
    name: 'Cockpit HUD',
    description: 'Structured motorsport-inspired HUD with disciplined grid, modern typography, and balanced telemetry blocks',
    previewColors: { bg: '#08111d', accent: '#ff7a1a', text: '#f4f7fb' },
  },
  config: {
    layoutMode: 'cockpit-hud',
    position: 'bottom-left',
    backgroundOpacity: 0,
    fontSizePercent: 2.4,
    fontFamily: '"Inter Tight", Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    lineSpacing: 1.0,
    layout: 'horizontal',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 1.85,
    labelSizeMultiplier: 0.34,
    labelLetterSpacing: 0.18,
    accentColor: '#ff7a1a',
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
