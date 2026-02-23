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
    isMetricAvailable,
    isMetricRequired,
    getMetricUnavailableReason,
} from '../modules/templates';
import type { TemplateId } from '../core/types';
import type { TemplateCapabilities } from '../modules/templates/types';

describe('templates registry', () => {
    const allTemplateIds: TemplateId[] = [
        'horizon', 'margin', 'l-frame', 'classic',
        'arc-gauge', 'hero-number', 'cinematic-bar',
        'editorial', 'ticker-tape', 'whisper', 'two-tone',
        'condensed-strip', 'soft-rounded', 'thin-line', 'swiss-grid',
        'garmin-style', 'sports-broadcast', 'cockpit-hud',
        'terminal', 'night-runner', 'data-block', 'race-tag',
        'glass-panel', 'minimal-ring', 'stretched-bar',
        'focus-type',
        'custom',
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
            expect(TEMPLATE_MAP['arc-gauge']).toBe(arcGaugeTemplate);
            expect(TEMPLATE_MAP['hero-number']).toBe(heroNumberTemplate);
            expect(TEMPLATE_MAP['cinematic-bar']).toBe(cinematicBarTemplate);
            expect(TEMPLATE_MAP['editorial']).toBe(editorialTemplate);
            expect(TEMPLATE_MAP['ticker-tape']).toBe(tickerTapeTemplate);
            expect(TEMPLATE_MAP['whisper']).toBe(whisperTemplate);
            expect(TEMPLATE_MAP['two-tone']).toBe(twoToneTemplate);
            expect(TEMPLATE_MAP['condensed-strip']).toBe(condensedStripTemplate);
            expect(TEMPLATE_MAP['soft-rounded']).toBe(softRoundedTemplate);
            expect(TEMPLATE_MAP['thin-line']).toBe(thinLineTemplate);
            expect(TEMPLATE_MAP['swiss-grid']).toBe(swissGridTemplate);
            expect(TEMPLATE_MAP['garmin-style']).toBe(garminStyleTemplate);
            expect(TEMPLATE_MAP['sports-broadcast']).toBe(sportsBroadcastTemplate);
            expect(TEMPLATE_MAP['cockpit-hud']).toBe(cockpitHudTemplate);
            expect(TEMPLATE_MAP['terminal']).toBe(terminalTemplate);
            expect(TEMPLATE_MAP['night-runner']).toBe(nightRunnerTemplate);
            expect(TEMPLATE_MAP['data-block']).toBe(dataBlockTemplate);
            expect(TEMPLATE_MAP['race-tag']).toBe(raceTagTemplate);
            expect(TEMPLATE_MAP['glass-panel']).toBe(glassPanelTemplate);
            expect(TEMPLATE_MAP['minimal-ring']).toBe(minimalRingTemplate);
            expect(TEMPLATE_MAP['stretched-bar']).toBe(stretchedBarTemplate);
            expect(TEMPLATE_MAP['focus-type']).toBe(focusTypeTemplate);
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
            expect(arcGaugeTemplate.config.layoutMode).toBe('arc-gauge');
            expect(heroNumberTemplate.config.layoutMode).toBe('hero-number');
            expect(cinematicBarTemplate.config.layoutMode).toBe('cinematic-bar');
            expect(editorialTemplate.config.layoutMode).toBe('editorial');
            expect(tickerTapeTemplate.config.layoutMode).toBe('ticker-tape');
            expect(whisperTemplate.config.layoutMode).toBe('whisper');
            expect(twoToneTemplate.config.layoutMode).toBe('two-tone');
            expect(condensedStripTemplate.config.layoutMode).toBe('condensed-strip');
            expect(softRoundedTemplate.config.layoutMode).toBe('soft-rounded');
            expect(thinLineTemplate.config.layoutMode).toBe('thin-line');
            expect(swissGridTemplate.config.layoutMode).toBe('swiss-grid');
            expect(garminStyleTemplate.config.layoutMode).toBe('garmin-style');
            expect(sportsBroadcastTemplate.config.layoutMode).toBe('sports-broadcast');
            expect(cockpitHudTemplate.config.layoutMode).toBe('cockpit-hud');
            expect(terminalTemplate.config.layoutMode).toBe('terminal');
            expect(nightRunnerTemplate.config.layoutMode).toBe('night-runner');
            expect(dataBlockTemplate.config.layoutMode).toBe('data-block');
            expect(raceTagTemplate.config.layoutMode).toBe('race-tag');
            expect(glassPanelTemplate.config.layoutMode).toBe('glass-panel');
            expect(minimalRingTemplate.config.layoutMode).toBe('minimal-ring');
            expect(stretchedBarTemplate.config.layoutMode).toBe('stretched-bar');
            expect(focusTypeTemplate.config.layoutMode).toBe('focus-type');
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

    describe('template capabilities', () => {
        describe('minimal-ring template', () => {
            it('should only support pace, hr, and distance metrics', () => {
                expect(minimalRingTemplate.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance']);
            });

            it('should require pace metric', () => {
                expect(minimalRingTemplate.capabilities.requiredMetrics).toEqual(['pace']);
            });

            it('should not support position changes', () => {
                expect(minimalRingTemplate.capabilities.supportsPosition).toBe(false);
            });

            it('should not support background opacity', () => {
                expect(minimalRingTemplate.capabilities.supportsBackgroundOpacity).toBe(false);
            });

            it('should not support gradient', () => {
                expect(minimalRingTemplate.capabilities.supportsGradient).toBe(false);
            });

            it('should provide custom reason for unavailable time metric', () => {
                const reason = minimalRingTemplate.capabilities.getMetricUnavailableReason?.('time');
                expect(reason).toBe('Minimal Ring only supports Pace, Heart Rate, and Distance');
            });

            it('should return undefined for available metrics', () => {
                const reason = minimalRingTemplate.capabilities.getMetricUnavailableReason?.('pace');
                expect(reason).toBeUndefined();
            });
        });

        describe('classic template', () => {
            it('should support all metrics', () => {
                expect(classicTemplate.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time']);
            });

            it('should have no required metrics', () => {
                expect(classicTemplate.capabilities.requiredMetrics).toEqual([]);
            });

            it('should support position changes', () => {
                expect(classicTemplate.capabilities.supportsPosition).toBe(true);
            });

            it('should support all features', () => {
                const caps = classicTemplate.capabilities;
                expect(caps.supportsBackgroundOpacity).toBe(true);
                expect(caps.supportsGradient).toBe(true);
                expect(caps.supportsBorder).toBe(true);
                expect(caps.supportsTextShadow).toBe(true);
                expect(caps.supportsAccentColor).toBe(true);
                expect(caps.supportsLayoutDirection).toBe(true);
            });
        });

        describe('horizon template', () => {
            it('should support all metrics', () => {
                expect(horizonTemplate.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time']);
            });

            it('should not support position changes (fixed bottom bar)', () => {
                expect(horizonTemplate.capabilities.supportsPosition).toBe(false);
            });

            it('should not support layout direction changes', () => {
                expect(horizonTemplate.capabilities.supportsLayoutDirection).toBe(false);
            });
        });

        describe('helper functions', () => {
            it('isMetricAvailable should return true for supported metrics', () => {
                expect(isMetricAvailable(minimalRingTemplate.capabilities, 'pace')).toBe(true);
                expect(isMetricAvailable(minimalRingTemplate.capabilities, 'hr')).toBe(true);
                expect(isMetricAvailable(minimalRingTemplate.capabilities, 'distance')).toBe(true);
            });

            it('isMetricAvailable should return false for unsupported metrics', () => {
                expect(isMetricAvailable(minimalRingTemplate.capabilities, 'time')).toBe(false);
            });

            it('isMetricRequired should return true for required metrics', () => {
                expect(isMetricRequired(minimalRingTemplate.capabilities, 'pace')).toBe(true);
            });

            it('isMetricRequired should return false for non-required metrics', () => {
                expect(isMetricRequired(minimalRingTemplate.capabilities, 'hr')).toBe(false);
            });

            it('getMetricUnavailableReason should return custom reason', () => {
                const reason = getMetricUnavailableReason(minimalRingTemplate.capabilities, 'time');
                expect(reason).toBe('Minimal Ring only supports Pace, Heart Rate, and Distance');
            });

            it('getMetricUnavailableReason should return default reason for unsupported metrics', () => {
                const customCaps: TemplateCapabilities = {
                    ...minimalRingTemplate.capabilities,
                    getMetricUnavailableReason: undefined,
                };
                const reason = getMetricUnavailableReason(customCaps, 'time');
                expect(reason).toBe('Time is not supported by this template');
            });
        });
    });

    describe('template styles', () => {
        it('minimal-ring should have correct typography preset', () => {
            const styles = minimalRingTemplate.styles.typography;
            expect(styles.valueFontWeight).toBe('light');
            expect(styles.valueSizeMultiplier).toBe(1.6);
            expect(styles.labelSizeMultiplier).toBe(0.32);
        });

        it('minimal-ring should have correct visual preset', () => {
            const styles = minimalRingTemplate.styles.visual;
            expect(styles.textShadow).toBe(false);
            expect(styles.borderWidth).toBe(0);
            expect(styles.iconStyle).toBe('none');
        });

        it('classic should have bold values', () => {
            const styles = classicTemplate.styles.typography;
            expect(styles.valueFontWeight).toBe('bold');
        });
    });
});
