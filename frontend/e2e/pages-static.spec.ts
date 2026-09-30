import { test, expect } from '@playwright/test';

const configuredPath = process.env.PAGES_BASE_PATH || '/telemetriq/';
const appBasePath = configuredPath.endsWith('/') ? configuredPath : `${configuredPath}/`;
const siteOrigin = process.env.VITE_SITE_URL || 'https://like-a-freedom.github.io';

test('production Pages: serves the app and static metadata from the project path', async ({ page, request }) => {
    const failures: string[] = [];
    page.on('response', (response) => {
        if (response.status() >= 400 && response.url().startsWith('http://127.0.0.1:4173')) {
            failures.push(`${response.status()} ${response.url()}`);
        }
    });

    const response = await page.goto(appBasePath, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /Telemetriq/ })).toBeVisible();
    expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(false);

    const urls = await page.evaluate(() => ({
        canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
        manifest: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href,
        image: document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content,
        siteUrl: (window as Window & { __SITE_URL__?: string }).__SITE_URL__,
    }));
    expect(urls.canonical).toBe(`${siteOrigin}${appBasePath}`);
    expect(urls.image).toBe(`${siteOrigin}${appBasePath}og-image.png`);
    expect(urls.siteUrl).toBe(siteOrigin);

    const manifestUrl = new URL(`${appBasePath}site.webmanifest`, 'http://127.0.0.1:4173').toString();
    const manifestResponse = await request.get(manifestUrl);
    expect(manifestResponse.status()).toBe(200);
    const manifest = await manifestResponse.json();
    expect(manifest.start_url).toBe('./');
    const iconResponse = await request.get(new URL(manifest.icons[0].src, manifestUrl).toString());
    expect(iconResponse.status()).toBe(200);

    await page.goto(`${appBasePath}#/preview`, { waitUntil: 'networkidle' });
    expect(new URL(page.url()).pathname).toBe(appBasePath);
    expect(failures).toEqual([]);
});
