import { expect, test } from '@playwright/test';

test('Cinematic Bar keeps each metric readable and inside the frame', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { drawCinematicBar } = await import('/src/modules/layouts/cinematicBarLayout.ts');
        const { getOrientation } = await import('/src/modules/layouts/shared.ts');
        const { getResolutionTuning } = await import('/src/modules/overlayUtils.ts');
        const { getTemplateConfig } = await import('/src/modules/templateConfigs.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const baseData = {
            pace: '120:59', heartRate: '199', distance: '12345.6', time: '123:59:59', power: '1999',
        };
        const configurations = [
            {
                fontSizePercent: 1,
                valueSizeMultiplier: 0.75,
                labelSizeMultiplier: 0.36,
                labelLetterSpacing: 0,
                lineSpacing: 0.9,
                labelStyle: 'uppercase',
                backgroundOpacity: 0,
            },
            getTemplateConfig('cinematic-bar'),
            {
                fontSizePercent: 6,
                valueSizeMultiplier: 3.5,
                labelSizeMultiplier: 1.3,
                labelLetterSpacing: 0.22,
                lineSpacing: 1.6,
                labelStyle: 'uppercase',
                backgroundOpacity: 0.9,
            },
            {
                fontSizePercent: 4.5,
                valueSizeMultiplier: 3,
                labelSizeMultiplier: 1.3,
                labelLetterSpacing: 0.18,
                lineSpacing: 1.5,
                labelStyle: 'hidden',
                backgroundOpacity: 0.4,
            },
        ];
        const sizes = [
            [320, 180], [320, 568], [360, 640], [640, 360], [884, 151],
            [1080, 1080], [1080, 1920], [1920, 1080], [3840, 2160],
        ];
        const failures: string[] = [];
        let cases = 0;

        for (const [w, h] of sizes) {
            for (let mask = 0; mask < 32; mask++) {
                for (const overrides of configurations) {
                    const canvas = document.createElement('canvas');
                    canvas.width = w!;
                    canvas.height = h!;
                    const ctx = canvas.getContext('2d')!;
                    const boxes: { text: string; left: number; right: number; top: number; bottom: number }[] = [];
                    const fillText = ctx.fillText.bind(ctx);
                    ctx.fillText = (text, x, y, maxWidth) => {
                        const metrics = ctx.measureText(text);
                        const fontSize = Number.parseFloat(ctx.font.match(/([\d.]+)px/)?.[1] || '0');
                        const width = Math.min(metrics.width, maxWidth ?? metrics.width);
                        const left = ctx.textAlign === 'center'
                            ? x - width / 2
                            : ctx.textAlign === 'right' || ctx.textAlign === 'end'
                                ? x - width
                                : x;
                        const top = ctx.textBaseline === 'middle'
                            ? y - fontSize / 2
                            : ctx.textBaseline === 'top'
                                ? y
                                : y - fontSize * 0.8;
                        boxes.push({ text, left, right: left + width, top, bottom: top + fontSize });
                        fillText(text, x, y, maxWidth);
                    };
                    const keys = ['pace', 'heartRate', 'distance', 'time', 'power'] as const;
                    const data = Object.fromEntries(keys.map((key, index) => [key,
                        mask & (1 << index) ? baseData[key] : undefined]));
                    const config = { ...getTemplateConfig('cinematic-bar'), ...overrides };
                    drawCinematicBar(ctx, data as never, w!, h!, config as never,
                        getOrientation(w!, h!), getResolutionTuning(w!, h!));
                    const id = `${w}x${h}/${mask}/${config.fontSizePercent}/${config.labelStyle}`;

                    for (const box of boxes) {
                        if (box.left < 0 || box.top < 0 || box.right > w! || box.bottom > h!) {
                            failures.push(`${id}: outside ${box.text}`);
                        }
                    }
                    for (let i = 0; i < boxes.length; i++) {
                        const a = boxes[i]!;
                        for (const b of boxes.slice(i + 1)) {
                            if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
                                failures.push(`${id}: collision ${a.text}/${b.text}`);
                            }
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
