/**
 * Custom template - Fully customizable overlay settings.
 */

import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const customTemplate = defineTemplate({
  id: 'custom',
  metadata: {
    name: 'Custom',
    description: 'Fully customizable overlay settings',
    previewColors: { bg: '#1a1a1a', accent: '#888888', text: '#ffffff' },
  },
  config: {
    layoutMode: 'box',
    position: 'top-left',
    backgroundOpacity: 0.7,
    fontSizePercent: 2.5,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
    cornerRadius: 4,
    textShadowBlur: 2,
    lineSpacing: 1.5,
    layout: 'vertical',
    iconStyle: 'outline',
    labelStyle: 'hidden',
    valueFontWeight: 'bold',
    accentColor: '#646cff',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
  },
});
