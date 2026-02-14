import { test, expect } from '@playwright/test';

test.describe('Runtime site files', () => {
    test('robots.txt reflects SITE_URL in dev server', async ({ request }) => {
        const res = await request.get('/robots.txt');
        expect(res.ok()).toBeTruthy();
        const txt = await res.text();
        expect(txt).toContain('Sitemap: http://localhost:5173/sitemap.xml');
    });

    test('sitemap.xml contains runtime SITE_URL entries', async ({ request }) => {
        const res = await request.get('/sitemap.xml');
        expect(res.ok()).toBeTruthy();
        const xml = await res.text();
        expect(xml).toContain('<loc>http://localhost:5173/</loc>');
        expect(xml).toContain('<loc>http://localhost:5173/preview</loc>');
    });

    test('site-config.js exposes SITE_URL to client at runtime', async ({ page }) => {
        await page.goto('/?e2e=1');
        await page.waitForFunction(() => (window as any).__SITE_URL__ !== undefined);
        const runtime = await page.evaluate(() => (window as any).__SITE_URL__);
        expect(runtime).toBe('http://localhost:5173');
    });
});
