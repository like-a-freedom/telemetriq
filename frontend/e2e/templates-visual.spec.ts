import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_IDS = [
    'floating-pills',
    'arc-gauge',
    'hero-number',
    'dashboard-hud',
    'cinematic-bar',
    'split-edges',
    'stacked-serif',
    'editorial',
    'ticker-tape',
    'whisper',
    'two-tone',
    'condensed-strip',
    'soft-rounded',
    'thin-line',
    'swiss-grid',
] as const;

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = path.resolve(THIS_DIR, 'templates-visual.spec.ts-snapshots');
const PLATFORM_SUFFIX = process.platform === 'win32' ? 'win32' : process.platform;
const IS_CI = Boolean(process.env.CI);
const RUN_VISUAL_BASELINES = process.env.RUN_VISUAL_BASELINES === '1';
const HAS_PLATFORM_BASELINES = TEMPLATE_IDS.every((templateId) =>
    fs.existsSync(path.join(SNAPSHOT_DIR, `template-${templateId}-chromium-${PLATFORM_SUFFIX}.png`))
);

async function seedPreviewStores(page: Page): Promise<void> {
    await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
        const stores = (window as unknown as {
            __e2eStores?: {
                files: {
                    videoFile: File | null;
                    videoMeta: unknown;
                    gpxFile: File | null;
                    gpxData: unknown;
                };
                settings: {
                    selectTemplate: (id: string) => void;
                };
            };
        }).__e2eStores;

        if (!stores) return;

        stores.files.videoFile = new File([new Uint8Array([1, 2, 3, 4])], 'video.mp4', {
            type: 'video/mp4',
        });
        stores.files.videoMeta = {
            duration: 120,
            width: 1280,
            height: 720,
            fps: 30,
            codec: 'avc1.640028',
            fileSize: 4,
            fileName: 'video.mp4',
            startTime: new Date('2026-02-11T09:00:00Z'),
            timezoneOffsetMinutes: 0,
        };

        stores.files.gpxFile = new File(['<gpx></gpx>'], 'track.gpx', {
            type: 'application/gpx+xml',
        });
        stores.files.gpxData = {
            name: 'Visual Baseline Run',
            points: [
                { lat: 55.75, lon: 37.61, ele: 180, time: new Date('2026-02-11T09:00:00Z'), hr: 132 },
                { lat: 55.7508, lon: 37.6111, ele: 182, time: new Date('2026-02-11T09:00:30Z'), hr: 136 },
                { lat: 55.7516, lon: 37.6123, ele: 181, time: new Date('2026-02-11T09:01:00Z'), hr: 138 },
            ],
            metadata: {},
        };

        stores.settings.selectTemplate('floating-pills');
    });
}

async function forceOverlayDraw(page: Page): Promise<void> {
    await page.evaluate(() => {
        const video = document.querySelector('.video-player__video') as HTMLVideoElement | null;
        if (video) {
            try {
                video.currentTime = 1;
            } catch {
                // no-op for test environment
            }
            video.dispatchEvent(new Event('timeupdate'));
        }
    });
}

test.describe('Template visual baselines (chromium only)', () => {
    test.skip(
        IS_CI && !RUN_VISUAL_BASELINES,
        'Visual baselines are disabled in CI by default (set RUN_VISUAL_BASELINES=1 to enable).',
    );

    test.skip(
        !HAS_PLATFORM_BASELINES,
        `Missing chromium baseline snapshots for platform '${PLATFORM_SUFFIX}' in ${SNAPSHOT_DIR}`,
    );

    test('captures visual state for all extended templates', async ({ page }) => {

        await page.setViewportSize({ width: 1440, height: 900 });
        await seedPreviewStores(page);

        await expect(page.getByTestId('proceed-btn')).toBeEnabled();
        await page.getByTestId('proceed-btn').click();
        await expect(page).toHaveURL(/\/preview(?:\?e2e=1)?$/);
        await expect(page.getByTestId('video-player')).toBeVisible();
        await expect(page.locator('#template-select')).toBeVisible();

        for (const templateId of TEMPLATE_IDS) {
            await page.selectOption('#template-select', templateId);
            await forceOverlayDraw(page);

            await expect
                .poll(async () => page.evaluate(() => {
                    const canvas = document.querySelector('.video-player__overlay') as HTMLCanvasElement | null;
                    if (!canvas) return 0;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return 0;
                    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    let nonTransparent = 0;
                    for (let i = 3; i < data.length; i += 4) {
                        if (data[i] !== 0) nonTransparent += 1;
                    }
                    return nonTransparent;
                }), {
                    timeout: 5000,
                    message: `Overlay should be rendered for template ${templateId}`,
                })
                .toBeGreaterThan(500);

            await expect(page.locator('.video-player__overlay')).toHaveScreenshot(
                `template-${templateId}.png`,
                {
                    animations: 'disabled',
                    scale: 'css',
                }
            );
        }
    });
});
