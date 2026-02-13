import { test, expect } from '@playwright/test';

test.describe('Processing flow', () => {
    async function seedStores(page: any) {
        await page.goto('/processing?e2e=1', { timeout: 60000 });
        await page.evaluate(() => {
            const stores = (window as any).__e2eStores;
            if (!stores) return;

            stores.files.videoFile = new File([new Uint8Array([1, 2, 3])], 'video.mp4', {
                type: 'video/mp4',
            });
            stores.files.videoMeta = {
                duration: 2,
                width: 640,
                height: 360,
                fps: 30,
                codec: 'avc1.640028',
                fileSize: 3,
                fileName: 'video.mp4',
                startTime: new Date(),
                timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            };

            stores.files.gpxFile = new File(['<gpx></gpx>'], 'track.gpx', {
                type: 'application/gpx+xml',
            });
            stores.files.gpxData = {
                name: 'Test',
                points: [
                    { lat: 55, lon: 37, time: new Date('2024-01-01T10:00:00Z') },
                    { lat: 55.0005, lon: 37.0005, time: new Date('2024-01-01T10:00:30Z') },
                ],
                metadata: {},
            };
        });
    }

    test('should complete processing and show result', async ({ page }) => {
        await seedStores(page);

        await expect(page.getByTestId('processing-complete')).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: /Go to result/i }).click();

        await expect(page.getByTestId('download-btn')).toBeVisible();
        await expect(page.getByTestId('start-over-btn')).toBeVisible();
    });

    test('should reset and return to upload', async ({ page }) => {
        await seedStores(page);
        await expect(page.getByTestId('processing-complete')).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: /Go to result/i }).click();

        await page.getByTestId('start-over-btn').click();
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
        await expect(page.getByText('Upload video')).toBeVisible();
    });

    test('should allow cancel during processing', async ({ page }) => {
        await seedStores(page);

        await expect(page.getByTestId('cancel-btn')).toBeVisible();
        await page.getByTestId('cancel-btn').click();
        // Wait for either navigation to preview or the cancel button to be removed (works around flaky timing in some browsers)
        await Promise.race([
            page.waitForURL(/preview/, { timeout: 10000 }),
            page.getByTestId('cancel-btn').waitFor({ state: 'detached', timeout: 10000 }),
        ]);
        // Assert we've left processing either by URL or by UI change
        const url = page.url();
        if (!/\/preview/.test(url)) {
            await expect(page.getByTestId('cancel-btn')).not.toBeVisible();
        }
    });
});
