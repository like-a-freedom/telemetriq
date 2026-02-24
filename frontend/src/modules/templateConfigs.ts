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
export const TEMPLATE_METADATA: Record<TemplateId, TemplateMetadata> = {
  'horizon': TEMPLATE_MAP['horizon'].metadata,
  'margin': TEMPLATE_MAP['margin'].metadata,
  'l-frame': TEMPLATE_MAP['l-frame'].metadata,
  'classic': TEMPLATE_MAP['classic'].metadata,
  'arc-gauge': TEMPLATE_MAP['arc-gauge'].metadata,
  'hero-number': TEMPLATE_MAP['hero-number'].metadata,
  'cinematic-bar': TEMPLATE_MAP['cinematic-bar'].metadata,
  'editorial': TEMPLATE_MAP['editorial'].metadata,
  'ticker-tape': TEMPLATE_MAP['ticker-tape'].metadata,
  'whisper': TEMPLATE_MAP['whisper'].metadata,
  'two-tone': TEMPLATE_MAP['two-tone'].metadata,
  'condensed-strip': TEMPLATE_MAP['condensed-strip'].metadata,
  'soft-rounded': TEMPLATE_MAP['soft-rounded'].metadata,
  'thin-line': TEMPLATE_MAP['thin-line'].metadata,
  'swiss-grid': TEMPLATE_MAP['swiss-grid'].metadata,
  'garmin-style': TEMPLATE_MAP['garmin-style'].metadata,
  'sports-broadcast': TEMPLATE_MAP['sports-broadcast'].metadata,
  'cockpit-hud': TEMPLATE_MAP['cockpit-hud'].metadata,
  'terminal': TEMPLATE_MAP['terminal'].metadata,
  'night-runner': TEMPLATE_MAP['night-runner'].metadata,
  'data-block': TEMPLATE_MAP['data-block'].metadata,
  'race-tag': TEMPLATE_MAP['race-tag'].metadata,
  'glass-panel': TEMPLATE_MAP['glass-panel'].metadata,
  'minimal-ring': TEMPLATE_MAP['minimal-ring'].metadata,
  'stretched-bar': TEMPLATE_MAP['stretched-bar'].metadata,
  'focus-type': TEMPLATE_MAP['focus-type'].metadata,
  'custom': TEMPLATE_MAP['custom'].metadata,
};

/** @deprecated Use getTemplateConfig() from './templates' instead */
export const TEMPLATE_CONFIGS: Record<TemplateId, ExtendedOverlayConfig> = {
  'horizon': TEMPLATE_MAP['horizon'].config,
  'margin': TEMPLATE_MAP['margin'].config,
  'l-frame': TEMPLATE_MAP['l-frame'].config,
  'classic': TEMPLATE_MAP['classic'].config,
  'arc-gauge': TEMPLATE_MAP['arc-gauge'].config,
  'hero-number': TEMPLATE_MAP['hero-number'].config,
  'cinematic-bar': TEMPLATE_MAP['cinematic-bar'].config,
  'editorial': TEMPLATE_MAP['editorial'].config,
  'ticker-tape': TEMPLATE_MAP['ticker-tape'].config,
  'whisper': TEMPLATE_MAP['whisper'].config,
  'two-tone': TEMPLATE_MAP['two-tone'].config,
  'condensed-strip': TEMPLATE_MAP['condensed-strip'].config,
  'soft-rounded': TEMPLATE_MAP['soft-rounded'].config,
  'thin-line': TEMPLATE_MAP['thin-line'].config,
  'swiss-grid': TEMPLATE_MAP['swiss-grid'].config,
  'garmin-style': TEMPLATE_MAP['garmin-style'].config,
  'sports-broadcast': TEMPLATE_MAP['sports-broadcast'].config,
  'cockpit-hud': TEMPLATE_MAP['cockpit-hud'].config,
  'terminal': TEMPLATE_MAP['terminal'].config,
  'night-runner': TEMPLATE_MAP['night-runner'].config,
  'data-block': TEMPLATE_MAP['data-block'].config,
  'race-tag': TEMPLATE_MAP['race-tag'].config,
  'glass-panel': TEMPLATE_MAP['glass-panel'].config,
  'minimal-ring': TEMPLATE_MAP['minimal-ring'].config,
  'stretched-bar': TEMPLATE_MAP['stretched-bar'].config,
  'focus-type': TEMPLATE_MAP['focus-type'].config,
  'custom': TEMPLATE_MAP['custom'].config,
};
