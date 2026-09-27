import { expect, test } from '@playwright/test';

test('Cockpit HUD keeps its centered metric cells inside every frame configuration', async ({ page }, testInfo) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderExtendedLayout } = await import('/src/modules/layouts/extendedLayouts.ts');
        const { getTemplateConfig } = await import('/src/modules/templateConfigs.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();

        const baseConfig = getTemplateConfig('cockpit-hud');
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
        const keys = ['pace', 'heartRate', 'distance', 'time', 'power'] as const;
        const labels = { pace: 'Pace', heartRate: 'Heart Rate', distance: 'Distance', time: 'Time', power: 'Power' };
        const values = { pace: '120:59', heartRate: '199', distance: '12345.6', time: '123:59:59', power: '1999' };
        const units = { pace: 'min/km', heartRate: 'bpm', distance: 'km', time: '', power: 'W' };
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
            const originalFillText = ctx.fillText.bind(ctx);
            ctx.fillText = (value, x, y, maxWidth) => {
                const metrics = ctx.measureText(value);
                const measuredWidth = Math.min(metrics.width, maxWidth ?? metrics.width);
                const fontSize = Number.parseFloat(ctx.font.match(/([\d.]+)px/)?.[1] || '0');
                const left = ctx.textAlign === 'center'
                    ? x - measuredWidth / 2
                    : ctx.textAlign === 'right'
                        ? x - measuredWidth
                        : x;
                const top = y - metrics.actualBoundingBoxAscent;
                const bottom = y + metrics.actualBoundingBoxDescent;
                text.push({ value, left, right: left + measuredWidth, top, bottom, font: ctx.font, fontSize });
                if (maxWidth === undefined) originalFillText(value, x, y);
                else originalFillText(value, x, y, maxWidth);
            };

            for (let mask = 0; mask < 32; mask++) {
                for (let configIndex = 0; configIndex < configurations.length; configIndex++) {
                    text.length = 0;
                    ctx.clearRect(0, 0, width!, height!);
                    const config = configurations[configIndex]!;
                    const id = `${width}x${height}/${mask}/${configIndex}`;
                    const metrics = keys.flatMap((key, index) => mask & (1 << index)
                        ? [{ label: labels[key], value: values[key], unit: units[key] }]
                        : []);
                    renderExtendedLayout(ctx, metrics, width!, height!, config, 'cockpit-hud');

                    for (const item of metrics) {
                        if (!text.some((entry) => entry.value === item.value)) {
                            failures.push(`${id}: missing ${item.label} value`);
                        }
                    }
                    for (const entry of text) {
                        if (entry.left < -0.5 || entry.right > width! + 0.5 || entry.top < -0.5 || entry.bottom > height! + 0.5) {
                            failures.push(`${id}: outside ${entry.value}`);
                        }
                        if (entry.fontSize < 7) {
                            failures.push(`${id}: unstable typography ${entry.value} (${entry.font})`);
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
            { name: 'cockpit-hud-shallow-landscape', width: 1280, height: 720, config: baseConfig },
            { name: 'cockpit-hud-portrait-compact', width: 320, height: 568, config: configurations[1]! },
        ];
        const previewMetrics = [
            { label: 'Pace', value: '05:30', unit: 'min/km' },
            { label: 'Heart Rate', value: '150', unit: 'bpm' },
            { label: 'Distance', value: '10.2', unit: 'km' },
            { label: 'Time', value: '00:45:12', unit: '' },
            { label: 'Power', value: '245', unit: 'W' },
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
            renderExtendedLayout(ctx, previewMetrics, preview.width, preview.height, preview.config, 'cockpit-hud');
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
    expect(result.cases).toBe(864);
    expect(result.failures).toEqual([]);
});
