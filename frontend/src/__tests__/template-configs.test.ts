/**
 * Unit tests for template-configs module.
 */
import { describe, it, expect } from 'vitest';
import {
    getTemplateConfig,
    getAvailableTemplates,
    getTemplateMetadata,
    getAllTemplateMetadata,
} from '../modules/template-configs';
import type { TemplateId } from '../core/types';

describe('template-configs', () => {
    describe('getTemplateConfig', () => {
        it('should return config for horizon template', () => {
            const config = getTemplateConfig('horizon');
            expect(config.templateId).toBe('horizon');
            expect(config.layoutMode).toBe('bottom-bar');
            expect(config.showHr).toBe(true);
        });

        it('should return config for margin template', () => {
            const config = getTemplateConfig('margin');
            expect(config.templateId).toBe('margin');
            expect(config.layoutMode).toBe('side-margins');
        });

        it('should return config for l-frame template', () => {
            const config = getTemplateConfig('l-frame');
            expect(config.templateId).toBe('l-frame');
            expect(config.layoutMode).toBe('corner-frame');
        });

        it('should return config for classic template', () => {
            const config = getTemplateConfig('classic');
            expect(config.templateId).toBe('classic');
            expect(config.layoutMode).toBe('box');
        });

        it('should return config for custom template', () => {
            const config = getTemplateConfig('custom');
            expect(config.templateId).toBe('custom');
        });

        it('should return a copy of config (not reference)', () => {
            const config1 = getTemplateConfig('horizon');
            const config2 = getTemplateConfig('horizon');
            expect(config1).not.toBe(config2);
        });
    });

    describe('getAvailableTemplates', () => {
        it('should return all template IDs', () => {
            const templates = getAvailableTemplates();
            expect(templates).toContain('horizon');
            expect(templates).toContain('margin');
            expect(templates).toContain('l-frame');
            expect(templates).toContain('classic');
            expect(templates).toContain('custom');
        });

        it('should return array of TemplateId type', () => {
            const templates = getAvailableTemplates();
            templates.forEach((id) => {
                expect(['horizon', 'margin', 'l-frame', 'classic', 'custom']).toContain(id);
            });
        });
    });

    describe('getTemplateMetadata', () => {
        it('should return metadata for horizon template', () => {
            const meta = getTemplateMetadata('horizon');
            expect(meta.id).toBe('horizon');
            expect(meta.name).toBe('Horizon');
            expect(meta.description).toBeDefined();
            expect(meta.previewColors).toBeDefined();
        });

        it('should return metadata for all templates', () => {
            const templates: TemplateId[] = ['horizon', 'margin', 'l-frame', 'classic', 'custom'];
            templates.forEach((id) => {
                const meta = getTemplateMetadata(id);
                expect(meta.id).toBe(id);
                expect(meta.name).toBeDefined();
                expect(meta.description).toBeDefined();
            });
        });
    });

    describe('getAllTemplateMetadata', () => {
        it('should return all template metadata except custom', () => {
            const templates = getAllTemplateMetadata();
            expect(templates.length).toBe(4);
            expect(templates.find(t => t.id === 'custom')).toBeUndefined();
        });

        it('should include horizon, margin, l-frame, classic', () => {
            const templates = getAllTemplateMetadata();
            const ids = templates.map(t => t.id);
            expect(ids).toContain('horizon');
            expect(ids).toContain('margin');
            expect(ids).toContain('l-frame');
            expect(ids).toContain('classic');
        });

        it('should have preview colors for each template', () => {
            const templates = getAllTemplateMetadata();
            templates.forEach((meta) => {
                expect(meta.previewColors.bg).toBeDefined();
                expect(meta.previewColors.accent).toBeDefined();
                expect(meta.previewColors.text).toBeDefined();
            });
        });
    });
});
