import type { ProcessingProgress } from '../core/types';

const PROGRESS_UPDATE_MIN_INTERVAL_MS = 120;

const PHASE_PERCENT_RANGES: Record<ProcessingProgress['phase'], { min: number; max: number }> = {
    demuxing: { min: 0, max: 5 },
    encoding: { min: 5, max: 85 },
    processing: { min: 5, max: 92 },
    muxing: { min: 92, max: 99 },
    complete: { min: 100, max: 100 },
};

function clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

function mapPhasePercent(phase: ProcessingProgress['phase'], rawPercent: number): number {
    if (phase === 'complete') return 100;

    const { min, max } = PHASE_PERCENT_RANGES[phase];
    const normalized = clampPercent(rawPercent) / 100;
    return Math.round(min + (max - min) * normalized);
}

export interface ProcessingProgressReporter {
    report(framesProcessed: number, force?: boolean): void;
}

export interface MuxProgressReporter {
    report(percent: number, framesProcessed: number): void;
}

export function createProcessingProgressReporter(
    onProgress: ((progress: ProcessingProgress) => void) | undefined,
    totalFrames: number,
): ProcessingProgressReporter {
    let lastReportAt = 0;

    return {
        report(framesProcessed: number, force = false): void {
            if (!onProgress) return;

            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const percent = totalFrames > 0
                ? Math.round((framesProcessed / totalFrames) * 100)
                : 0;

            const shouldReport = force
                || framesProcessed === totalFrames
                || framesProcessed === 0
                || now - lastReportAt >= PROGRESS_UPDATE_MIN_INTERVAL_MS;

            if (!shouldReport) return;

            lastReportAt = now;

            onProgress({
                phase: 'processing',
                percent,
                framesProcessed,
                totalFrames,
            });
        },
    };
}

export function createMuxProgressReporter(
    onProgress: ((progress: ProcessingProgress) => void) | undefined,
    totalFrames: number,
): MuxProgressReporter {
    return {
        report(percent: number, framesProcessed: number): void {
            if (!onProgress) return;

            const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
            onProgress({
                phase: 'muxing',
                percent: safePercent,
                framesProcessed,
                totalFrames,
            });
        },
    };
}

export interface EtaCalculator {
    update(currentPercent: number): number | undefined;
}

export function createEtaCalculator(startedAtMs: number | null): EtaCalculator {
    let smoothedEtaSeconds: number | null = null;

    return {
        update(currentPercent: number): number | undefined {
            if (!startedAtMs || currentPercent <= 0 || currentPercent >= 100) {
                return undefined;
            }

            const elapsedSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000);
            const rawEtaSeconds = elapsedSeconds * ((100 - currentPercent) / currentPercent);
            smoothedEtaSeconds = smoothedEtaSeconds === null
                ? rawEtaSeconds
                : smoothedEtaSeconds * 0.7 + rawEtaSeconds * 0.3;

            return Math.max(0, Math.round(smoothedEtaSeconds));
        },
    };
}

export function mapProgressPhase(
    phase: ProcessingProgress['phase'],
    rawPercent: number,
    previousPercent: number,
): number {
    const mappedPercent = mapPhasePercent(phase, rawPercent);
    return phase === 'complete'
        ? 100
        : Math.min(99, Math.max(previousPercent, mappedPercent));
}
