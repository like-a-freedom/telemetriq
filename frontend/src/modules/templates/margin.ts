/**
 * Margin template - Large typography on left and right margins with vertical labels.
 */

import type { TemplateDefinition } from './types';

export const marginTemplate: TemplateDefinition = {
  id: 'margin',
  metadata: {
    id: 'margin',
    name: 'Margin',
    description: 'Large typography on left and right margins with vertical labels',
    previewColors: { bg: '#111111', accent: '#ef4444', text: '#ffffff' },
  },
  config: {
    templateId: 'margin',
    layoutMode: 'side-margins',
    position: 'bottom-left',
    backgroundOpacity: 0.6,
    fontSizePercent: 2.0,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    borderWidth: 0,
    borderColor: 'transparent',
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowBlur: 8,
    lineSpacing: 1.2,
    layout: 'vertical',
    iconStyle: 'none',
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'uppercase',
    valueFontWeight: 'light',
    valueSizeMultiplier: 3.5,
    labelSizeMultiplier: 0.35,
    labelLetterSpacing: 0.25,
    accentColor: '#ef4444',
  },
};
