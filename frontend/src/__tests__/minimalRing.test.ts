/**
 * Unit tests for minimal-ring template module.
 */
import { describe, it, expect } from 'vitest';
import { minimalRingTemplate, drawMinimalRing } from '../modules/templates/minimalRing';

describe('minimal-ring template module', () => {
    describe('template definition', () => {
        it('should have correct id and metadata', () => {
            expect(minimalRingTemplate.id).toBe('minimal-ring');
            expect(minimalRingTemplate.metadata.name).toBe('Minimal Ring');
            expect(minimalRingTemplate.metadata.description).toContain('circular progress ring');
        });

        it('should have pace as required metric', () => {
            expect(minimalRingTemplate.capabilities.requiredMetrics).toContain('pace');
        });

        it('should not support time metric', () => {
            expect(minimalRingTemplate.capabilities.supportedMetrics).not.toContain('time');
        });

        it('should have correct supported metrics', () => {
            expect(minimalRingTemplate.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'power']);
        });

        it('should provide custom reason for unavailable time metric', () => {
            const reason = minimalRingTemplate.capabilities.getMetricUnavailableReason?.('time');
            expect(reason).toContain('Minimal Ring');
        });
    });

    describe('renderer export', () => {
        it('should export drawMinimalRing function with the standard layout contract', () => {
            expect(drawMinimalRing).toBeDefined();
            expect(typeof drawMinimalRing).toBe('function');
            // Standard draw* signature: (ctx, data, w, h, config, orientation, tuning)
            expect(drawMinimalRing.length).toBe(7);
        });

        it('should be self-contained module with both template and renderer', () => {
            expect(minimalRingTemplate).toBeDefined();
            expect(drawMinimalRing).toBeDefined();
            expect(minimalRingTemplate.config.layoutMode).toBe('minimal-ring');
        });
    });

    describe('template config', () => {
        it('should have layoutMode matching template id', () => {
            expect(minimalRingTemplate.config.layoutMode).toBe('minimal-ring');
        });

        it('should have position bottom-right', () => {
            expect(minimalRingTemplate.config.position).toBe('bottom-right');
        });

        it('should have showPace enabled', () => {
            expect(minimalRingTemplate.config.showPace).toBe(true);
        });

        it('template config should match capabilities', () => {
            expect(minimalRingTemplate.capabilities.requiredMetrics).toContain('pace');
            expect(minimalRingTemplate.config.showPace).toBe(true);

            expect(minimalRingTemplate.capabilities.supportedMetrics).not.toContain('time');
            expect(minimalRingTemplate.config.showTime).toBe(false);
        });
    });

    describe('template styles', () => {
        it('should have typography preset', () => {
            expect(minimalRingTemplate.styles.typography).toBeDefined();
            expect(minimalRingTemplate.styles.typography.valueFontWeight).toBe('light');
        });

        it('should have visual preset', () => {
            expect(minimalRingTemplate.styles.visual).toBeDefined();
            expect(minimalRingTemplate.styles.visual.textShadow).toBe(false);
        });
    });
});
