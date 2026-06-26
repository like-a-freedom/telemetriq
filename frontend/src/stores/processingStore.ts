import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ProcessingProgress } from '../core/types';
import { createEtaCalculator } from './storeUtils';
import { BrowserFileSystem } from '../modules/fileSystem';
import { shouldAvoidInlineResultPreview } from '../modules/videoProcessing/deviceProfile';
import { mapProgressPhase } from '../modules/videoProcessing/progressUtils';

const PERSISTED_RESULT_KEY = 'processing-result';
const PERSISTED_PROCESSING_STATE_KEY = 'processing-state';
const PROCESSING_STATE_PERSIST_INTERVAL_MS = 5000;

interface PersistedProcessingState {
    phase: ProcessingProgress['phase'];
    framesProcessed: number;
    totalFrames: number;
    videoFileName: string;
    timestampMs: number;
}

function createResultStorage(): BrowserFileSystem | null {
    const hasIndexedDb = typeof indexedDB !== 'undefined';
    const hasOpfs = typeof navigator !== 'undefined'
        && typeof navigator.storage?.getDirectory === 'function';

    if (!hasIndexedDb && !hasOpfs) return null;

    return new BrowserFileSystem();
}

export const useProcessingStore = defineStore('processing', () => {
    // State
    const isProcessing = ref(false);
    const progress = ref<ProcessingProgress>(createInitialProgress());
    const resultBlob = ref<Blob | null>(null);
    const resultUrl = ref<string | null>(null);
    const processingError = ref<string | null>(null);
    const processingWarning = ref<string | null>(null);
    const startedAtMs = ref<number | null>(null);
    const etaCalculator = ref<ReturnType<typeof createEtaCalculator> | null>(null);
    const resultStorage = createResultStorage();
    let persistTimer: ReturnType<typeof setInterval> | null = null;
    let lastPersistedVideoFileName = '';

    // Computed
    const isComplete = computed(() => progress.value.phase === 'complete');
    const hasResult = computed(() => resultBlob.value !== null);
    const progressPercent = computed(() => progress.value.percent);

    function revokeResultUrl(): void {
        if (resultUrl.value) {
            URL.revokeObjectURL(resultUrl.value);
            resultUrl.value = null;
        }
    }

    function syncResultUrl(blob: Blob): void {
        revokeResultUrl();

        if (!shouldAvoidInlineResultPreview()) {
            resultUrl.value = URL.createObjectURL(blob);
        }
    }

    // Actions
    function startProcessing(totalFrames: number): void {
        isProcessing.value = true;
        processingError.value = null;
        processingWarning.value = null;
        startedAtMs.value = Date.now();
        etaCalculator.value = createEtaCalculator(startedAtMs.value);
        resultBlob.value = null;
        deletePersistedResult();
        revokeResultUrl();

        progress.value = {
            phase: 'demuxing',
            percent: 0,
            framesProcessed: 0,
            totalFrames,
        };

        startPersistTimer();
    }

    function updateProgress(update: ProcessingProgress): void {
        const safePercent = mapProgressPhase(update.phase, update.percent, progress.value.percent);

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

        if (update.warning) {
            processingWarning.value = update.warning;
        }
    }

    function setResult(blob: Blob): void {
        stopPersistTimer();
        resultBlob.value = blob;
        syncResultUrl(blob);
        progress.value = {
            ...progress.value,
            phase: 'complete',
            percent: 100,
            estimatedRemainingSeconds: 0,
        };
        isProcessing.value = false;
    }

    async function finalizeResult(blob: Blob): Promise<void> {
        setResult(blob);
        const persisted = await persistResult(blob);
        if (persisted) {
            await deletePersistedProcessingState();
        }
    }

    function setError(message: string): void {
        stopPersistTimer();
        processingError.value = message;
        isProcessing.value = false;
    }

    function cancelProcessing(): void {
        resetProcessingState();
    }

    function reset(): void {
        revokeResultUrl();
        deletePersistedResult();
        resetProcessingState();
    }

    async function restorePersistedResult(): Promise<void> {
        if (resultBlob.value || !resultStorage) return;

        try {
            const persistedBlob = await resultStorage.readFile(PERSISTED_RESULT_KEY);
            if (!persistedBlob) return;

            resultBlob.value = persistedBlob;
            syncResultUrl(persistedBlob);
            processingError.value = null;
            isProcessing.value = false;
            startedAtMs.value = null;
            etaCalculator.value = null;
            progress.value = {
                phase: 'complete',
                percent: 100,
                framesProcessed: 0,
                totalFrames: 0,
                estimatedRemainingSeconds: 0,
            };
        } catch (error) {
            console.warn('[processingStore] Failed to restore persisted result', error);
        }
    }

    async function persistResult(blob: Blob): Promise<boolean> {
        if (!resultStorage) return false;

        try {
            await resultStorage.writeFile(PERSISTED_RESULT_KEY, blob);
            return true;
        } catch (error) {
            console.warn('[processingStore] Failed to persist result', error);
            return false;
        }
    }

    // Helpers
    function resetProcessingState(): void {
        stopPersistTimer();
        void deletePersistedProcessingState();
        isProcessing.value = false;
        processingError.value = null;
        processingWarning.value = null;
        startedAtMs.value = null;
        etaCalculator.value = null;
        resultBlob.value = null;
        revokeResultUrl();
        progress.value = createInitialProgress();
    }

    function deletePersistedResult(): void {
        if (!resultStorage) return;

        void resultStorage.deleteFile(PERSISTED_RESULT_KEY).catch((error) => {
            console.warn('[processingStore] Failed to delete persisted result', error);
        });
    }

    function startPersistTimer(): void {
        stopPersistTimer();
        persistTimer = setInterval(() => {
            if (!isProcessing.value || !lastPersistedVideoFileName) return;
            void persistProcessingState(lastPersistedVideoFileName);
        }, PROCESSING_STATE_PERSIST_INTERVAL_MS);
    }

    function stopPersistTimer(): void {
        if (persistTimer !== null) {
            clearInterval(persistTimer);
            persistTimer = null;
        }
    }

    async function persistProcessingState(videoFileName: string): Promise<void> {
        if (!resultStorage) return;

        const state: PersistedProcessingState = {
            phase: progress.value.phase,
            framesProcessed: progress.value.framesProcessed,
            totalFrames: progress.value.totalFrames,
            videoFileName,
            timestampMs: Date.now(),
        };

        try {
            await resultStorage.writeFile(
                PERSISTED_PROCESSING_STATE_KEY,
                new Blob([JSON.stringify(state)], { type: 'application/json' }),
            );
        } catch (error) {
            console.warn('[processingStore] Failed to persist processing state', error);
        }
    }

    async function restorePersistedProcessingState(): Promise<PersistedProcessingState | null> {
        if (!resultStorage) return null;

        try {
            const blob = await resultStorage.readFile(PERSISTED_PROCESSING_STATE_KEY);
            if (!blob) return null;

            const text = await blob.text();
            const state = JSON.parse(text) as PersistedProcessingState;

            // Sanity check: state must be recent (within last 30 minutes)
            if (Date.now() - state.timestampMs > 30 * 60 * 1000) {
                void deletePersistedProcessingState();
                return null;
            }

            return state;
        } catch (error) {
            console.warn('[processingStore] Failed to restore persisted processing state', error);
            return null;
        }
    }

    async function deletePersistedProcessingState(): Promise<void> {
        if (!resultStorage) return;

        try {
            await resultStorage.deleteFile(PERSISTED_PROCESSING_STATE_KEY);
        } catch {
            // best-effort cleanup
        }
    }

    function setLastPersistedVideoFileName(name: string): void {
        lastPersistedVideoFileName = name;
    }

    return {
        isProcessing,
        progress,
        resultBlob,
        resultUrl,
        processingError,
        processingWarning,
        isComplete,
        hasResult,
        progressPercent,
        startProcessing,
        updateProgress,
        setResult,
        finalizeResult,
        setError,
        cancelProcessing,
        reset,
        restorePersistedResult,
        restorePersistedProcessingState,
        deletePersistedProcessingState,
        setLastPersistedVideoFileName,
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
