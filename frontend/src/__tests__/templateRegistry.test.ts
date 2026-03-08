import { describe, expect, it } from 'vitest';
import { TEMPLATE_CONFIGS, TEMPLATE_METADATA } from '../modules/templateConfigs';
import {
    TEMPLATES,
    TEMPLATE_MAP,
    TEMPLATE_IDS,
    buildTemplateRegistry,
    defineTemplate,
} from '../modules/templates';

describe('template registry builder', () => {
    it('exports template ids derived from the canonical registry order', () => {
        expect(TEMPLATE_IDS).toEqual(TEMPLATES.map((template) => template.id));
    });

    it('keeps legacy config and metadata exports in sync with the canonical registry', () => {
        expect(Object.keys(TEMPLATE_CONFIGS)).toEqual(TEMPLATE_IDS);
        expect(Object.keys(TEMPLATE_METADATA)).toEqual(TEMPLATE_IDS);

        TEMPLATE_IDS.forEach((id) => {
            expect(TEMPLATE_CONFIGS[id]).toEqual(TEMPLATE_MAP[id].config);
            expect(TEMPLATE_METADATA[id]).toEqual(TEMPLATE_MAP[id].metadata);
        });
    });

    it('builds ids, map, configs, and metadata from a single template list', () => {
        const alpha = {
            id: 'mock-alpha',
            metadata: {
                id: 'mock-alpha',
                name: 'Mock Alpha',
                description: 'alpha',
                previewColors: { bg: '#000', accent: '#fff', text: '#fff' },
            },
            config: {
                templateId: 'mock-alpha',
                layoutMode: 'box',
                position: 'top-left',
                backgroundOpacity: 0,
                fontSizePercent: 2,
                showHr: true,
                showPace: true,
                showDistance: true,
                showTime: true,
                fontFamily: 'Inter, sans-serif',
                textColor: '#fff',
                backgroundColor: 'transparent',
                borderWidth: 0,
                borderColor: 'transparent',
                cornerRadius: 0,
                textShadow: false,
                textShadowColor: '#000',
                textShadowBlur: 0,
                lineSpacing: 1,
                layout: 'horizontal',
                iconStyle: 'none',
                gradientBackground: false,
                gradientStartColor: '#000',
                gradientEndColor: '#000',
                labelStyle: 'hidden',
                valueFontWeight: 'normal',
                valueSizeMultiplier: 1,
                labelSizeMultiplier: 0.5,
                labelLetterSpacing: 0.1,
                accentColor: '#fff',
            },
        } as const;

        const beta = {
            id: 'mock-beta',
            metadata: {
                id: 'mock-beta',
                name: 'Mock Beta',
                description: 'beta',
                previewColors: { bg: '#111', accent: '#0ff', text: '#fff' },
            },
            config: {
                templateId: 'mock-beta',
                layoutMode: 'hero-number',
                position: 'bottom-left',
                backgroundOpacity: 0,
                fontSizePercent: 2,
                showHr: true,
                showPace: true,
                showDistance: true,
                showTime: true,
                fontFamily: 'Inter, sans-serif',
                textColor: '#fff',
                backgroundColor: 'transparent',
                borderWidth: 0,
                borderColor: 'transparent',
                cornerRadius: 0,
                textShadow: false,
                textShadowColor: '#000',
                textShadowBlur: 0,
                lineSpacing: 1,
                layout: 'horizontal',
                iconStyle: 'none',
                gradientBackground: false,
                gradientStartColor: '#000',
                gradientEndColor: '#000',
                labelStyle: 'hidden',
                valueFontWeight: 'normal',
                valueSizeMultiplier: 1,
                labelSizeMultiplier: 0.5,
                labelLetterSpacing: 0.1,
                accentColor: '#fff',
            },
        } as const;

        const registry = buildTemplateRegistry([alpha, beta]);

        expect(registry.ids).toEqual(['mock-alpha', 'mock-beta']);
        expect(registry.map['mock-alpha']).toBe(alpha);
        expect(registry.map['mock-beta']).toBe(beta);
        expect(registry.configs['mock-alpha']).toEqual(alpha.config);
        expect(registry.metadata['mock-beta']).toEqual(beta.metadata);
    });

    it('defineTemplate fills metadata.id and config.templateId from a single id field', () => {
        const template = defineTemplate({
            id: 'mock-gamma',
            metadata: {
                name: 'Mock Gamma',
                description: 'gamma',
                previewColors: { bg: '#222', accent: '#f0f', text: '#fff' },
            },
            config: {
                layoutMode: 'box',
                position: 'top-right',
                backgroundOpacity: 0,
                fontSizePercent: 2,
                showHr: true,
                showPace: true,
                showDistance: true,
                showTime: true,
                fontFamily: 'Inter, sans-serif',
                textColor: '#fff',
                backgroundColor: 'transparent',
                borderWidth: 0,
                borderColor: 'transparent',
                cornerRadius: 0,
                textShadow: false,
                textShadowColor: '#000',
                textShadowBlur: 0,
                lineSpacing: 1,
                layout: 'horizontal',
                iconStyle: 'none',
                gradientBackground: false,
                gradientStartColor: '#000',
                gradientEndColor: '#000',
                labelStyle: 'hidden',
                valueFontWeight: 'normal',
                valueSizeMultiplier: 1,
                labelSizeMultiplier: 0.5,
                labelLetterSpacing: 0.1,
                accentColor: '#fff',
            },
        });

        expect(template.id).toBe('mock-gamma');
        expect(template.metadata.id).toBe('mock-gamma');
        expect(template.config.templateId).toBe('mock-gamma');
    });
});
