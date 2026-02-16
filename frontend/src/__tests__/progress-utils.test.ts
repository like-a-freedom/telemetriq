/**
 * Unit tests for progress-utils module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createProcessingProgressReporter,
    createMuxProgressReporter,
    createEtaCalculator,
    mapProgressPhase,
} from '../modules/progress-utils';

describe('progress-utils', () => {
    describe('createProcessingProgressReporter', () => {
        let onProgress: any;

        beforeEach(() => {
            onProgress = vi.fn();
        });

        it('should call onProgress with correct structure', () => {
            const reporter = createProcessingProgressReporter(onProgress, 100);
            reporter.report(50);

            expect(onProgress).toHaveBeenCalledWith({
                phase: 'processing',
                percent: 50,
                framesProcessed: 50,
                totalFrames: 100,
            });
        });

        it('should not call onProgress when no callback provided', () => {
            const reporter = createProcessingProgressReporter(undefined, 100);
            expect(() => reporter.report(50)).not.toThrow();
        });

        it('should handle zero totalFrames', () => {
            const reporter = createProcessingProgressReporter(onProgress, 0);
            reporter.report(0);

            expect(onProgress).toHaveBeenCalledWith({
                phase: 'processing',
                percent: 0,
                framesProcessed: 0,
                totalFrames: 0,
            });
        });

        it('should report at start and end regardless of interval', () => {
            const reporter = createProcessingProgressReporter(onProgress, 100);
            reporter.report(0);
            reporter.report(100, true);

            expect(onProgress).toHaveBeenCalledTimes(2);
        });
    });

    describe('createMuxProgressReporter', () => {
        let onProgress: any;

        beforeEach(() => {
            onProgress = vi.fn();
        });

        it('should call onProgress with correct phase', () => {
            const reporter = createMuxProgressReporter(onProgress, 100);
            reporter.report(50, 50);

            expect(onProgress).toHaveBeenCalledWith({
                phase: 'muxing',
                percent: 50,
                framesProcessed: 50,
                totalFrames: 100,
            });
        });

        it('should clamp percent to 0-100', () => {
            const reporter = createMuxProgressReporter(onProgress, 100);
            reporter.report(150, 50);
            expect(onProgress).toHaveBeenCalledWith(
                expect.objectContaining({ percent: 100 })
            );

            onProgress.mockClear();
            reporter.report(-50, 50);
            expect(onProgress).toHaveBeenCalledWith(
                expect.objectContaining({ percent: 0 })
            );
        });

        it('should round percent values', () => {
            const reporter = createMuxProgressReporter(onProgress, 100);
            reporter.report(33.7, 33);

            expect(onProgress).toHaveBeenCalledWith(
                expect.objectContaining({ percent: 34 })
            );
        });
    });

    describe('createEtaCalculator', () => {
        it('should return undefined when startedAtMs is null', () => {
            const calculator = createEtaCalculator(null);
            expect(calculator.update(50)).toBeUndefined();
        });

        it('should return undefined at 0% progress', () => {
            const startedAtMs = Date.now();
            const calculator = createEtaCalculator(startedAtMs);
            expect(calculator.update(0)).toBeUndefined();
        });

        it('should return undefined at 100% progress', () => {
            const startedAtMs = Date.now() - 1000;
            const calculator = createEtaCalculator(startedAtMs);
            expect(calculator.update(100)).toBeUndefined();
        });

        it('should calculate ETA based on elapsed time', () => {
            const now = Date.now();
            const startedAtMs = now - 10000; // Started 10 seconds ago

            const calculator = createEtaCalculator(startedAtMs);
            const eta = calculator.update(50);

            expect(eta).toBeGreaterThan(0);
            expect(typeof eta).toBe('number');
        });

        it('should smooth ETA over multiple updates', () => {
            const now = Date.now();
            const startedAtMs = now - 10000;

            const calculator = createEtaCalculator(startedAtMs);

            const eta1 = calculator.update(50);
            const eta2 = calculator.update(60);

            expect(eta1).toBeDefined();
            expect(eta2).toBeDefined();
        });
    });

    describe('mapProgressPhase', () => {
        it('should return 100 for complete phase', () => {
            expect(mapProgressPhase('complete', 50, 0)).toBe(100);
        });

        it('should map demuxing phase correctly', () => {
            expect(mapProgressPhase('demuxing', 50, 0)).toBe(3);
            expect(mapProgressPhase('demuxing', 100, 0)).toBe(5);
        });

        it('should map processing phase correctly', () => {
            expect(mapProgressPhase('processing', 50, 0)).toBe(49);
        });

        it('should use previous percent as minimum', () => {
            expect(mapProgressPhase('processing', 10, 30)).toBe(30);
        });

        it('should not clamp to 99 for non-complete phases at 100%', () => {
            expect(mapProgressPhase('processing', 100, 0)).toBe(92);
        });
    });
});
