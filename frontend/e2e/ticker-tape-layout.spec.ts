import { expect, test } from '@playwright/test';

test('Ticker Tape keeps every enabled metric legible and inside the frame', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderExtendedLayout } = await import('/src/modules/layouts/extendedLayouts.ts');
        const { getTemplateConfig } = await import('/src/modules/templateConfigs.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();

        const baseConfig = getTemplateConfig('ticker-tape');
        const baseData = {
            pace: '120:59', heartRate: '199', distance: '12345.6', time: '123:59:59', power: '1999',
        };
        const configurations = [
            {
                fontSizePercent: 0.8,
                valueSizeMultiplier: 0.5,
                labelSizeMultiplier: 0.3,
                labelLetterSpacing: 0,
                labelStyle: 'uppercase',
                textShadow: false,
            },
            baseConfig,
            {
                fontSizePercent: 5,
                valueSizeMultiplier: 3,
                labelSizeMultiplier: 1.4,
                labelLetterSpacing: 0.24,
                labelStyle: 'uppercase',
                textShadow: true,
                textShadowColor: 'rgba(0,0,0,0.65)',
                textShadowBlur: 4,
            },
            {
                fontSizePercent: 3,
                valueSizeMultiplier: 2.8,
                labelSizeMultiplier: 1.2,
                labelLetterSpacing: 0.2,
                labelStyle: 'hidden',
                valueFontWeight: 'normal',
                textShadow: false,
            },
        ];
        const sizes = [
            [320, 180], [320, 568], [360, 640], [640, 360], [884, 151],
            [1080, 1080], [1080, 1920], [1920, 1080], [3840, 2160],
        ];
        const keys = ['pace', 'heartRate', 'distance', 'time', 'power'] as const;
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
            }> = [];
            const originalFillText = ctx.fillText.bind(ctx);
            ctx.fillText = (value, x, y, maxWidth) => {
                const metrics = ctx.measureText(value);
                const measuredWidth = Math.min(metrics.width, maxWidth ?? metrics.width);
                const shadow = Math.max(0, ctx.shadowBlur);
                text.push({
                    value,
                    left: x + Math.min(0, metrics.actualBoundingBoxLeft),
                    right: x + Math.max(measuredWidth, metrics.actualBoundingBoxRight),
                    top: y - metrics.actualBoundingBoxAscent - shadow,
                    bottom: y + metrics.actualBoundingBoxDescent + shadow,
                    font: ctx.font,
                });
                if (maxWidth === undefined) originalFillText(value, x, y);
                else originalFillText(value, x, y, maxWidth);
            };

            for (let mask = 0; mask < 32; mask++) {
                for (let configIndex = 0; configIndex < configurations.length; configIndex++) {
                    text.length = 0;
                    ctx.clearRect(0, 0, width!, height!);
                    const config = { ...baseConfig, ...configurations[configIndex] };
                    const id = `${width}x${height}/${mask}/${config.fontSizePercent}/${config.labelStyle}`;
                    // The public layout API receives display metrics, matching the export compositor.
                    const metrics = keys.flatMap((key, index) => mask & (1 << index)
                        ? [{
                            label: { pace: 'Pace', heartRate: 'Heart Rate', distance: 'Distance', time: 'Time', power: 'Power' }[key],
                            value: baseData[key],
                            unit: { pace: 'min/km', heartRate: 'bpm', distance: 'km', time: '', power: 'W' }[key],
                        }]
                        : []);
                    renderExtendedLayout(ctx, metrics, width!, height!, config as never, 'ticker-tape');

                    for (const item of metrics) {
                        if (!text.some((entry) => entry.value === item.value)) {
                            failures.push(`${id}: missing ${item.label} value`);
                        }
                    }
                    for (const entry of text) {
                        const textSize = Number.parseFloat(entry.font.match(/([\d.]+)px/)?.[1] || '0');
                        if (entry.left < 0 || entry.right > width! || entry.top < 0 || entry.bottom > height!) {
                            failures.push(`${id}: outside ${entry.value}`);
                        }
                        if (textSize < 7 || !entry.font.includes('Barlow Semi Condensed')) {
                            failures.push(`${id}: unstable typography ${entry.value} (${entry.font})`);
                        }
                    }
                    cases++;
                }
            }
        }

        return { cases, failures };
    });
    expect(result.cases).toBe(1152);
    expect(result.failures).toEqual([]);
});
