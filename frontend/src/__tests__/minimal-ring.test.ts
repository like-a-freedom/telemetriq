/**
 * Unit tests for minimal-ring template module.
 */
import { describe, it, expect } from 'vitest';
import { minimalRingTemplate, renderMinimalRing } from '../modules/templates/minimal-ring';

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
            expect(minimalRingTemplate.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance']);
        });

        it('should provide custom reason for unavailable time metric', () => {
            const reason = minimalRingTemplate.capabilities.getMetricUnavailableReason?.('time');
            expect(reason).toContain('Minimal Ring');
        });
    });

    describe('renderer export', () => {
        it('should export renderMinimalRing function', () => {
            expect(renderMinimalRing).toBeDefined();
            expect(typeof renderMinimalRing).toBe('function');
        });

        it('should be self-contained module with both template and renderer', () => {
            // Verify the module exports both definition and renderer
            expect(minimalRingTemplate).toBeDefined();
            expect(renderMinimalRing).toBeDefined();
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
            // Capabilities say pace is required, config should have it enabled
            expect(minimalRingTemplate.capabilities.requiredMetrics).toContain('pace');
            expect(minimalRingTemplate.config.showPace).toBe(true);
            
            // Capabilities say time is not supported, config should have it disabled
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
