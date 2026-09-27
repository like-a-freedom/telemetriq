import { expect, test } from '@playwright/test';

test('Swiss Grid keeps its open grid and typography inside every frame configuration', async ({ page }, testInfo) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderExtendedLayout } = await import('/src/modules/layouts/extendedLayouts.ts');
        const { getTemplateConfig } = await import('/src/modules/templateConfigs.ts');
        const { getOrientation } = await import('/src/modules/layouts/shared.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();

        const baseConfig = getTemplateConfig('swiss-grid');
        const configurations = [
            baseConfig,
            {
                ...baseConfig,
                fontSizePercent: 5,
                valueSizeMultiplier: 3.1,
                labelSizeMultiplier: 1.2,
                labelLetterSpacing: 0.24,
                backgroundOpacity: 1,
            },
            {
                ...baseConfig,
                labelStyle: 'hidden',
                fontSizePercent: 3,
                valueSizeMultiplier: 2.8,
                valueFontWeight: 'normal',
                backgroundOpacity: 0,
            },
        ];
        const sizes = [
            [320, 180], [320, 568], [360, 640], [640, 360], [884, 151],
            [1080, 1080], [1080, 1920], [1920, 1080], [3840, 2160],
        ];
        const keys = ['pace', 'heartRate', 'distance', 'time'] as const;
        const labels = { pace: 'Pace', heartRate: 'Heart Rate', distance: 'Distance', time: 'Time' };
        const values = { pace: '120:59', heartRate: '199', distance: '12345.6', time: '123:59:59' };
        const units = { pace: 'min/km', heartRate: 'bpm', distance: 'km', time: '' };
        const failures: string[] = [];
        let cases = 0;

        for (const [width, height] of sizes) {
            const canvas = document.createElement('canvas');
            canvas.width = width!;
            canvas.height = height!;
            const ctx = canvas.getContext('2d')!;
            const text: Array<{
                value: string;
                left: number;
                right: number;
                top: number;
                bottom: number;
                font: string;
                fontSize: number;
            }> = [];
            let backgroundFills = 0;
            const originalFillText = ctx.fillText.bind(ctx);
            const originalFillRect = ctx.fillRect.bind(ctx);
            ctx.fillRect = (...args) => {
                backgroundFills++;
                originalFillRect(...args);
            };
            ctx.fillText = (value, x, y, maxWidth) => {
                const metrics = ctx.measureText(value);
                const measuredWidth = Math.min(metrics.width, maxWidth ?? metrics.width);
                const fontSize = Number.parseFloat(ctx.font.match(/([\d.]+)px/)?.[1] || '0');
                const left = ctx.textAlign === 'center'
                    ? x - measuredWidth / 2
                    : ctx.textAlign === 'right'
                        ? x - measuredWidth
                        : x;
                const baseline = ctx.textBaseline === 'top'
                    ? y + (metrics.fontBoundingBoxAscent || fontSize)
                    : y;
                const top = baseline - metrics.actualBoundingBoxAscent;
                const bottom = baseline + metrics.actualBoundingBoxDescent;
                text.push({ value, left, right: left + measuredWidth, top, bottom, font: ctx.font, fontSize });
                if (maxWidth === undefined) originalFillText(value, x, y);
                else originalFillText(value, x, y, maxWidth);
            };

            const orientation = getOrientation(width!, height!);
            const safePad = Math.max(0, Math.min(orientation.safePad, width! * 0.12, height! * 0.12));

            for (let mask = 0; mask < 16; mask++) {
                for (let configIndex = 0; configIndex < configurations.length; configIndex++) {
                    text.length = 0;
                    backgroundFills = 0;
                    ctx.clearRect(0, 0, width!, height!);
                    const config = configurations[configIndex]!;
                    const id = `${width}x${height}/${mask}/${configIndex}`;
                    const metrics = keys.flatMap((key, index) => mask & (1 << index)
                        ? [{ label: labels[key], value: values[key], unit: units[key] }]
                        : []);
                    renderExtendedLayout(ctx, metrics, width!, height!, config, 'swiss-grid');

                    for (const item of metrics) {
                        if (!text.some((entry) => entry.value === item.value)) {
                            failures.push(`${id}: missing ${item.label} value`);
                        }
                    }
                    if (backgroundFills > 0) failures.push(`${id}: unexpected panel background`);

                    const columnWidth = metrics.length > 0 ? (width! - safePad * 2) / metrics.length : width!;
                    for (const entry of text) {
                        if (entry.left < -0.5 || entry.right > width! + 0.5 || entry.top < -0.5 || entry.bottom > height! + 0.5) {
                            failures.push(`${id}: outside ${entry.value}`);
                        }
                        if (entry.fontSize < 7 || !entry.font.includes('Barlow Semi Condensed')) {
                            failures.push(`${id}: unstable typography ${entry.value} (${entry.font})`);
                        }
                        if (metrics.length > 0) {
                            const middle = (entry.left + entry.right) / 2;
                            const column = Math.min(metrics.length - 1, Math.max(0, Math.floor((middle - safePad) / columnWidth)));
                            const columnLeft = safePad + columnWidth * column;
                            const columnRight = columnLeft + columnWidth;
                            if (entry.left < columnLeft - 0.5 || entry.right > columnRight + 0.5) {
                                failures.push(`${id}: text crosses metric column ${entry.value}`);
                            }
                        }
                    }

                    for (let first = 0; first < text.length; first += 1) {
                        for (let second = first + 1; second < text.length; second += 1) {
                            const a = text[first]!;
                            const b = text[second]!;
                            const horizontalOverlap = a.left < b.right - 0.25 && b.left < a.right - 0.25;
                            const verticalOverlap = a.top < b.bottom - 0.25 && b.top < a.bottom - 0.25;
                            if (horizontalOverlap && verticalOverlap) {
                                failures.push(`${id}: text collision ${a.value}/${b.value}`);
                            }
                        }
                    }
                    cases++;
                }
            }
        }

        const previews: Record<string, string> = {};
        const previewCases = [
            { name: 'swiss-grid-shallow-landscape', width: 884, height: 151, config: baseConfig },
            { name: 'swiss-grid-portrait-compact', width: 320, height: 568, config: configurations[1]! },
        ];
        const previewMetrics = [
            { label: 'Pace', value: '05:30', unit: 'min/km' },
            { label: 'Heart Rate', value: '150', unit: 'bpm' },
            { label: 'Distance', value: '10.2', unit: 'km' },
            { label: 'Time', value: '00:45:12', unit: '' },
        ];
        for (const preview of previewCases) {
            const canvas = document.createElement('canvas');
            canvas.width = preview.width;
            canvas.height = preview.height;
            const ctx = canvas.getContext('2d')!;
            const field = ctx.createLinearGradient(0, 0, preview.width, preview.height);
            field.addColorStop(0, '#b7c8b9');
            field.addColorStop(0.46, '#37584c');
            field.addColorStop(1, '#101713');
            ctx.fillStyle = field;
            ctx.fillRect(0, 0, preview.width, preview.height);
            renderExtendedLayout(ctx, previewMetrics, preview.width, preview.height, preview.config, 'swiss-grid');
            previews[preview.name] = canvas.toDataURL('image/png');
        }

        return { cases, failures, previews };
    });

    for (const [name, dataUrl] of Object.entries(result.previews)) {
        await testInfo.attach(name, {
            body: Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'),
            contentType: 'image/png',
        });
    }
    expect(result.cases).toBe(432);
    expect(result.failures).toEqual([]);
});
