import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const persistedFiles = new Map<string, Blob>();
const indexedDbStub = {} as IDBFactory;

class MockBrowserFileSystem {
    async writeFile(key: string, data: Blob): Promise<void> {
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
        vi.stubGlobal('indexedDB', indexedDbStub);
        persistedFiles.clear();
        sessionStorage.clear();
        setActivePinia(createPinia());
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
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(persistedFiles.size).toBe(0);
    });
});