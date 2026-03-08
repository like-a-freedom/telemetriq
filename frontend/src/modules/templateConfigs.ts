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
  TEMPLATE_CONFIGS as TEMPLATE_CONFIGS_FROM_REGISTRY,
  TEMPLATE_METADATA as TEMPLATE_METADATA_FROM_REGISTRY,
  isMetricAvailable,
  isMetricRequired,
  getMetricUnavailableReason,
} from './templates';
import type { TemplateMetadata, TemplateCapabilities, TemplateStyles, MetricType } from './templates';

// Re-export for backward compatibility
export type { TemplateMetadata, TemplateCapabilities, TemplateStyles, MetricType };

// Re-export helpers
export { isMetricAvailable, isMetricRequired, getMetricUnavailableReason };

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
export type { TemplateMetadata as TemplateMetadataLegacy } from './templates';

/** @deprecated Use TEMPLATE_MAP from './templates' instead */
export const TEMPLATE_METADATA: Record<TemplateId, TemplateMetadata> = TEMPLATE_METADATA_FROM_REGISTRY;

/** @deprecated Use getTemplateConfig() from './templates' instead */
export const TEMPLATE_CONFIGS: Record<TemplateId, ExtendedOverlayConfig> = TEMPLATE_CONFIGS_FROM_REGISTRY;
