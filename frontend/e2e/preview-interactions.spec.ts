import { test, expect, type Page } from '@playwright/test';

test.describe('Preview Page Interactions', () => {
    async function seedStores(page: Page) {
        await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
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
                name: 'Test Track',
                points: [
                    { lat: 55, lon: 37, time: new Date('2024-01-01T10:00:00Z') },
                    { lat: 55.0005, lon: 37.0005, time: new Date('2024-01-01T10:00:30Z') },
                ],
                metadata: {},
            };
        });
    }

    test.beforeEach(async ({ page }) => {
        await seedStores(page);
        await page.getByTestId('proceed-btn').click();
        await expect(page).toHaveURL(/\/preview/);
    });

    test('should display all main preview elements', async ({ page }) => {
        await expect(page.getByTestId('back-btn')).toBeVisible();
        await expect(page.locator('#template-select')).toBeVisible();
        await expect(page.getByTestId('sync-collapse-toggle')).toBeVisible();
        await expect(page.getByTestId('process-btn')).toBeVisible();
    });

    test('should toggle overlay checkboxes', async ({ page }) => {
        const hrCheckbox = page.getByLabel('Heart rate');
        const paceCheckbox = page.getByLabel('Pace');
        const distanceCheckbox = page.getByLabel('Distance');
        const timeCheckbox = page.getByLabel('Time');

        // All checkboxes are checked by default
        await expect(hrCheckbox).toBeChecked();
        await expect(paceCheckbox).toBeChecked();
        await expect(distanceCheckbox).toBeChecked();
        await expect(timeCheckbox).toBeChecked();

        // Uncheck Heart rate
        await hrCheckbox.uncheck();
        await expect(hrCheckbox).not.toBeChecked();

        // Re-check Heart rate
        await hrCheckbox.check();
        await expect(hrCheckbox).toBeChecked();
    });

    test('should navigate to processing on process click', async ({ page }) => {
        await page.getByTestId('process-btn').click();
        await expect(page).toHaveURL(/\/processing/);
    });

    test('should navigate back to upload on back click', async ({ page }) => {
        await page.getByTestId('back-btn').click();
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
        await expect(page.getByTestId('proceed-btn')).toBeVisible();
    });
});
