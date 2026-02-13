import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('webgpu-adapter status helpers', () => {
    const storage = new Map<string, string>();

    beforeEach(() => {
        vi.resetModules();
        storage.clear();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                storage.set(key, value);
            },
            removeItem: (key: string) => {
                storage.delete(key);
            },
            clear: () => {
                storage.clear();
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('returns unavailable status when navigator.gpu is absent', async () => {
        vi.stubGlobal('navigator', {} as Navigator);

        const mod = await import('../modules/webgpu/webgpu-adapter');
        const status = mod.getWebGPUStatus();

        expect(status.supported).toBe(false);
        expect(status.enabled).toBe(false);
        expect(status.available).toBe(false);
        expect(mod.isWebGPUAvailable()).toBe(false);
    });

    it('toggles availability when gpu is supported', async () => {
        vi.stubGlobal('navigator', { gpu: {} } as Navigator);

        const mod = await import('../modules/webgpu/webgpu-adapter');

        mod.toggleWebGPU(false);
        expect(mod.getWebGPUStatus().enabled).toBe(false);
        expect(mod.isWebGPUAvailable()).toBe(false);

        mod.toggleWebGPU(true);
        const statusAfterEnable = mod.getWebGPUStatus();
        expect(statusAfterEnable.supported).toBe(true);
        expect(statusAfterEnable.enabled).toBe(true);
        expect(statusAfterEnable.available).toBe(true);
        expect(mod.isWebGPUAvailable()).toBe(true);
    });
});
