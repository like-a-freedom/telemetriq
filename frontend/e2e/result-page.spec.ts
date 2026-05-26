import { test, expect } from '@playwright/test';

test.describe('Result Page', () => {
    async function processAndGoToResult(page: any) {
        await page.goto('/processing?e2e=1', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
            // Mock wakeLock — headless Chromium may hang on navigator.wakeLock.request()
            (navigator as any).wakeLock = {
                request: async () => ({
                    release: async () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                }),
            };

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

        await expect(page.getByTestId('processing-complete')).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: /Go to result/i }).click();
        await expect(page).toHaveURL(/\/result/);
    }

    test('should display result video preview when available', async ({ page }) => {
        await processAndGoToResult(page);
        await expect(page.getByTestId('result-video')).toBeVisible();
    });

    test('should display file info (Format and Size)', async ({ page }) => {
        await processAndGoToResult(page);
        await expect(page.getByText('MP4 (H.264)')).toBeVisible();
        await expect(page.getByText('KB')).toBeVisible();
    });

    test('should clear result and navigate to upload on start over', async ({ page }) => {
        await processAndGoToResult(page);

        await page.getByTestId('start-over-btn').click();
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);

        // Verify result store was cleared — navigating back to /result should redirect to upload
        await page.goto('/result?e2e=1', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
    });

    test('should redirect to upload if no result exists', async ({ page }) => {
        await page.goto('/result?e2e=1', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
    });
});
