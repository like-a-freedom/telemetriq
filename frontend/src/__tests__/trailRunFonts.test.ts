import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('Trail Run font loading', () => {
    it('waits for both weights and shares loading between concurrent renders', async () => {
        const pending: (() => void)[] = [];
        const add = vi.fn();
        const weights: string[] = [];
        vi.stubGlobal('document', { fonts: { add } });
        vi.stubGlobal('FontFace', class {
            constructor(_family: string, _url: string, options: { weight: string }) {
                weights.push(options.weight);
            }
            load() { return new Promise(resolve => pending.push(() => resolve(this))); }
        });
        const { ensureTrailRunFonts } = await import('../modules/trailRunFonts');
        const first = ensureTrailRunFonts();
        expect(ensureTrailRunFonts()).toBe(first);
        expect(weights).toEqual(['500', '600']);
        expect(add).not.toHaveBeenCalled();
        pending.forEach(resolve => resolve());
        await first;
        expect(add).toHaveBeenCalledTimes(2);
        await ensureTrailRunFonts();
        expect(weights).toHaveLength(2);
    });

    it('allows retry after a failed font request instead of caching fallback artwork', async () => {
        vi.stubGlobal('document', { fonts: { add: vi.fn() } });
        const load = vi.fn().mockRejectedValue(new Error('offline'));
        vi.stubGlobal('FontFace', class { load = load; });
        const { ensureTrailRunFonts } = await import('../modules/trailRunFonts');
        await expect(ensureTrailRunFonts()).rejects.toThrow('offline');
        load.mockResolvedValue({});
        await expect(ensureTrailRunFonts()).resolves.toBeUndefined();
        expect(load).toHaveBeenCalledTimes(4);
    });
});
