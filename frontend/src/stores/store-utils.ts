/**
 * Store utilities for common patterns across Pinia stores.
 */

import type { ProcessingProgress } from '../core/types';
import {
    createEtaCalculator as createBaseEtaCalculator,
    mapProgressPhase as mapBaseProgressPhase,
} from '../modules/progress-utils';

// Re-export error formatters for backward compatibility
export { formatErrorMessage, formatErrorDetails, normalizeProcessingError } from './error-formatter';

export interface EtaCalculator {
    update(currentPercent: number): number | undefined;
}

export function createEtaCalculator(startedAtMs: number | null): EtaCalculator {
    const baseCalculator = createBaseEtaCalculator(startedAtMs);
    return {
        update(currentPercent: number): number | undefined {
            return baseCalculator.update(currentPercent);
        },
    };
}

export function mapProgressPhase(
    phase: ProcessingProgress['phase'],
    rawPercent: number,
    previousPercent: number,
): number {
    return mapBaseProgressPhase(phase, rawPercent, previousPercent);
}

export function safeNumber(value: unknown, defaultValue: number): number {
    return Number.isFinite(value) ? (value as number) : defaultValue;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
