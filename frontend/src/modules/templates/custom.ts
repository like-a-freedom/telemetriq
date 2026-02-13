/**
 * Custom template - Fully customizable overlay settings.
 */

import type { TemplateDefinition } from './types';

export const customTemplate: TemplateDefinition = {
  id: 'custom',
  metadata: {
    id: 'custom',
    name: 'Custom',
    description: 'Fully customizable overlay settings',
    previewColors: { bg: '#1a1a1a', accent: '#888888', text: '#ffffff' },
  },
  config: {
    templateId: 'custom',
    layoutMode: 'box',
    position: 'top-left',
    backgroundOpacity: 0.7,
    fontSizePercent: 2.5,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    borderWidth: 0,
    borderColor: '#FFFFFF',
    cornerRadius: 4,
    textShadow: false,
    textShadowColor: '#000000',
    textShadowBlur: 2,
    lineSpacing: 1.5,
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
};
