import type { ExtendedOverlayConfig, TemplateId } from '../../core/types';
import type { TemplateDefinition, TemplateMetadata } from './types';

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
import { focusTypeTemplate } from './focusType';
import { customTemplate } from './custom';

export interface BuiltTemplateRegistry {
    templates: TemplateDefinition[];
    ids: TemplateId[];
    map: Record<TemplateId, TemplateDefinition>;
    configs: Record<TemplateId, ExtendedOverlayConfig>;
    metadata: Record<TemplateId, TemplateMetadata>;
}

export function buildTemplateRegistry(templates: readonly TemplateDefinition[]): BuiltTemplateRegistry {
    const orderedTemplates = [...templates];
    const ids = orderedTemplates.map((template) => template.id);
    const map = Object.fromEntries(
        orderedTemplates.map((template) => [template.id, template]),
    ) as Record<TemplateId, TemplateDefinition>;
    const configs = Object.fromEntries(
        orderedTemplates.map((template) => [template.id, template.config]),
    ) as Record<TemplateId, ExtendedOverlayConfig>;
    const metadata = Object.fromEntries(
        orderedTemplates.map((template) => [template.id, template.metadata]),
    ) as Record<TemplateId, TemplateMetadata>;

    return {
        templates: orderedTemplates,
        ids,
        map,
        configs,
        metadata,
    };
}

const REGISTERED_TEMPLATES = [
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
    focusTypeTemplate,
    customTemplate,
] satisfies readonly TemplateDefinition[];

const registry = buildTemplateRegistry(REGISTERED_TEMPLATES);

export const TEMPLATES = registry.templates;
export const TEMPLATE_IDS = registry.ids;
export const TEMPLATE_MAP = registry.map;
export const TEMPLATE_CONFIGS = registry.configs;
export const TEMPLATE_METADATA = registry.metadata;

export function getTemplateDefinition(templateId: TemplateId): TemplateDefinition | undefined {
    return TEMPLATE_MAP[templateId];
}

export function getTemplateConfig(templateId: TemplateId): ExtendedOverlayConfig {
    return { ...(getTemplateDefinition(templateId) ?? horizonTemplate).config };
}

export function getAvailableTemplates(): TemplateId[] {
    return [...TEMPLATE_IDS];
}

export function getTemplateMetadata(templateId: TemplateId): TemplateMetadata {
    return (getTemplateDefinition(templateId) ?? horizonTemplate).metadata;
}

export function getAllTemplateMetadata(): TemplateMetadata[] {
    return TEMPLATES
        .filter((template) => template.id !== 'custom')
        .map((template) => template.metadata);
}