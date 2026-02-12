import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ProcessingProgress } from '../core/types';

export const useProcessingStore = defineStore('processing', () => {
    // State
    const isProcessing = ref(false);
    const progress = ref<ProcessingProgress>({
        phase: 'demuxing',
        percent: 0,
        framesProcessed: 0,
        totalFrames: 0,
    });
    const resultBlob = ref<Blob | null>(null);
    const resultUrl = ref<string | null>(null);
    const processingError = ref<string | null>(null);

    // Computed
    const isComplete = computed(() => progress.value.phase === 'complete');
    const hasResult = computed(() => resultBlob.value !== null);
    const progressPercent = computed(() => progress.value.percent);

    // Actions
    function startProcessing(totalFrames: number): void {
        isProcessing.value = true;
        processingError.value = null;
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
        progress.value = update;
    }

    function setResult(blob: Blob): void {
        resultBlob.value = blob;
        resultUrl.value = URL.createObjectURL(blob);
        progress.value = {
            ...progress.value,
            phase: 'complete',
            percent: 100,
        };
        isProcessing.value = false;
    }

    function setError(message: string): void {
        processingError.value = message;
        isProcessing.value = false;
    }

    function cancelProcessing(): void {
        isProcessing.value = false;
        progress.value = {
            phase: 'demuxing',
            percent: 0,
            framesProcessed: 0,
            totalFrames: 0,
        };
    }

    function reset(): void {
        isProcessing.value = false;
        processingError.value = null;
        if (resultUrl.value) {
            URL.revokeObjectURL(resultUrl.value);
        }
        resultBlob.value = null;
        resultUrl.value = null;
        progress.value = {
            phase: 'demuxing',
            percent: 0,
            framesProcessed: 0,
            totalFrames: 0,
        };
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
