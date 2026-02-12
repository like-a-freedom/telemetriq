import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_PATH = path.resolve(THIS_DIR, '../../test_data/DJI_20260211092425_0002_D.MP4');
const GPX_PATH = path.resolve(THIS_DIR, '../../test_data/suuntoapp-Running-2026-02-11T05-55-23Z-track.gpx');

const HAS_FIXTURES = fs.existsSync(VIDEO_PATH) && fs.existsSync(GPX_PATH);

test.describe('Real processing flow', () => {
    test('should process real DJI video and open result page without stco error', async ({ page, browserName }, testInfo) => {
        test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium',
            'Real WebCodecs processing is validated only in Desktop Chromium');
        test.skip(!HAS_FIXTURES, 'Real fixture files are missing in test_data');

        test.setTimeout(240_000);

        await page.goto('/');

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
            throw new Error(`Processing failed in real E2E: ${message}`);
        }

        await page.getByRole('button', { name: /Go to result/i }).click();
        await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
        await expect(page.getByTestId('download-btn')).toBeVisible();
        const resultVideo = page.getByTestId('result-video');
        await expect(resultVideo).toBeVisible();

        const resultSize = await page.evaluate(async () => {
            const video = document.querySelector('[data-testid="result-video"]') as HTMLVideoElement | null;
            if (!video?.src) return 0;
            const response = await fetch(video.src);
            const blob = await response.blob();
            return blob.size;
        });

        // Guard against malformed tiny outputs (e.g. ~0.6 KB invalid MP4)
        expect(resultSize).toBeGreaterThan(1024 * 1024);
    });
});
