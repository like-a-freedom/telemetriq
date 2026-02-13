/**
 * Unit tests for templates registry.
 */
import { describe, it, expect } from 'vitest';
import {
    getTemplateConfig,
    getAvailableTemplates,
    getTemplateMetadata,
    getAllTemplateMetadata,
    TEMPLATES,
    TEMPLATE_MAP,
    horizonTemplate,
    marginTemplate,
    lframeTemplate,
    classicTemplate,
    floatingPillsTemplate,
    arcGaugeTemplate,
    heroNumberTemplate,
    dashboardHudTemplate,
    cinematicBarTemplate,
    splitEdgesTemplate,
    stackedSerifTemplate,
    editorialTemplate,
    tickerTapeTemplate,
    whisperTemplate,
    twoToneTemplate,
    condensedStripTemplate,
    softRoundedTemplate,
    thinLineTemplate,
    swissGridTemplate,
    customTemplate,
} from '../modules/templates';
import type { TemplateId } from '../core/types';

describe('templates registry', () => {
    const allTemplateIds: TemplateId[] = [
        'horizon', 'margin', 'l-frame', 'classic',
        'floating-pills', 'arc-gauge', 'hero-number', 'dashboard-hud', 'cinematic-bar',
        'split-edges', 'stacked-serif', 'editorial', 'ticker-tape', 'whisper', 'two-tone',
        'condensed-strip', 'soft-rounded', 'thin-line', 'swiss-grid', 'custom',
    ];

    describe('TEMPLATES array', () => {
        it('should contain all templates', () => {
            expect(TEMPLATES.length).toBe(allTemplateIds.length);
            allTemplateIds.forEach((id) => {
                expect(TEMPLATES.map(t => t.id)).toContain(id);
            });
        });

        it('each template should have metadata and config', () => {
            TEMPLATES.forEach(template => {
                expect(template.id).toBeDefined();
                expect(template.metadata).toBeDefined();
                expect(template.metadata.id).toBe(template.id);
                expect(template.metadata.name).toBeDefined();
                expect(template.metadata.description).toBeDefined();
                expect(template.metadata.previewColors).toBeDefined();
                expect(template.config).toBeDefined();
                expect(template.config.templateId).toBe(template.id);
            });
        });
    });

    describe('TEMPLATE_MAP', () => {
        it('should provide quick lookup by ID', () => {
            expect(TEMPLATE_MAP['horizon']).toBe(horizonTemplate);
            expect(TEMPLATE_MAP['margin']).toBe(marginTemplate);
            expect(TEMPLATE_MAP['l-frame']).toBe(lframeTemplate);
            expect(TEMPLATE_MAP['classic']).toBe(classicTemplate);
            expect(TEMPLATE_MAP['floating-pills']).toBe(floatingPillsTemplate);
            expect(TEMPLATE_MAP['arc-gauge']).toBe(arcGaugeTemplate);
            expect(TEMPLATE_MAP['hero-number']).toBe(heroNumberTemplate);
            expect(TEMPLATE_MAP['dashboard-hud']).toBe(dashboardHudTemplate);
            expect(TEMPLATE_MAP['cinematic-bar']).toBe(cinematicBarTemplate);
            expect(TEMPLATE_MAP['split-edges']).toBe(splitEdgesTemplate);
            expect(TEMPLATE_MAP['stacked-serif']).toBe(stackedSerifTemplate);
            expect(TEMPLATE_MAP['editorial']).toBe(editorialTemplate);
            expect(TEMPLATE_MAP['ticker-tape']).toBe(tickerTapeTemplate);
            expect(TEMPLATE_MAP['whisper']).toBe(whisperTemplate);
            expect(TEMPLATE_MAP['two-tone']).toBe(twoToneTemplate);
            expect(TEMPLATE_MAP['condensed-strip']).toBe(condensedStripTemplate);
            expect(TEMPLATE_MAP['soft-rounded']).toBe(softRoundedTemplate);
            expect(TEMPLATE_MAP['thin-line']).toBe(thinLineTemplate);
            expect(TEMPLATE_MAP['swiss-grid']).toBe(swissGridTemplate);
            expect(TEMPLATE_MAP['custom']).toBe(customTemplate);
        });
    });

    describe('Individual templates', () => {
        it('horizon template should have correct layout', () => {
            expect(horizonTemplate.config.layoutMode).toBe('bottom-bar');
            expect(horizonTemplate.metadata.name).toBe('Horizon');
        });

        it('margin template should have correct layout', () => {
            expect(marginTemplate.config.layoutMode).toBe('side-margins');
            expect(marginTemplate.metadata.name).toBe('Margin');
        });

        it('l-frame template should have correct layout', () => {
            expect(lframeTemplate.config.layoutMode).toBe('corner-frame');
            expect(lframeTemplate.metadata.name).toBe('L-Frame');
        });

        it('classic template should have correct layout', () => {
            expect(classicTemplate.config.layoutMode).toBe('box');
            expect(classicTemplate.metadata.name).toBe('Classic');
        });

        it('custom template should have correct layout', () => {
            expect(customTemplate.config.layoutMode).toBe('box');
            expect(customTemplate.metadata.name).toBe('Custom');
        });

        it('new template layouts should map to expected modes', () => {
            expect(floatingPillsTemplate.config.layoutMode).toBe('floating-pills');
            expect(arcGaugeTemplate.config.layoutMode).toBe('arc-gauge');
            expect(heroNumberTemplate.config.layoutMode).toBe('hero-number');
            expect(dashboardHudTemplate.config.layoutMode).toBe('dashboard-hud');
            expect(cinematicBarTemplate.config.layoutMode).toBe('cinematic-bar');
            expect(splitEdgesTemplate.config.layoutMode).toBe('split-edges');
            expect(stackedSerifTemplate.config.layoutMode).toBe('stacked-serif');
            expect(editorialTemplate.config.layoutMode).toBe('editorial');
            expect(tickerTapeTemplate.config.layoutMode).toBe('ticker-tape');
            expect(whisperTemplate.config.layoutMode).toBe('whisper');
            expect(twoToneTemplate.config.layoutMode).toBe('two-tone');
            expect(condensedStripTemplate.config.layoutMode).toBe('condensed-strip');
            expect(softRoundedTemplate.config.layoutMode).toBe('soft-rounded');
            expect(thinLineTemplate.config.layoutMode).toBe('thin-line');
            expect(swissGridTemplate.config.layoutMode).toBe('swiss-grid');
        });
    });

    describe('getTemplateConfig', () => {
        it('should return config for each template', () => {
            allTemplateIds.forEach(id => {
                const config = getTemplateConfig(id);
                expect(config.templateId).toBe(id);
            });
        });

        it('should return a copy of config', () => {
            const config1 = getTemplateConfig('horizon');
            const config2 = getTemplateConfig('horizon');
            expect(config1).not.toBe(config2);
            expect(config1).toEqual(config2);
        });
    });

    describe('getAvailableTemplates', () => {
        it('should return all template IDs', () => {
            const templates = getAvailableTemplates();
            expect(templates).toHaveLength(allTemplateIds.length);
            allTemplateIds.forEach((id) => {
                expect(templates).toContain(id);
            });
        });
    });

    describe('getTemplateMetadata', () => {
        it('should return metadata for each template', () => {
            allTemplateIds.forEach(id => {
                const meta = getTemplateMetadata(id);
                expect(meta.id).toBe(id);
                expect(meta.name).toBeDefined();
                expect(meta.description).toBeDefined();
                expect(meta.previewColors).toBeDefined();
                expect(meta.previewColors.bg).toBeDefined();
                expect(meta.previewColors.accent).toBeDefined();
                expect(meta.previewColors.text).toBeDefined();
            });
        });
    });

    describe('getAllTemplateMetadata', () => {
        it('should return metadata for all templates except custom', () => {
            const templates = getAllTemplateMetadata();
            expect(templates).toHaveLength(allTemplateIds.length - 1);
            expect(templates.find(t => t.id === 'custom')).toBeUndefined();
        });
    });
});
