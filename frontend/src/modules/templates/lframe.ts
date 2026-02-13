/**
 * L-Frame template - Minimalist L-shaped frame with clean metric alignment.
 */

import type { TemplateDefinition } from './types';

export const lframeTemplate: TemplateDefinition = {
  id: 'l-frame',
  metadata: {
    id: 'l-frame',
    name: 'L-Frame',
    description: 'Minimalist L-shaped frame with clean metric alignment',
    previewColors: { bg: '#1a1a2e', accent: '#ffffff', text: '#f0f0f0' },
  },
  config: {
    templateId: 'l-frame',
    layoutMode: 'corner-frame',
    position: 'bottom-left',
    backgroundOpacity: 0.0,
    fontSizePercent: 2.0,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowBlur: 6,
    lineSpacing: 1.0,
    layout: 'horizontal',
    iconStyle: 'none',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'light',
    valueSizeMultiplier: 3.0,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.15,
    accentColor: '#ffffff',
  },
};
