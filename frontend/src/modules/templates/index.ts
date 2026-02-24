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
import { arcGaugeTemplate } from './arcGauge';
import { heroNumberTemplate } from './heroNumber';
import { cinematicBarTemplate } from './cinematicBar';
import { editorialTemplate } from './editorial';
import { tickerTapeTemplate } from './tickerTape';
import { whisperTemplate } from './whisper';
import { twoToneTemplate } from './twoTone';
import { condensedStripTemplate } from './condensedStrip';
import { softRoundedTemplate } from './softRounded';
import { thinLineTemplate } from './thinLine';
import { swissGridTemplate } from './swissGrid';
import { garminStyleTemplate } from './garminStyle';
import { sportsBroadcastTemplate } from './sportsBroadcast';
import { cockpitHudTemplate } from './cockpitHud';
import { terminalTemplate } from './terminal';
import { nightRunnerTemplate } from './nightRunner';
import { dataBlockTemplate } from './dataBlock';
import { raceTagTemplate } from './raceTag';
import { glassPanelTemplate } from './glassPanel';
import { minimalRingTemplate } from './minimalRing';
import { stretchedBarTemplate } from './stretchedBar';
import { focusTypeTemplate } from './focusType';
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
export { arcGaugeTemplate } from './arcGauge';
export { heroNumberTemplate } from './heroNumber';
export { cinematicBarTemplate } from './cinematicBar';
export { editorialTemplate } from './editorial';
export { tickerTapeTemplate } from './tickerTape';
export { whisperTemplate } from './whisper';
export { twoToneTemplate } from './twoTone';
export { condensedStripTemplate } from './condensedStrip';
export { softRoundedTemplate } from './softRounded';
export { thinLineTemplate } from './thinLine';
export { swissGridTemplate } from './swissGrid';
export { garminStyleTemplate } from './garminStyle';
export { sportsBroadcastTemplate } from './sportsBroadcast';
export { cockpitHudTemplate } from './cockpitHud';
export { terminalTemplate } from './terminal';
export { nightRunnerTemplate } from './nightRunner';
export { dataBlockTemplate } from './dataBlock';
export { raceTagTemplate } from './raceTag';
export { glassPanelTemplate } from './glassPanel';
export { minimalRingTemplate, renderMinimalRing } from './minimalRing';
export { stretchedBarTemplate } from './stretchedBar';
export { focusTypeTemplate } from './focusType';
export { customTemplate } from './custom';
