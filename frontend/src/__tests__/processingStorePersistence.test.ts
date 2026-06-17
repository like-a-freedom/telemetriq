import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const persistedFiles = new Map<string, Blob>();
const indexedDbStub = {} as IDBFactory;
const failingWriteKeys = new Set<string>();

class MockBrowserFileSystem {
    async writeFile(key: string, data: Blob): Promise<void> {
        if (failingWriteKeys.has(key)) {
            throw new Error(`Failed to persist ${key}`);
        }

        persistedFiles.set(key, data);
    }

    async readFile(key: string): Promise<Blob | null> {
        return persistedFiles.get(key) ?? null;
    }

    async deleteFile(key: string): Promise<void> {
        persistedFiles.delete(key);
    }

    async listFiles(): Promise<string[]> {
        return [...persistedFiles.keys()];
    }
}

vi.mock('../modules/fileSystem', () => ({
    BrowserFileSystem: MockBrowserFileSystem,
}));

describe('processingStore persisted result recovery', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useRealTimers();
        vi.stubGlobal('indexedDB', indexedDbStub);
        persistedFiles.clear();
        failingWriteKeys.clear();
        sessionStorage.clear();
        setActivePinia(createPinia());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('restores the processed result after a simulated app reload', async () => {
        const { useProcessingStore } = await import('../stores/processingStore');

        const firstStore = useProcessingStore();
        firstStore.startProcessing(24);

        const resultBlob = new Blob(['processed-video'], { type: 'video/mp4' });
        await firstStore.finalizeResult(resultBlob);

        setActivePinia(createPinia());

        const restoredStore = useProcessingStore();
        expect(restoredStore.hasResult).toBe(false);

        await restoredStore.restorePersistedResult();

        expect(restoredStore.hasResult).toBe(true);
        expect(restoredStore.isComplete).toBe(true);
        expect(restoredStore.resultBlob?.size).toBe(resultBlob.size);
        expect(restoredStore.resultUrl).toBeTruthy();
    });

    it('removes the persisted result when the flow is reset', async () => {
        const { useProcessingStore } = await import('../stores/processingStore');

        const store = useProcessingStore();
        store.startProcessing(12);
        await store.finalizeResult(new Blob(['processed-video'], { type: 'video/mp4' }));

        expect(persistedFiles.size).toBe(1);

        store.reset();
        await vi.waitFor(() => {
            expect(persistedFiles.size).toBe(0);
        });
    });

    it('keeps interrupted-processing recovery state when final result persistence fails', async () => {
        vi.useFakeTimers();

        const { useProcessingStore } = await import('../stores/processingStore');

        const store = useProcessingStore();
        store.setLastPersistedVideoFileName('long-run.mp4');
        store.startProcessing(1500);
        store.updateProgress({
            phase: 'muxing',
            percent: 80,
            framesProcessed: 1490,
            totalFrames: 1500,
        });

        await vi.advanceTimersByTimeAsync(5000);
        await vi.waitFor(() => {
            expect(persistedFiles.has('processing-state')).toBe(true);
        });

        failingWriteKeys.add('processing-result');

        await store.finalizeResult(new Blob(['processed-video'], { type: 'video/mp4' }));

        const interruptedState = await store.restorePersistedProcessingState();

        expect(interruptedState).toMatchObject({
            videoFileName: 'long-run.mp4',
            totalFrames: 1500,
            framesProcessed: 1490,
        });
    });
});