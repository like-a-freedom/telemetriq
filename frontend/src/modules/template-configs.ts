import type { ExtendedOverlayConfig, TemplateId } from '../core/types';

/** Template display metadata */
export interface TemplateMetadata {
  id: TemplateId;
  name: string;
  description: string;
  /** CSS-like preview colors for the UI thumbnail */
  previewColors: {
    bg: string;
    accent: string;
    text: string;
  };
}

/** Template metadata for UI display */
export const TEMPLATE_METADATA: Record<TemplateId, TemplateMetadata> = {
  'horizon': {
    id: 'horizon',
    name: 'Horizon',
    description: 'Bottom bar with gradient overlay and horizontal metric layout',
    previewColors: { bg: '#0a0a0a', accent: '#ffffff', text: '#ffffff' },
  },
  'margin': {
    id: 'margin',
    name: 'Margin',
    description: 'Large typography on left and right margins with vertical labels',
    previewColors: { bg: '#111111', accent: '#ef4444', text: '#ffffff' },
  },
  'l-frame': {
    id: 'l-frame',
    name: 'L-Frame',
    description: 'Minimalist L-shaped frame with clean metric alignment',
    previewColors: { bg: '#1a1a2e', accent: '#ffffff', text: '#f0f0f0' },
  },
  'classic': {
    id: 'classic',
    name: 'Classic',
    description: 'Simple positioned overlay with rounded rectangle background',
    previewColors: { bg: '#000000', accent: '#646cff', text: '#ffffff' },
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    description: 'Fully customizable overlay settings',
    previewColors: { bg: '#1a1a1a', accent: '#888888', text: '#ffffff' },
  },
};

/** Default template configurations */
export const TEMPLATE_CONFIGS: Record<TemplateId, ExtendedOverlayConfig> = {
  'horizon': {
    templateId: 'horizon',
    layoutMode: 'bottom-bar',
    position: 'bottom-left',
    backgroundOpacity: 0.85,
    fontSizePercent: 2.4,
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
    textShadow: false,
    textShadowColor: '#000000',
    textShadowBlur: 0,
    lineSpacing: 1.2,
    layout: 'horizontal',
    iconStyle: 'none',
    gradientBackground: true,
    gradientStartColor: 'rgba(0,0,0,0)',
    gradientEndColor: 'rgba(0,0,0,0.9)',
    labelStyle: 'uppercase',
    valueFontWeight: 'bold',
    valueSizeMultiplier: 2.5,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.15,
    accentColor: '#ef4444',
  },

  'margin': {
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

  'l-frame': {
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

  'classic': {
    templateId: 'classic',
    layoutMode: 'box',
    position: 'top-right',
    backgroundOpacity: 0.5,
    fontSizePercent: 2.0,
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
    lineSpacing: 1.2,
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

  'custom': {
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

/** Get a template configuration by ID */
export function getTemplateConfig(templateId: TemplateId): ExtendedOverlayConfig {
  return { ...TEMPLATE_CONFIGS[templateId] };
}

/** Get all available template IDs */
export function getAvailableTemplates(): TemplateId[] {
  return Object.keys(TEMPLATE_CONFIGS) as TemplateId[];
}

/** Get template metadata for UI display */
export function getTemplateMetadata(templateId: TemplateId): TemplateMetadata {
  return TEMPLATE_METADATA[templateId];
}

/** Get all template metadata entries */
export function getAllTemplateMetadata(): TemplateMetadata[] {
  return (Object.keys(TEMPLATE_METADATA) as TemplateId[])
    .filter(id => id !== 'custom')
    .map(id => TEMPLATE_METADATA[id]);
}