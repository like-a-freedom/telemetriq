/**
 * Unit tests for store-utils module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clamp } from '../modules/overlayUtils';
import {
    createEtaCalculator,
    mapProgressPhase,
    safeNumber,
    formatErrorMessage,
    formatErrorDetails,
    normalizeProcessingError,
} from '../stores/storeUtils';

describe('store-utils', () => {
    describe('createEtaCalculator', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return undefined when startedAtMs is null', () => {
            const calculator = createEtaCalculator(null);
            expect(calculator.update(50)).toBeUndefined();
        });

        it('should calculate ETA at 50% progress', () => {
            const startedAtMs = Date.now() - 10_000;
            const calculator = createEtaCalculator(startedAtMs);
            const eta = calculator.update(50);

            expect(eta).toBe(10);
        });

        it('should smooth ETA over multiple updates', () => {
            const startedAtMs = Date.now() - 10_000;
            const calculator = createEtaCalculator(startedAtMs);

            calculator.update(25);
            vi.advanceTimersByTime(1000);
            const eta2 = calculator.update(50);

            expect(eta2).toBeDefined();
            expect(typeof eta2).toBe('number');
        });
    });

    describe('mapProgressPhase', () => {
        it('should return 100 for complete phase', () => {
            expect(mapProgressPhase('complete', 0, 0)).toBe(100);
        });

        it('should map demuxing to 0-5%', () => {
            expect(mapProgressPhase('demuxing', 0, 0)).toBe(0);
            expect(mapProgressPhase('demuxing', 100, 0)).toBe(5);
        });

        it('should use previous percent as minimum', () => {
            expect(mapProgressPhase('processing', 10, 30)).toBe(30);
        });
    });

    describe('safeNumber', () => {
        it('should return value when it is finite', () => {
            expect(safeNumber(42, 0)).toBe(42);
            expect(safeNumber(-5, 0)).toBe(-5);
        });

        it('should return default when value is not finite', () => {
            expect(safeNumber(NaN, 0)).toBe(0);
            expect(safeNumber(Infinity, 0)).toBe(0);
            expect(safeNumber(-Infinity, 0)).toBe(0);
        });
    });

    describe('clamp', () => {
        it('should clamp values within range', () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(15, 0, 10)).toBe(10);
        });
    });

    describe('formatErrorMessage', () => {
        it('should return error message for Error objects', () => {
            expect(formatErrorMessage(new Error('test error'))).toBe('test error');
        });

        it('should return string as is', () => {
            expect(formatErrorMessage('string error')).toBe('string error');
        });

        it('should serialize objects', () => {
            expect(formatErrorMessage({ foo: 'bar' })).toContain('foo');
        });

        it('should handle circular references', () => {
            const obj: any = {};
            obj.self = obj;
            expect(formatErrorMessage(obj)).toBe('Unknown error');
        });
    });

    describe('formatErrorDetails', () => {
        it('should return details string when available', () => {
            const details = { details: 'Detailed error info' };
            expect(formatErrorDetails(details)).toBe('Detailed error info');
        });

        it('should serialize object details', () => {
            const details = { key: 'value', count: 42 };
            const result = formatErrorDetails(details);
            expect(result).toContain('key');
            expect(result).toContain('value');
        });

        it('should handle empty details', () => {
            expect(formatErrorDetails({})).toBe('');
        });
    });

    describe('normalizeProcessingError', () => {
        it('should handle errors with details property', () => {
            const err = {
                message: 'Base error',
                details: { details: 'Extra context' }
            };
            // Plain objects are serialized, not formatted with details
            expect(normalizeProcessingError(err)).toContain('Base error');
        });

        it('should handle Error instances', () => {
            expect(normalizeProcessingError(new Error('test'))).toBe('test');
        });

        it('should handle string errors', () => {
            expect(normalizeProcessingError('error message')).toBe('error message');
        });

        it('should serialize object errors', () => {
            expect(normalizeProcessingError({ foo: 'bar' })).toContain('foo');
        });

        it('should return default message for unknown errors', () => {
            const obj: any = {};
            obj.self = obj;
            expect(normalizeProcessingError(obj)).toBe('Unknown error');
        });
    });
});
