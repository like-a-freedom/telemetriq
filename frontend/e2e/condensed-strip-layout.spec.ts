import { expect, test } from '@playwright/test';

test('Condensed Strip keeps every enabled metric readable and inside the frame', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderExtendedLayout } = await import('/src/modules/layouts/extendedLayouts.ts');
        const { getTemplateConfig } = await import('/src/modules/templateConfigs.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();

        const baseConfig = getTemplateConfig('condensed-strip');
        const configurations = [
            baseConfig,
            {
                ...baseConfig,
                fontSizePercent: 5,
                valueSizeMultiplier: 3.1,
                labelSizeMultiplier: 1.2,
                labelLetterSpacing: 0.24,
            },
            {
                ...baseConfig,
                labelStyle: 'hidden',
                fontSizePercent: 3,
                valueSizeMultiplier: 2.8,
                valueFontWeight: 'normal',
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
                const top = ctx.textBaseline === 'top' ? y : y - metrics.actualBoundingBoxAscent;
                const bottom = ctx.textBaseline === 'top'
                    ? y + fontSize
                    : y + metrics.actualBoundingBoxDescent;
                text.push({ value, left, right: left + measuredWidth, top, bottom, font: ctx.font, fontSize });
                if (maxWidth === undefined) originalFillText(value, x, y);
                else originalFillText(value, x, y, maxWidth);
            };

            for (let mask = 0; mask < 16; mask++) {
                for (let configIndex = 0; configIndex < configurations.length; configIndex++) {
                    text.length = 0;
                    ctx.clearRect(0, 0, width!, height!);
                    const config = configurations[configIndex]!;
                    const id = `${width}x${height}/${mask}/${configIndex}`;
                    const metrics = keys.flatMap((key, index) => mask & (1 << index)
                        ? [{ label: labels[key], value: values[key], unit: units[key] }]
                        : []);
                    renderExtendedLayout(ctx, metrics, width!, height!, config, 'condensed-strip');

                    for (const item of metrics) {
                        if (!text.some((entry) => entry.value === item.value || entry.value.startsWith(`${item.value} `))) {
                            failures.push(`${id}: missing ${item.label} value`);
                        }
                    }

                    const segmentWidth = metrics.length > 0 ? width! / metrics.length : width!;
                    for (const entry of text) {
                        if (entry.left < 0 || entry.right > width! || entry.top < 0 || entry.bottom > height!) {
                            failures.push(`${id}: outside ${entry.value}`);
                        }
                        if (entry.fontSize < 7 || !entry.font.includes('Barlow Semi Condensed')) {
                            failures.push(`${id}: unstable typography ${entry.value} (${entry.font})`);
                        }
                        if (metrics.length > 0) {
                            const segment = Math.min(metrics.length - 1, Math.max(0, Math.floor((entry.left + entry.right) / 2 / segmentWidth)));
                            const segmentLeft = segment * segmentWidth;
                            const segmentRight = (segment + 1) * segmentWidth;
                            if (entry.left < segmentLeft - 0.5 || entry.right > segmentRight + 0.5) {
                                failures.push(`${id}: text crosses segment boundary ${entry.value}`);
                            }
                        }
                    }

                    const rows = new Map<string, { top: number; bottom: number }>();
                    for (const entry of text) {
                        const key = `${entry.top.toFixed(1)}:${entry.fontSize}`;
                        const row = rows.get(key);
                        if (!row) rows.set(key, { top: entry.top, bottom: entry.bottom });
                        else row.bottom = Math.max(row.bottom, entry.bottom);
                    }
                    const orderedRows = [...rows.values()].sort((first, second) => first.top - second.top);
                    for (let index = 0; index < orderedRows.length - 1; index += 1) {
                        if (orderedRows[index]!.bottom > orderedRows[index + 1]!.top + 0.5) {
                            failures.push(`${id}: label/value rows collide`);
                        }
                    }
                    cases++;
                }
            }
        }

        return { cases, failures };
    });
    expect(result.cases).toBe(432);
    expect(result.failures).toEqual([]);
});
