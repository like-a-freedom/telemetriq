import { test, expect, type Page } from '@playwright/test';

async function gotoE2E(page: Page, url: string): Promise<void> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
}

test.describe('Preview Page', () => {
    test('should redirect to upload if no files loaded', async ({ page }) => {
        await gotoE2E(page, '/preview?e2e=1');
        // Should be redirected to upload
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
    });
});

test.describe('Processing Page', () => {
    test('should stay on processing in e2e mode without files', async ({ page }) => {
        await gotoE2E(page, '/processing?e2e=1');
        await expect(page).toHaveURL(/\/processing\?e2e=1$/);
    });
});

test.describe('Result Page', () => {
    test('should redirect to upload if no result', async ({ page }) => {
        await gotoE2E(page, '/result?e2e=1');
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
    });
});

test.describe('App Shell', () => {
    test('should load without errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        await gotoE2E(page, '/?e2e=1');
        await expect(page.locator('.upload-view')).toBeVisible();

        // Allow WebCodecs-related errors (not supported in all test browsers)
        const criticalErrors = errors.filter(
            (e) => !e.includes('VideoEncoder') && !e.includes('VideoDecoder') && !e.includes('SharedArrayBuffer')
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test('should have correct page title', async ({ page }) => {
        await gotoE2E(page, '/?e2e=1');
        await expect(page).toHaveTitle(/Telemetriq/);
    });

    test('should display the application in responsive layout', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
        await gotoE2E(page, '/?e2e=1');

        await expect(page.getByText('Telemetriq')).toBeVisible();
        await expect(page.getByText('Upload video')).toBeVisible();
        await expect(page.getByText('Upload GPX')).toBeVisible();
    });
});
