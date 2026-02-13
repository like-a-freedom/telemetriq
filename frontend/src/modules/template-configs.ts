/**
 * Template configurations - re-exports from templates/ directory.
 * 
 * @deprecated Import directly from './templates' for new code.
 * This file is kept for backward compatibility.
 */

import type { ExtendedOverlayConfig, TemplateId } from '../core/types';
import {
  getTemplateConfig as getTemplateConfigFromRegistry,
  getAvailableTemplates as getAvailableTemplatesFromRegistry,
  getTemplateMetadata as getTemplateMetadataFromRegistry,
  getAllTemplateMetadata as getAllTemplateMetadataFromRegistry,
  TEMPLATE_MAP,
} from './templates';
import type { TemplateMetadata } from './templates';

// Re-export for backward compatibility
export type { TemplateMetadata };

/**
 * @deprecated Use getTemplateConfig from './templates' instead
 */
export function getTemplateConfig(templateId: TemplateId): ExtendedOverlayConfig {
  return getTemplateConfigFromRegistry(templateId);
}

/**
 * @deprecated Use getAvailableTemplates from './templates' instead
 */
export function getAvailableTemplates(): TemplateId[] {
  return getAvailableTemplatesFromRegistry();
}

/**
 * @deprecated Use getTemplateMetadata from './templates' instead
 */
export function getTemplateMetadata(templateId: TemplateId): TemplateMetadata {
  return getTemplateMetadataFromRegistry(templateId);
}

/**
 * @deprecated Use getAllTemplateMetadata from './templates' instead
 */
export function getAllTemplateMetadata(): TemplateMetadata[] {
  return getAllTemplateMetadataFromRegistry();
}

// Legacy exports for backward compatibility
/** @deprecated Import from './templates/types' instead */
export interface TemplateMetadataLegacy extends TemplateMetadata {}

/** @deprecated Use TEMPLATE_MAP from './templates' instead */
export const TEMPLATE_METADATA: Record<TemplateId, TemplateMetadata> = {
  'horizon': TEMPLATE_MAP['horizon'].metadata,
  'margin': TEMPLATE_MAP['margin'].metadata,
  'l-frame': TEMPLATE_MAP['l-frame'].metadata,
  'classic': TEMPLATE_MAP['classic'].metadata,
  'custom': TEMPLATE_MAP['custom'].metadata,
};

/** @deprecated Use getTemplateConfig() from './templates' instead */
export const TEMPLATE_CONFIGS: Record<TemplateId, ExtendedOverlayConfig> = {
  'horizon': TEMPLATE_MAP['horizon'].config,
  'margin': TEMPLATE_MAP['margin'].config,
  'l-frame': TEMPLATE_MAP['l-frame'].config,
  'classic': TEMPLATE_MAP['classic'].config,
  'custom': TEMPLATE_MAP['custom'].config,
};
