/**
 * Template registry exports.
 *
 * To add a new template:
 * 1. Create a template module in this directory
 * 2. Register it once in `registry.ts`
 */

export {
  TEMPLATES,
  TEMPLATE_IDS,
  TEMPLATE_MAP,
  TEMPLATE_CONFIGS,
  TEMPLATE_METADATA,
  buildTemplateRegistry,
  getTemplateDefinition,
  getTemplateConfig,
  getAvailableTemplates,
  getTemplateMetadata,
  getAllTemplateMetadata,
} from './registry';

// Re-export types and helpers
export type { TemplateDefinition, TemplateMetadata } from './types';
export type { MetricType, TemplateCapabilities, TemplateStyles } from './types';
export {
  defineTemplate,
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
export { focusTypeTemplate } from './focusType';
export { customTemplate } from './custom';
