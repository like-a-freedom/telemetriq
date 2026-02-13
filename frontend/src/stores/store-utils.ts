/**
 * Store utilities for common patterns across Pinia stores.
 */

import type { ProcessingProgress } from '../core/types';
import {
    createEtaCalculator as createBaseEtaCalculator,
    mapProgressPhase as mapBaseProgressPhase,
} from '../modules/progress-utils';

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

export function formatErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    try {
        const serialized = JSON.stringify(err);
        return serialized === undefined || serialized === '{}' ? 'Unknown error' : serialized;
    } catch {
        return 'Unknown error';
    }
}

export function formatErrorDetails(details: Record<string, unknown>): string {
    if (typeof details.details === 'string') return details.details;
    try {
        return JSON.stringify(details, null, 2);
    } catch {
        return '';
    }
}

export function normalizeProcessingError(err: unknown): string {
    // Prefer errors with details so we display helpful diagnostics when available
    const error = err as { details?: Record<string, unknown>; message?: string };
    if (error?.details) {
        const details = formatErrorDetails(error.details);
        return details ? `${error.message}\n\n${details}` : (error.message ?? 'Unknown error');
    }

    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    
    try {
        const serialized = JSON.stringify(err);
        return serialized === undefined || serialized === '{}' ? 'Unknown processing error' : serialized;
    } catch {
        return 'Unknown processing error';
    }
}
