/**
 * Template types and interfaces.
 */

import type { ExtendedOverlayConfig, TemplateId } from '../../core/types';

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

/** Template definition combining metadata and configuration */
export interface TemplateDefinition {
  id: TemplateId;
  metadata: TemplateMetadata;
  config: ExtendedOverlayConfig;
}

/** Base template configuration with common defaults */
export const BASE_TEMPLATE_CONFIG: Partial<ExtendedOverlayConfig> = {
  showHr: true,
  showPace: true,
  showDistance: true,
  showTime: true,
  borderWidth: 0,
  borderColor: 'transparent',
  cornerRadius: 0,
  textShadow: false,
  textShadowBlur: 0,
  iconStyle: 'none',
};
