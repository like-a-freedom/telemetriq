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
    customTemplate,
} from '../modules/templates';
import type { TemplateId } from '../core/types';

describe('templates registry', () => {
    describe('TEMPLATES array', () => {
        it('should contain all templates', () => {
            expect(TEMPLATES.length).toBe(5);
            expect(TEMPLATES.map(t => t.id)).toContain('horizon');
            expect(TEMPLATES.map(t => t.id)).toContain('margin');
            expect(TEMPLATES.map(t => t.id)).toContain('l-frame');
            expect(TEMPLATES.map(t => t.id)).toContain('classic');
            expect(TEMPLATES.map(t => t.id)).toContain('custom');
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
    });

    describe('getTemplateConfig', () => {
        it('should return config for each template', () => {
            const ids: TemplateId[] = ['horizon', 'margin', 'l-frame', 'classic', 'custom'];
            ids.forEach(id => {
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
            expect(templates).toHaveLength(5);
            expect(templates).toContain('horizon');
            expect(templates).toContain('margin');
            expect(templates).toContain('l-frame');
            expect(templates).toContain('classic');
            expect(templates).toContain('custom');
        });
    });

    describe('getTemplateMetadata', () => {
        it('should return metadata for each template', () => {
            const ids: TemplateId[] = ['horizon', 'margin', 'l-frame', 'classic', 'custom'];
            ids.forEach(id => {
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
            expect(templates).toHaveLength(4);
            expect(templates.find(t => t.id === 'custom')).toBeUndefined();
        });
    });
});
