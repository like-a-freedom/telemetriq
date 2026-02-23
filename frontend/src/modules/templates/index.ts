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
import { arcGaugeTemplate } from './arc-gauge';
import { heroNumberTemplate } from './hero-number';
import { cinematicBarTemplate } from './cinematic-bar';
import { editorialTemplate } from './editorial';
import { tickerTapeTemplate } from './ticker-tape';
import { whisperTemplate } from './whisper';
import { twoToneTemplate } from './two-tone';
import { condensedStripTemplate } from './condensed-strip';
import { softRoundedTemplate } from './soft-rounded';
import { thinLineTemplate } from './thin-line';
import { swissGridTemplate } from './swiss-grid';
import { garminStyleTemplate } from './garmin-style';
import { sportsBroadcastTemplate } from './sports-broadcast';
import { cockpitHudTemplate } from './cockpit-hud';
import { terminalTemplate } from './terminal';
import { nightRunnerTemplate } from './night-runner';
import { dataBlockTemplate } from './data-block';
import { raceTagTemplate } from './race-tag';
import { glassPanelTemplate } from './glass-panel';
import { minimalRingTemplate } from './minimal-ring';
import { stretchedBarTemplate } from './stretched-bar';
import { focusTypeTemplate } from './focus-type';
import { customTemplate } from './custom';

/** All available templates */
export const TEMPLATES: TemplateDefinition[] = [
  horizonTemplate,
  marginTemplate,
  lframeTemplate,
  classicTemplate,
  arcGaugeTemplate,
  heroNumberTemplate,
  cinematicBarTemplate,
  editorialTemplate,
  tickerTapeTemplate,
  whisperTemplate,
  twoToneTemplate,
  condensedStripTemplate,
  softRoundedTemplate,
  thinLineTemplate,
  swissGridTemplate,
  garminStyleTemplate,
  sportsBroadcastTemplate,
  cockpitHudTemplate,
  terminalTemplate,
  nightRunnerTemplate,
  dataBlockTemplate,
  raceTagTemplate,
  glassPanelTemplate,
  minimalRingTemplate,
  stretchedBarTemplate,
  focusTypeTemplate,
  customTemplate,
];

/** Template lookup by ID */
export const TEMPLATE_MAP: Record<TemplateId, TemplateDefinition> = {
  'horizon': horizonTemplate,
  'margin': marginTemplate,
  'l-frame': lframeTemplate,
  'classic': classicTemplate,
  'arc-gauge': arcGaugeTemplate,
  'hero-number': heroNumberTemplate,
  'cinematic-bar': cinematicBarTemplate,
  'editorial': editorialTemplate,
  'ticker-tape': tickerTapeTemplate,
  'whisper': whisperTemplate,
  'two-tone': twoToneTemplate,
  'condensed-strip': condensedStripTemplate,
  'soft-rounded': softRoundedTemplate,
  'thin-line': thinLineTemplate,
  'swiss-grid': swissGridTemplate,
  'garmin-style': garminStyleTemplate,
  'sports-broadcast': sportsBroadcastTemplate,
  'cockpit-hud': cockpitHudTemplate,
  'terminal': terminalTemplate,
  'night-runner': nightRunnerTemplate,
  'data-block': dataBlockTemplate,
  'race-tag': raceTagTemplate,
  'glass-panel': glassPanelTemplate,
  'minimal-ring': minimalRingTemplate,
  'stretched-bar': stretchedBarTemplate,
  'focus-type': focusTypeTemplate,
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

// Re-export types and helpers
export type { TemplateDefinition, TemplateMetadata } from './types';
export type { MetricType, TemplateCapabilities, TemplateStyles } from './types';
export {
  isMetricAvailable,
  isMetricRequired,
  getMetricUnavailableReason,
  DEFAULT_CAPABILITIES,
  DEFAULT_STYLES,
} from './types';

// Re-export individual templates for direct access
export { horizonTemplate } from './horizon';
export { marginTemplate } from './margin';
export { lframeTemplate } from './lframe';
export { classicTemplate } from './classic';
export { arcGaugeTemplate } from './arc-gauge';
export { heroNumberTemplate } from './hero-number';
export { cinematicBarTemplate } from './cinematic-bar';
export { editorialTemplate } from './editorial';
export { tickerTapeTemplate } from './ticker-tape';
export { whisperTemplate } from './whisper';
export { twoToneTemplate } from './two-tone';
export { condensedStripTemplate } from './condensed-strip';
export { softRoundedTemplate } from './soft-rounded';
export { thinLineTemplate } from './thin-line';
export { swissGridTemplate } from './swiss-grid';
export { garminStyleTemplate } from './garmin-style';
export { sportsBroadcastTemplate } from './sports-broadcast';
export { cockpitHudTemplate } from './cockpit-hud';
export { terminalTemplate } from './terminal';
export { nightRunnerTemplate } from './night-runner';
export { dataBlockTemplate } from './data-block';
export { raceTagTemplate } from './race-tag';
export { glassPanelTemplate } from './glass-panel';
export { minimalRingTemplate, renderMinimalRing } from './minimal-ring';
export { stretchedBarTemplate } from './stretched-bar';
export { focusTypeTemplate } from './focus-type';
export { customTemplate } from './custom';
