import { test, expect, type Page } from '@playwright/test';

async function gotoE2E(page: Page, url: string): Promise<void> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
}

test.describe('Upload Page', () => {
    test.beforeEach(async ({ page }) => {
        await gotoE2E(page, '/?e2e=1');
    });

    test('should display the main title and description', async ({ page }) => {
        await expect(page.getByText('Telemetriq')).toBeVisible();
        await expect(page.getByText('Overlay telemetry')).toBeVisible();
    });

    test('should display two upload zones', async ({ page }) => {
        await expect(page.getByText('Upload video')).toBeVisible();
        await expect(page.getByText('Upload GPX')).toBeVisible();
    });

    test('should have proceed button disabled initially', async ({ page }) => {
        const btn = page.getByTestId('proceed-btn');
        await expect(btn).toBeDisabled();
    });

    test('should show error for invalid video file', async ({ page }) => {
        const fileInput = page.getByTestId('video-upload').locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test.avi',
            mimeType: 'video/avi',
            buffer: Buffer.from('not a real video'),
        });

        await expect(
            page.getByTestId('video-upload').getByTestId('upload-error')
        ).toBeVisible();
    });

    test('should show error for invalid GPX file', async ({ page }) => {
        const fileInput = page.getByTestId('gpx-upload').locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'track.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('not a gpx file'),
        });

        await expect(
            page.getByTestId('gpx-upload').getByTestId('upload-error')
        ).toBeVisible();
    });

    test('should accept valid GPX file and show info', async ({ page }) => {
        const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TestApp">
  <trk><name>Morning Run</name><trkseg>
    <trkpt lat="55.7558" lon="37.6173"><time>2024-01-15T10:00:00Z</time>
      <extensions><hr>145</hr></extensions>
    </trkpt>
    <trkpt lat="55.7567" lon="37.6173"><time>2024-01-15T10:00:30Z</time>
      <extensions><hr>150</hr></extensions>
    </trkpt>
    <trkpt lat="55.7576" lon="37.6173"><time>2024-01-15T10:01:00Z</time>
      <extensions><hr>155</hr></extensions>
    </trkpt>
  </trkseg></trk>
</gpx>`;

        const fileInput = page.getByTestId('gpx-upload').locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'track.gpx',
            mimeType: 'application/gpx+xml',
            buffer: Buffer.from(gpxContent),
        });

        // Should show GPX info
        await expect(page.getByText('Morning Run')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('Heart rate')).toBeVisible();
    });

    test('should remove file when remove button is clicked', async ({ page }) => {
        const gpxContent = `<?xml version="1.0"?>
<gpx version="1.1" creator="Test">
  <trk><name>Test</name><trkseg>
    <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

        const fileInput = page.getByTestId('gpx-upload').locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'track.gpx',
            mimeType: 'application/gpx+xml',
            buffer: Buffer.from(gpxContent),
        });

        await expect(page.getByText('Test')).toBeVisible({ timeout: 5000 });

        // Click remove
        await page.getByTestId('gpx-upload').getByTestId('remove-file').click();

        // Should show upload zone again
        await expect(page.getByText('Upload GPX')).toBeVisible();
    });

    test('should keep proceed disabled when only video is set (e2e store)', async ({ page }) => {
        await page.evaluate(() => {
            const stores = (window as any).__e2eStores;
            stores.files.videoFile = new File([new Uint8Array([1])], 'video.mp4', { type: 'video/mp4' });
            stores.files.videoMeta = {
                duration: 5,
                width: 640,
                height: 360,
                fps: 30,
                codec: 'avc1.640028',
                fileSize: 1,
                fileName: 'video.mp4',
            };
        });

        await expect(page.getByTestId('proceed-btn')).toBeDisabled();
    });

    test('should keep proceed disabled when only GPX is set (e2e store)', async ({ page }) => {
        await page.evaluate(() => {
            const stores = (window as any).__e2eStores;
            stores.files.gpxFile = new File(['<gpx></gpx>'], 'track.gpx', { type: 'application/gpx+xml' });
            stores.files.gpxData = {
                name: 'Test',
                points: [
                    { lat: 55, lon: 37, time: new Date('2024-01-01T10:00:00Z') },
                    { lat: 55.0005, lon: 37.0005, time: new Date('2024-01-01T10:00:30Z') },
                ],
                metadata: {},
            };
        });

        await expect(page.getByTestId('proceed-btn')).toBeDisabled();
    });
});

test.describe('Navigation', () => {
    test('should redirect to upload when accessing preview without files', async ({ page }) => {
        await gotoE2E(page, '/preview?e2e=1');
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
    });

    test('should redirect to upload when accessing result without processing', async ({ page }) => {
        await gotoE2E(page, '/result?e2e=1');
        await expect(page).toHaveURL(/\/(\?e2e=1)?$/);
    });
});
