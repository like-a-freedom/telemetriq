import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ProcessingProgress } from '../core/types';
import { createEtaCalculator } from './storeUtils';

const PHASE_PERCENT_RANGES: Record<ProcessingProgress['phase'], { min: number; max: number }> = {
    demuxing: { min: 0, max: 5 },
    encoding: { min: 5, max: 85 },
    processing: { min: 5, max: 92 },
    muxing: { min: 92, max: 99 },
    complete: { min: 100, max: 100 },
};

export const useProcessingStore = defineStore('processing', () => {
    // State
    const isProcessing = ref(false);
    const progress = ref<ProcessingProgress>(createInitialProgress());
    const resultBlob = ref<Blob | null>(null);
    const resultUrl = ref<string | null>(null);
    const processingError = ref<string | null>(null);
    const startedAtMs = ref<number | null>(null);
    const etaCalculator = ref<ReturnType<typeof createEtaCalculator> | null>(null);

    // Computed
    const isComplete = computed(() => progress.value.phase === 'complete');
    const hasResult = computed(() => resultBlob.value !== null);
    const progressPercent = computed(() => progress.value.percent);

    // Actions
    function startProcessing(totalFrames: number): void {
        isProcessing.value = true;
        processingError.value = null;
        startedAtMs.value = Date.now();
        etaCalculator.value = createEtaCalculator(startedAtMs.value);
        resultBlob.value = null;

        if (resultUrl.value) {
            URL.revokeObjectURL(resultUrl.value);
            resultUrl.value = null;
        }

        progress.value = {
            phase: 'demuxing',
            percent: 0,
            framesProcessed: 0,
            totalFrames,
        };
    }

    function updateProgress(update: ProcessingProgress): void {
        const mappedPercent = calculateMappedPercent(update.phase, update.percent);
        const safePercent = calculateSafePercent(update.phase, mappedPercent, progress.value.percent);

        const estimatedRemainingSeconds = calculateEta(
            safePercent,
            update.estimatedRemainingSeconds,
            etaCalculator.value,
        );

        progress.value = {
            ...update,
            percent: safePercent,
            estimatedRemainingSeconds,
        };
    }

    function setResult(blob: Blob): void {
        resultBlob.value = blob;
        resultUrl.value = URL.createObjectURL(blob);
        progress.value = {
            ...progress.value,
            phase: 'complete',
            percent: 100,
            estimatedRemainingSeconds: 0,
        };
        isProcessing.value = false;
    }

    function setError(message: string): void {
        processingError.value = message;
        isProcessing.value = false;
    }

    function cancelProcessing(): void {
        resetProcessingState();
    }

    function reset(): void {
        if (resultUrl.value) {
            URL.revokeObjectURL(resultUrl.value);
        }
        resetProcessingState();
    }

    // Helpers
    function resetProcessingState(): void {
        isProcessing.value = false;
        processingError.value = null;
        startedAtMs.value = null;
        etaCalculator.value = null;
        resultBlob.value = null;
        resultUrl.value = null;
        progress.value = createInitialProgress();
    }

    return {
        isProcessing,
        progress,
        resultBlob,
        resultUrl,
        processingError,
        isComplete,
        hasResult,
        progressPercent,
        startProcessing,
        updateProgress,
        setResult,
        setError,
        cancelProcessing,
        reset,
    };
});

function createInitialProgress(): ProcessingProgress {
    return {
        phase: 'demuxing',
        percent: 0,
        framesProcessed: 0,
        totalFrames: 0,
    };
}

function calculateMappedPercent(phase: ProcessingProgress['phase'], rawPercent: number): number {
    if (phase === 'complete') return 100;

    const { min, max } = PHASE_PERCENT_RANGES[phase];
    const normalized = Math.max(0, Math.min(100, rawPercent)) / 100;
    return Math.round(min + (max - min) * normalized);
}

function calculateSafePercent(
    phase: ProcessingProgress['phase'],
    mappedPercent: number,
    previousPercent: number,
): number {
    return phase === 'complete'
        ? 100
        : Math.min(99, Math.max(previousPercent, mappedPercent));
}

function calculateEta(
    currentPercent: number,
    providedEta: number | undefined,
    calculator: ReturnType<typeof createEtaCalculator> | null,
): number | undefined {
    if (Number.isFinite(providedEta)) {
        return providedEta;
    }

    return calculator?.update(currentPercent);
}
