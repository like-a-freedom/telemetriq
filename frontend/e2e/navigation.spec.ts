import { test, expect } from '@playwright/test';

test.describe('Preview Page', () => {
    test('should redirect to upload if no files loaded', async ({ page }) => {
        await page.goto('/preview?e2e=1');
        // Should be redirected to upload
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
    });
});

test.describe('Processing Page', () => {
    test('should stay on processing in e2e mode without files', async ({ page }) => {
        await page.goto('/processing?e2e=1');
        await expect(page).toHaveURL(/\/processing\?e2e=1$/);
    });
});

test.describe('Result Page', () => {
    test('should redirect to upload if no result', async ({ page }) => {
        await page.goto('/result?e2e=1');
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
    });
});

test.describe('App Shell', () => {
    test('should load without errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        await page.goto('/?e2e=1');
        await expect(page.locator('.upload-view')).toBeVisible();

        // Allow WebCodecs-related errors (not supported in all test browsers)
        const criticalErrors = errors.filter(
            (e) => !e.includes('VideoEncoder') && !e.includes('VideoDecoder') && !e.includes('SharedArrayBuffer')
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test('should have correct page title', async ({ page }) => {
        await page.goto('/?e2e=1');
        await expect(page).toHaveTitle(/Sports Telemetry Overlay/);
    });

    test('should display the application in responsive layout', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
        await page.goto('/?e2e=1');

        await expect(page.getByText('Sports Telemetry Overlay')).toBeVisible();
        await expect(page.getByText('Upload video')).toBeVisible();
        await expect(page.getByText('Upload GPX')).toBeVisible();
    });
});
