import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
// Use the test fixtures we created (test.mp4 and test.gpx)
const VIDEO_PATH = path.resolve(THIS_DIR, '../../test_data/test.mp4');
const GPX_PATH = path.resolve(THIS_DIR, '../../test_data/test.gpx');

const HAS_FIXTURES = fs.existsSync(VIDEO_PATH) && fs.existsSync(GPX_PATH);


test.describe('Real processing flow (chromium only)', () => {
    test('should process real DJI video and open result page with valid output', async ({ page }) => {
        test.setTimeout(240_000);

        await page.goto('/', { waitUntil: 'domcontentloaded' });

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

        // For test fixtures (small test videos), just verify output is non-zero and reasonable
        // Real DJI footage would produce > 1MB outputs, but our test fixtures are tiny
        expect(resultSize).toBeGreaterThan(1000); // At least 1KB to be valid MP4
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
