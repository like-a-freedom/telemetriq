import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('Ghost Run keeps telemetry inside the frame across metrics and sizes', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getGhostRunRoute } = await import('/src/modules/ghostRunRoute.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const base = getTemplateConfig('ghost-run');
        const frame = { timeOffset: 446399, totalElapsedSeconds: 446399, movingTimeSeconds: 446399,
            elapsedTime: '123:59:59', paceSecondsPerKm: 7259, distanceKm: 12345.6,
            hr: 199, elevationM: 9999, gradePercent: -99.9 };
        const route = getGhostRunRoute(Array.from({ length: 60 }, (_, index) => ({
            ...frame, timeOffset: index * 8000, distanceKm: index * 230,
            latitude: 45 + index * 0.001, longitude: 10 + Math.sin(index / 6) * 0.01,
            timestampMs: Date.UTC(2026, 9, 2, 8, 12) + index * 8_000_000,
            elevationM: 100 + Math.sin(index / 5) * 70,
        })));
        const sizes = [[320, 180], [320, 568], [360, 640], [640, 360], [884, 151],
            [1080, 1080], [1080, 1920], [1920, 1080], [3840, 2160]];
        const variations = [base, { ...base, fontSizePercent: 8, valueSizeMultiplier: 2.5, labelSizeMultiplier: 1.2 },
            { ...base, fontSizePercent: 1, labelStyle: 'hidden', textShadow: false }];
        const keys = ['showPace', 'showDistance', 'showTime', 'showHr', 'showElevation', 'showGrade'] as const;
        const failures: string[] = [];
        let cases = 0;
        for (const [w, h] of sizes) {
            const canvas = document.createElement('canvas');
            canvas.width = w!;
            canvas.height = h!;
            const ctx = canvas.getContext('2d')!;
            const text: Array<{ value: string; left: number; right: number; top: number; bottom: number }> = [];
            const fillText = ctx.fillText.bind(ctx);
            ctx.fillText = (value, x, y) => {
                const box = ctx.measureText(value);
                const transform = ctx.getTransform();
                const corners = [
                    [x - box.actualBoundingBoxLeft, y - box.actualBoundingBoxAscent],
                    [x + box.actualBoundingBoxRight, y - box.actualBoundingBoxAscent],
                    [x + box.actualBoundingBoxRight, y + box.actualBoundingBoxDescent],
                    [x - box.actualBoundingBoxLeft, y + box.actualBoundingBoxDescent],
                ].map(([px, py]) => transform.transformPoint({ x: px!, y: py! }));
                text.push({ value, left: Math.min(...corners.map((p) => p.x)), right: Math.max(...corners.map((p) => p.x)),
                    top: Math.min(...corners.map((p) => p.y)), bottom: Math.max(...corners.map((p) => p.y)) });
                fillText(value, x, y);
            };
            let fills = 0;
            ctx.fillRect = () => { fills++; };
            let outsidePath = false;
            const checkPoint = (x: number, y: number) => {
                const point = ctx.getTransform().transformPoint({ x, y });
                outsidePath ||= point.x < 0 || point.x > w! || point.y < 0 || point.y > h!;
            };
            const moveTo = ctx.moveTo.bind(ctx);
            const lineTo = ctx.lineTo.bind(ctx);
            const quadraticCurveTo = ctx.quadraticCurveTo.bind(ctx);
            const bezierCurveTo = ctx.bezierCurveTo.bind(ctx);
            const arc = ctx.arc.bind(ctx);
            ctx.moveTo = (x, y) => { checkPoint(x, y); moveTo(x, y); };
            ctx.lineTo = (x, y) => { checkPoint(x, y); lineTo(x, y); };
            ctx.quadraticCurveTo = (cx, cy, x, y) => { checkPoint(cx, cy); checkPoint(x, y); quadraticCurveTo(cx, cy, x, y); };
            ctx.bezierCurveTo = (cx1, cy1, cx2, cy2, x, y) => {
                checkPoint(cx1, cy1); checkPoint(cx2, cy2); checkPoint(x, y); bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
            };
            ctx.arc = (x, y, radius, start, end, counterclockwise) => {
                for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) checkPoint(x + dx, y + dy);
                arc(x, y, radius, start, end, counterclockwise);
            };
            for (let mask = 0; mask < 64; mask++) {
                for (const [variation, baseConfig] of variations.entries()) {
                    const config = { ...baseConfig };
                    keys.forEach((key, index) => { config[key] = Boolean(mask & (1 << index)); });
                    const id = `${w}x${h}/${mask}/${variation}`;
                    text.length = 0;
                    fills = 0;
                    outsidePath = false;
                    ctx.clearRect(0, 0, w!, h!);
                    renderGhostRunLayout(ctx, frame, w!, h!, config, { ghostRoute: route });
                    if (fills) failures.push(`${id}: panel background`);
                    if (outsidePath) failures.push(`${id}: outside projected geometry`);
                    const expected = [config.showPace && '120:59', config.showDistance && '12345.6',
                        config.showTime && '123:59:59', config.showHr && '199', config.showElevation && '9999'];
                    for (const value of expected) if (value && !text.some((entry) => entry.value === value)) failures.push(`${id}: missing ${value}`);
                    if (!config.showPace && text.some((entry) => entry.value === 'PACE')) failures.push(`${id}: hidden pace`);
                    for (const box of text) {
                        if (box.left < -0.5 || box.right > w! + 0.5 || box.top < -0.5 || box.bottom > h! + 0.5) failures.push(`${id}: outside ${box.value}`);
                    }
                    for (let a = 0; a < text.length; a++) for (let b = a + 1; b < text.length; b++) {
                        const first = text[a]!;
                        const second = text[b]!;
                        if (first.left < second.right - 0.5 && second.left < first.right - 0.5
                            && first.top < second.bottom - 0.5 && second.top < first.bottom - 0.5) failures.push(`${id}: collision ${first.value}/${second.value}`);
                    }
                    cases++;
                }
            }
        }
        return { cases, failures: failures.slice(0, 40) };
    });
    expect(result.cases).toBe(1728);
    expect(result.failures).toEqual([]);
});

test('Ghost Run renders missing data explicitly and leaves the center transparent', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderOverlay } = await import('/src/modules/overlayRenderer.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const canvas = document.createElement('canvas');
        canvas.width = 1188;
        canvas.height = 669;
        const ctx = canvas.getContext('2d')!;
        await renderOverlay(ctx, { timeOffset: 877, distanceKm: 2.8, movingTimeSeconds: 850, elapsedTime: '14:10' },
            1188, 669, getTemplateConfig('ghost-run'));
        const center = ctx.getImageData(300, 50, 500, 550).data;
        return { centerClear: center.every((value, index) => index % 4 !== 3 || value === 0),
            hasInk: ctx.getImageData(0, 0, 1188, 669).data.some((value, index) => index % 4 === 3 && value > 0) };
    });
    expect(result).toEqual({ centerClear: true, hasInk: true });
});

test('Ghost Run keeps portrait type and its contrasting edges visible across footage palettes', async ({ page }) => {
    await page.goto('/?e2e');
    const failures = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const frame = { timeOffset: 877, totalElapsedSeconds: 877, paceSecondsPerKm: 314, distanceKm: 2.8,
            hr: 162, elevationM: 78, gradePercent: -2.1 };
        const failures: string[] = [];
        for (const [w, h] of [[320, 568], [390, 844]]) {
            for (const ground of ['#F7FBFA', '#152321', '#D5B58F', '#7DE6E3', '#24502D', '#888888']) {
                for (const darkInk of [false, true]) {
                    const canvas = document.createElement('canvas');
                    canvas.width = w!; canvas.height = h!;
                    const ctx = canvas.getContext('2d')!;
                    ctx.fillStyle = ground; ctx.fillRect(0, 0, w!, h!);
                    const config = getTemplateConfig('ghost-run');
                    if (darkInk) { config.textColor = '#152321'; config.accentColor = '#213547'; }
                    let label: { x: number; y: number; width: number; height: number } | undefined;
                    let valueHeight = 0;
                    const fillText = ctx.fillText.bind(ctx);
                    ctx.fillText = (value, x, y) => {
                        const metrics = ctx.measureText(value);
                        const transform = ctx.getTransform();
                        const corners = [[x - metrics.actualBoundingBoxLeft, y - metrics.actualBoundingBoxAscent],
                            [x + metrics.actualBoundingBoxRight, y - metrics.actualBoundingBoxAscent],
                            [x + metrics.actualBoundingBoxRight, y + metrics.actualBoundingBoxDescent],
                            [x - metrics.actualBoundingBoxLeft, y + metrics.actualBoundingBoxDescent]]
                            .map(([px, py]) => transform.transformPoint({ x: px!, y: py! }));
                        const top = Math.min(...corners.map((p) => p.y));
                        const bottom = Math.max(...corners.map((p) => p.y));
                        if (value === '5:14') valueHeight = bottom - top;
                        if (value === 'PACE') {
                            const left = Math.floor(Math.min(...corners.map((p) => p.x))) - 2;
                            const right = Math.ceil(Math.max(...corners.map((p) => p.x))) + 2;
                            label = { x: left, y: Math.floor(top) - 2, width: right - left, height: Math.ceil(bottom) - Math.floor(top) + 4 };
                        }
                        fillText(value, x, y);
                    };
                    renderGhostRunLayout(ctx, frame, w!, h!, config);
                    const id = `${w}x${h}/${ground}/${darkInk ? 'dark' : 'light'} ink`;
                    if (valueHeight < w! * 0.055) failures.push(`${id}: undersized portrait pace`);
                    if (!label) { failures.push(`${id}: missing label`); continue; }
                    const pixels = ctx.getImageData(label.x, label.y, label.width, label.height).data;
                    const background = [1, 3, 5].map((offset) => parseInt(ground.slice(offset, offset + 2), 16));
                    let visible = 0;
                    for (let i = 0; i < pixels.length; i += 4) {
                        if (Math.max(...background.map((channel, index) => Math.abs(channel - pixels[i + index]!))) > 64) visible++;
                    }
                    // Test painted contrast, including same-colored footage and foreground.
                    if (visible < label.width * label.height * 0.12) failures.push(`${id}: invisible label edges`);
                }
            }
        }
        return failures;
    });
    expect(failures).toEqual([]);
});

test('Ghost Run uses identical route data in preview and video-frame export (chromium only)', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderOverlay, renderOverlayOnFrame } = await import('/src/modules/overlayRenderer.ts');
        const { getGhostRunRoute } = await import('/src/modules/ghostRunRoute.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const frame = { timeOffset: 877, totalElapsedSeconds: 877, movingTimeSeconds: 850, elapsedTime: '14:10',
            paceSecondsPerKm: 314, distanceKm: 2.8, hr: 162, elevationM: 78, gradePercent: -2.1 };
        const timeline = Array.from({ length: 40 }, (_, i) => ({ ...frame, timeOffset: i * 40,
            latitude: 45 + i * 0.001, longitude: 10 + i * 0.001, distanceKm: i / 39 * 5.1,
            timestampMs: Date.UTC(2026, 9, 2, 8, 12) + i * 40_000, elevationM: 100 + Math.sin(i / 3) * 30 }));
        const context = { ghostRoute: getGhostRunRoute(timeline) };
        const config = getTemplateConfig('ghost-run');
        const preview = new OffscreenCanvas(640, 360);
        const previewCtx = preview.getContext('2d')!;
        previewCtx.fillStyle = '#3C5141';
        previewCtx.fillRect(0, 0, 640, 360);
        const base = new VideoFrame(preview, { timestamp: 0 });
        await renderOverlay(previewCtx, frame, 640, 360, config, context);
        const exported = await renderOverlayOnFrame(base, frame, config, context);
        const result = new OffscreenCanvas(640, 360);
        const exportedCtx = result.getContext('2d')!;
        exportedCtx.drawImage(exported, 0, 0);
        const expected = previewCtx.getImageData(0, 0, 640, 360).data;
        const actual = exportedCtx.getImageData(0, 0, 640, 360).data;
        let maximumDifference = 0;
        for (let i = 0; i < expected.length; i++) maximumDifference = Math.max(maximumDifference, Math.abs(expected[i]! - actual[i]!));
        exported.close();
        base.close();
        return maximumDifference;
    });
    expect(result).toBeLessThanOrEqual(2);
});

test('Ghost Run preserves portrait right edges and proportional type up to 4K video', async ({ page }) => {
    await page.goto('/?e2e');
    const failures = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getGhostRunRoute } = await import('/src/modules/ghostRunRoute.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const config = getTemplateConfig('ghost-run');
        const frame = { timeOffset: 877, totalElapsedSeconds: 877, paceSecondsPerKm: 314, distanceKm: 2.8,
            hr: 162, elevationM: 78, gradePercent: -2.1 };
        const route = getGhostRunRoute(Array.from({ length: 60 }, (_, i) => ({ ...frame,
            timeOffset: i * 30, distanceKm: i / 59 * 5.1, latitude: 45 + i * 0.001, longitude: 10 + Math.sin(i / 5) * 0.01,
            timestampMs: Date.UTC(2026, 9, 2, 8, 12) + i * 30_000, elevationM: 100 + Math.sin(i / 5) * 70 })));
        const reference = new Map<boolean, number>();
        const failures: string[] = [];
        for (const [w, h] of [[390, 844], [780, 1688], [2160, 3840], [1188, 669], [2376, 1338], [3840, 2160]]) {
            const canvas = document.createElement('canvas');
            canvas.width = w!; canvas.height = h!;
            const ctx = canvas.getContext('2d')!;
            const portrait = w! < h!;
            const short = Math.min(w!, h!);
            const edge = w! - short * 0.04;
            const fillText = ctx.fillText.bind(ctx);
            let paceHeight = 0;
            ctx.fillText = (value, x, y) => {
                const metrics = ctx.measureText(value);
                const matrix = ctx.getTransform();
                const top = matrix.transformPoint({ x: x - metrics.actualBoundingBoxLeft, y: y - metrics.actualBoundingBoxAscent });
                const bottom = matrix.transformPoint({ x: x + metrics.actualBoundingBoxRight, y: y + metrics.actualBoundingBoxDescent });
                if (value === '5:14') paceHeight = (bottom.y - top.y) / short;
                const isClock = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && ctx.textAlign === 'right';
                if (portrait && (value === 'ELEVATION' || value === 'm' || value.endsWith('% grade') || isClock || /^[+−]\d+ m$/.test(value))) {
                    if (Math.abs(bottom.x - edge) > short * 0.006) failures.push(`${w}x${h}: misaligned right edge ${value}`);
                }
                fillText(value, x, y);
            };
            renderGhostRunLayout(ctx, frame, w!, h!, config, { ghostRoute: route });
            const ratio = reference.get(portrait);
            if (ratio === undefined) reference.set(portrait, paceHeight);
            else if (Math.abs(paceHeight - ratio) > 0.005) failures.push(`${w}x${h}: inconsistent relative type size`);
        }
        return failures;
    });
    expect(failures).toEqual([]);
});

test('Ghost Run is selectable and draws imported telemetry on a real video', async ({ page }) => {
    const video = readFileSync(new URL('./fixtures/sample-3s.mp4', import.meta.url));
    await page.route('**/ghost-e2e.mp4', (route) => route.fulfill({ contentType: 'video/mp4', body: video }));
    await page.goto('/?e2e');
    await page.evaluate(async () => {
        const stores = (window as unknown as { __e2eStores: {
            files: { videoFile: File; videoMeta: unknown; gpxFile: File; gpxData: unknown };
            settings: { selectTemplate: (id: string) => void };
        } }).__e2eStores;
        Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
            request: async () => ({ release: async () => {}, addEventListener: () => {}, removeEventListener: () => {} }),
        } });
        const blob = await (await fetch('/ghost-e2e.mp4')).blob();
        stores.files.videoFile = new File([blob], 'ghost-e2e.mp4', { type: 'video/mp4' });
        stores.files.videoMeta = { duration: 3, width: 640, height: 360, fps: 30, codec: 'avc1.640028',
            fileSize: blob.size, fileName: 'ghost-e2e.mp4', startTime: new Date('2026-10-02T08:12:00Z'), timezoneOffsetMinutes: 0 };
        stores.files.gpxFile = new File(['<gpx/>'], 'track.gpx', { type: 'application/gpx+xml' });
        stores.files.gpxData = { name: 'Ghost Run browser fixture', metadata: {}, points: [0, 1, 2, 3].map((i) => ({
            lat: 45 + i * 0.00001, lon: 10 + i * 0.00001,
            time: new Date(Date.UTC(2026, 9, 2, 8, 12) + i * 1000), hr: 160, ele: 100 + i, power: 300,
        })) };
        stores.settings.selectTemplate('ghost-run');
    });
    await page.getByTestId('proceed-btn').click();
    await expect(page).toHaveURL(/\/preview/);
    await expect(page.locator('#template-select')).toHaveValue('ghost-run');
    await expect(page.getByRole('checkbox', { name: /^Heart rate / })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Time Elapsed time including pauses.' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /^Power / })).toHaveCount(0);
    const canvas = page.locator('.video-player__overlay');
    await expect(canvas).toHaveAttribute('width', '640');
    await expect(canvas).toHaveAttribute('height', '360');
    await expect.poll(() => canvas.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        return ctx.getImageData(400, 270, 220, 60).data.some((value, index) => index % 4 === 3 && value > 0);
    })).toBe(true);
    await page.getByRole('checkbox', { name: /^Distance / }).uncheck();
    await expect(page.getByRole('checkbox', { name: /^Distance / })).not.toBeChecked();
});
