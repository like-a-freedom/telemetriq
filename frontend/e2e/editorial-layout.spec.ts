import { expect, test } from '@playwright/test';

test('Editorial keeps its pace and side metrics readable inside the frame', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { drawEditorial } = await import('/src/modules/layouts/editorialLayout.ts');
        const { getOrientation } = await import('/src/modules/layouts/shared.ts');
        const { getResolutionTuning } = await import('/src/modules/overlayUtils.ts');
        const { getTemplateConfig } = await import('/src/modules/templateConfigs.ts');
        const baseConfig = getTemplateConfig('editorial');
        const baseData = {
            pace: '120:59', heartRate: '199', distance: '12345.6', time: '123:59:59', power: '1999',
        };
        const configurations = [
            {
                fontSizePercent: 1,
                valueSizeMultiplier: 0.72,
                labelSizeMultiplier: 0.3,
                labelLetterSpacing: 0,
                lineSpacing: 0.85,
                labelStyle: 'uppercase',
                textShadow: false,
            },
            baseConfig,
            {
                fontSizePercent: 3.5,
                valueSizeMultiplier: 3.1,
                labelSizeMultiplier: 1.2,
                labelLetterSpacing: 0.24,
                lineSpacing: 1.6,
                labelStyle: 'uppercase',
                textShadow: true,
            },
            {
                fontSizePercent: 3,
                valueSizeMultiplier: 2.8,
                labelSizeMultiplier: 1.2,
                labelLetterSpacing: 0.2,
                lineSpacing: 1.5,
                labelStyle: 'hidden',
                textShadow: false,
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
                for (let configIndex = 0; configIndex < configurations.length; configIndex++) {
                    const overrides = configurations[configIndex]!;
                    const canvas = document.createElement('canvas');
                    canvas.width = w!;
                    canvas.height = h!;
                    const ctx = canvas.getContext('2d')!;
                    const boxes: {
                        text: string;
                        left: number;
                        right: number;
                        top: number;
                        bottom: number;
                        font: string;
                    }[] = [];
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
                        const top = ctx.textBaseline === 'top'
                            ? y
                            : ctx.textBaseline === 'middle'
                                ? y - fontSize / 2
                                : y - fontSize * 0.8;
                        boxes.push({ text, left, right: left + width, top, bottom: top + fontSize, font: ctx.font });
                        fillText(text, x, y, maxWidth);
                    };
                    const keys = ['pace', 'heartRate', 'distance', 'time', 'power'] as const;
                    const data = Object.fromEntries(keys.map((key, index) => [key,
                        mask & (1 << index) ? baseData[key] : undefined]));
                    const config = { ...baseConfig, ...overrides };
                    drawEditorial(ctx, data as never, w!, h!, config as never,
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

                    if (w === 360 && h === 640 && mask === 2 && configIndex === 1) {
                        const value = boxes.find((box) => box.text === '199' && box.font.includes('Georgia'));
                        const unit = boxes.find((box) => box.text === 'bpm' && box.font.includes('Georgia'));
                        if (!value || !unit) failures.push(`${id}: centered side metric is missing`);
                        else if (Math.abs((Math.min(value.left, unit.left) + Math.max(value.right, unit.right)) / 2 - w! / 2) > 1) {
                            failures.push(`${id}: side metrics without pace are not centered`);
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
