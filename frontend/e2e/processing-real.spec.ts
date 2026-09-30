import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_PATH = path.resolve(THIS_DIR, 'fixtures/sample-3s.mp4');
const GPX_PATH = path.resolve(THIS_DIR, 'fixtures/test.gpx');

const HAS_FIXTURES = fs.existsSync(VIDEO_PATH) && fs.existsSync(GPX_PATH);
const RUN_REAL_PROCESSING = process.env.RUN_REAL_PROCESSING === '1';
const PAGES_BASE_PATH = process.env.PAGES_BASE_PATH || '/';
const APP_BASE_PATH = PAGES_BASE_PATH.endsWith('/') ? PAGES_BASE_PATH : `${PAGES_BASE_PATH}/`;

if (RUN_REAL_PROCESSING && !HAS_FIXTURES) {
    throw new Error('Required production processing fixtures are missing.');
}

async function processFixture(page: import('@playwright/test').Page): Promise<number[]> {
    await page.goto(APP_BASE_PATH, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('video-upload').locator('input[type="file"]').setInputFiles(VIDEO_PATH);
    await page.getByTestId('gpx-upload').locator('input[type="file"]').setInputFiles(GPX_PATH);

    await expect(page.getByTestId('proceed-btn')).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId('proceed-btn').click();

    await expect(page).toHaveURL(/\/preview/, { timeout: 30_000 });
    await page.getByTestId('process-btn').click();
    await expect(page).toHaveURL(/\/processing/, { timeout: 30_000 });

    const complete = page.getByTestId('processing-complete');
    const error = page.getByTestId('processing-error');

    await Promise.race([
        complete.waitFor({ state: 'visible', timeout: 180_000 }),
        error.waitFor({ state: 'visible', timeout: 180_000 }),
    ]);

    if (await error.isVisible()) {
        const message = (await error.innerText()).trim();
        throw new Error(`Real video processing failed: ${message}`);
    }

    await page.getByRole('button', { name: /Go to result/i }).click();
    await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
    await expect(page.getByTestId('download-btn')).toBeVisible();
    await expect(page.getByTestId('result-video')).toBeVisible();

    return await page.evaluate(async () => {
        const video = document.querySelector('[data-testid="result-video"]') as HTMLVideoElement | null;
        if (!video?.src) return [];
        const response = await fetch(video.src);
        if (!response.ok) throw new Error(`Failed to fetch exported video: HTTP ${response.status}`);
        return Array.from(new Uint8Array(await response.arrayBuffer()));
    });
}

async function inspectMp4(bytes: number[]): Promise<{ hasVideo: boolean; hasAudio: boolean }> {
    const file = new File([Uint8Array.from(bytes)], 'result.mp4', { type: 'video/mp4' });
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    try {
        return {
            hasVideo: Boolean(await input.getPrimaryVideoTrack()),
            hasAudio: Boolean(await input.getPrimaryAudioTrack()),
        };
    } finally {
        const disposable = input as unknown as { [Symbol.dispose]?: () => void };
        disposable[Symbol.dispose]?.();
    }
}


test.describe('Real processing flow (chromium only)', () => {
    test.skip(!RUN_REAL_PROCESSING, 'Real media processing runs against the production Pages build.');

    test('production Pages: exports H.264/AAC video without cross-origin isolation', async ({ page }) => {
        test.setTimeout(240_000);

        if (process.env.PAGES_BASE_PATH) {
            expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(false);
        }

        const outputBytes = await processFixture(page);
        expect(outputBytes.length).toBeGreaterThan(1000);
        expect(await inspectMp4(outputBytes)).toEqual({ hasVideo: true, hasAudio: true });
    });

    test('production Pages: transcodes with the pinned local FFmpeg core when CDNs are blocked', async ({ page }) => {
        test.setTimeout(240_000);
        const localCoreAssets = new Set<string>();
        page.on('response', (response) => {
            if (response.url().includes('/vendor/ffmpeg/')) {
                localCoreAssets.add(new URL(response.url()).pathname.split('/').at(-1) || '');
            }
        });

        await page.route('https://cdn.jsdelivr.net/npm/@ffmpeg/core@**', (route) => route.abort());
        await page.route('https://unpkg.com/@ffmpeg/core@**', (route) => route.abort());
        await page.addInitScript(() => {
            const decoder = globalThis.VideoDecoder;
            if (!decoder) return;
            const original = decoder.isConfigSupported.bind(decoder);
            let forcedFallback = false;
            decoder.isConfigSupported = async (config) => {
                if (!forcedFallback && config.codec.startsWith('avc1')) {
                    forcedFallback = true;
                    return { config, supported: false };
                }
                return original(config);
            };
        });

        const outputBytes = await processFixture(page);
        expect(outputBytes.length).toBeGreaterThan(1000);
        expect(await inspectMp4(outputBytes)).toEqual({ hasVideo: true, hasAudio: true });
        expect(localCoreAssets).toContain('ffmpeg-core.js');
        expect(localCoreAssets).toContain('ffmpeg-core.wasm');
    });

    test('manual sync adjustment controls should update offset state', async ({ page }) => {
        test.setTimeout(90_000);

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('video-upload').locator('input[type="file"]').setInputFiles(VIDEO_PATH);
        await page.getByTestId('gpx-upload').locator('input[type="file"]').setInputFiles(GPX_PATH);

        await expect(page.getByTestId('proceed-btn')).toBeEnabled({ timeout: 30_000 });
        await page.getByTestId('proceed-btn').click();

        await expect(page).toHaveURL(/\/preview/, { timeout: 30_000 });

        const syncRange = page.getByTestId('sync-range');
        await expect(syncRange).toBeVisible({ timeout: 30_000 });

        // Reproduce user flow: manual adjustment via sync controls.
        await page.getByTestId('sync-reset').click({ force: true });
        await expect(syncRange).toHaveValue('0');

        for (let i = 0; i < 3; i += 1) {
            await page.getByTestId('sync-plus1').click({ force: true });
        }

        await expect(syncRange).not.toHaveValue('1800');
        await expect(page.getByTestId('sync-slider').locator('.sync-slider__badge--manual')).toBeVisible();
        await expect(page.getByTestId('process-btn')).toBeVisible();
    });
});
