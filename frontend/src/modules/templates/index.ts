/**
 * Template registry - exports all available templates.
 * 
 * To add a new template:
 * 1. Create a new file in this directory (e.g., my-template.ts)
 * 2. Define and export the template using TemplateDefinition interface
 * 3. Import and add it to the TEMPLATES array below
 * 4. Add the template ID to the TemplateId type in core/types.ts
 */

import type { TemplateDefinition, TemplateMetadata } from './types';
import type { ExtendedOverlayConfig, TemplateId } from '../../core/types';

// Import all templates
import { horizonTemplate } from './horizon';
import { marginTemplate } from './margin';
import { lframeTemplate } from './lframe';
import { classicTemplate } from './classic';
import { customTemplate } from './custom';

/** All available templates */
export const TEMPLATES: TemplateDefinition[] = [
  horizonTemplate,
  marginTemplate,
  lframeTemplate,
  classicTemplate,
  customTemplate,
];

/** Template lookup by ID */
export const TEMPLATE_MAP: Record<TemplateId, TemplateDefinition> = {
  'horizon': horizonTemplate,
  'margin': marginTemplate,
  'l-frame': lframeTemplate,
  'classic': classicTemplate,
  'custom': customTemplate,
};

/** Get a template configuration by ID */
export function getTemplateConfig(templateId: TemplateId): ExtendedOverlayConfig {
  return { ...TEMPLATE_MAP[templateId].config };
}

/** Get all available template IDs */
export function getAvailableTemplates(): TemplateId[] {
  return Object.keys(TEMPLATE_MAP) as TemplateId[];
}

/** Get template metadata for UI display */
export function getTemplateMetadata(templateId: TemplateId): TemplateMetadata {
  return TEMPLATE_MAP[templateId].metadata;
}

/** Get all template metadata entries (excluding custom) */
export function getAllTemplateMetadata(): TemplateMetadata[] {
  return TEMPLATES
    .filter(t => t.id !== 'custom')
    .map(t => t.metadata);
}

// Re-export types
export type { TemplateDefinition, TemplateMetadata } from './types';

// Re-export individual templates for direct access
export { horizonTemplate } from './horizon';
export { marginTemplate } from './margin';
export { lframeTemplate } from './lframe';
export { classicTemplate } from './classic';
export { customTemplate } from './custom';
