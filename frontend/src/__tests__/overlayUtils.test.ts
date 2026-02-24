/**
 * Unit tests for overlay-utils module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    clamp,
    getResolutionTuning,
    fontWeightValue,
    applyTextShadow,
    measureTrackedTextWidth,
    getMarginLabel,
} from '../modules/overlayUtils';

describe('overlay-utils', () => {
    describe('clamp', () => {
        it('should clamp value within range', () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(15, 0, 10)).toBe(10);
        });

        it('should handle edge cases', () => {
            expect(clamp(0, 0, 10)).toBe(0);
            expect(clamp(10, 0, 10)).toBe(10);
        });
    });

    describe('getResolutionTuning', () => {
        it('should return default scaling for 1080p', () => {
            const tuning = getResolutionTuning(1920, 1080);
            expect(tuning.textScale).toBeCloseTo(1, 1);
            expect(tuning.spacingScale).toBeCloseTo(1, 1);
            expect(tuning.labelTrackingScale).toBe(1);
        });

        it('should scale down for smaller resolutions', () => {
            const tuning = getResolutionTuning(1280, 720);
            expect(tuning.textScale).toBeLessThan(1);
            expect(tuning.spacingScale).toBeLessThan(1);
        });

        it('should scale up for larger resolutions', () => {
            const tuning = getResolutionTuning(3840, 2160);
            expect(tuning.textScale).toBeGreaterThan(1);
        });

        it('should use short side for scaling calculations', () => {
            const tuning = getResolutionTuning(1920, 1080);
            expect(tuning.textScale).toBeGreaterThan(0.86);
            expect(tuning.textScale).toBeLessThan(1.18);
        });

        it('should reduce label tracking for small screens', () => {
            const tuning = getResolutionTuning(800, 480);
            expect(tuning.labelTrackingScale).toBe(0.82);
        });
    });

    describe('fontWeightValue', () => {
        it('should return numeric weight values', () => {
            expect(fontWeightValue('light')).toBe(300);
            expect(fontWeightValue('normal')).toBe(400);
            expect(fontWeightValue('bold')).toBe(700);
        });

        it('should return 400 for unknown weights', () => {
            expect(fontWeightValue('unknown')).toBe(400);
            expect(fontWeightValue('')).toBe(400);
        });
    });

    describe('getMarginLabel', () => {
        it('should return abbreviations for known labels', () => {
            expect(getMarginLabel('Heart Rate')).toBe('HR');
            expect(getMarginLabel('heart rate')).toBe('HR');
            expect(getMarginLabel('HEART RATE')).toBe('HR');
            expect(getMarginLabel('Distance')).toBe('DIST');
        });

        it('should uppercase unknown labels', () => {
            expect(getMarginLabel('Speed')).toBe('SPEED');
            expect(getMarginLabel('Cadence')).toBe('CADENCE');
        });
    });

    describe('applyTextShadow', () => {
        let mockCtx: any;

        beforeEach(() => {
            mockCtx = {
                shadowColor: '',
                shadowBlur: 0,
                shadowOffsetX: 0,
                shadowOffsetY: 0,
            };
        });

        it('should apply text shadow when enabled', () => {
            const config = {
                textShadow: true,
                textShadowColor: '#000000',
                textShadowBlur: 4,
            };
            applyTextShadow(mockCtx, config as any);
            expect(mockCtx.shadowColor).toBe('#000000');
            expect(mockCtx.shadowBlur).toBe(4);
        });

        it('should not apply shadow when disabled', () => {
            const config = { textShadow: false };
            applyTextShadow(mockCtx, config as any);
            expect(mockCtx.shadowColor).toBe('');
        });

        it('should not apply shadow when color not specified', () => {
            const config = { textShadow: true };
            applyTextShadow(mockCtx, config as any);
            expect(mockCtx.shadowColor).toBe('');
        });
    });

    describe('measureTrackedTextWidth', () => {
        let mockCtx: any;

        beforeEach(() => {
            mockCtx = {
                measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
            };
        });

        it('should return 0 for empty text', () => {
            expect(measureTrackedTextWidth(mockCtx, '', 0.1, 12)).toBe(0);
        });

        it('should calculate width with letter spacing', () => {
            const width = measureTrackedTextWidth(mockCtx, 'ABC', 0.1, 12);
            expect(width).toBeGreaterThan(0);
        });
    });
});
