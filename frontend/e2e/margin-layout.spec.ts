import { expect, test } from '@playwright/test';

test('Margin keeps every metric inside the frame without text collisions', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const rendererPath = '/src/modules/layouts/marginLayout.ts';
        const templatesPath = '/src/modules/templateConfigs.ts';
        const fontsPath = '/src/modules/trailRunFonts.ts';
        const { renderMarginLayout } = await import(rendererPath);
        const { getTemplateConfig } = await import(templatesPath);
        const { ensureTrailRunFonts } = await import(fontsPath);
        await ensureTrailRunFonts();
        const metrics = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const configurations = [
            { fontSizePercent: 1 },
            { fontSizePercent: 2.4 },
            { fontSizePercent: 8 },
            {
                fontSizePercent: 4.8,
                valueSizeMultiplier: 7,
                labelSizeMultiplier: 1.2,
                labelLetterSpacing: 0.2,
                lineSpacing: 1.8,
            },
            {
                fontSizePercent: 0.8,
                valueSizeMultiplier: 0.5,
                labelSizeMultiplier: 0.25,
                labelLetterSpacing: 0,
                lineSpacing: 0.8,
                labelStyle: 'hidden',
            },
        ];
        const failures: string[] = [];
        let cases = 0;
        for (const [w, h] of [[320, 180], [320, 568], [360, 640], [640, 360], [884, 151], [1080, 1080], [1080, 1920], [1920, 1080], [3840, 2160]]) {
            for (let mask = 1; mask < 32; mask++) {
                for (const overrides of configurations) {
                    const canvas = document.createElement('canvas');
                    canvas.width = w!;
                    canvas.height = h!;
                    const ctx = canvas.getContext('2d')!;
                    const boxes: { text: string; group: string; left: number; right: number; top: number; bottom: number }[] = [];
                    ctx.fillText = (text, x, y) => {
                        const bounds = ctx.measureText(text);
                        const matrix = ctx.getTransform();
                        const isRotatedLabel = Math.abs(matrix.a) < 0.001 && Math.abs(matrix.d) < 0.001;
                        const group = isRotatedLabel
                            ? `label:${matrix.e.toFixed(3)}:${matrix.f.toFixed(3)}:${matrix.b.toFixed(3)}`
                            : `text:${boxes.length}`;
                        const points = [
                            [x - bounds.actualBoundingBoxLeft, y - bounds.actualBoundingBoxAscent],
                            [x + bounds.actualBoundingBoxRight, y - bounds.actualBoundingBoxAscent],
                            [x - bounds.actualBoundingBoxLeft, y + bounds.actualBoundingBoxDescent],
                            [x + bounds.actualBoundingBoxRight, y + bounds.actualBoundingBoxDescent],
                        ].map(([px, py]) => new DOMPoint(px, py).matrixTransform(matrix));
                        boxes.push({ text, group, left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
                            top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) });
                    };
                    const enabled = metrics.filter((_, index) => mask & (1 << index));
                    const config = { ...getTemplateConfig('margin'), ...overrides };
                    renderMarginLayout(ctx, enabled, w, h, config);
                    const id = `${w}x${h}/${mask}/${config.fontSizePercent}`;
                    const expectedText = enabled.reduce((count, metric) => {
                        const shortLabel = metric.label === 'Heart Rate' ? 'HR'
                            : metric.label === 'Distance' ? 'DIST' : metric.label.toUpperCase();
                        return count + (config.labelStyle === 'hidden' ? 0 : shortLabel.length) + 1 + (metric.unit ? 1 : 0);
                    }, 0);
                    if (boxes.length !== expectedText) failures.push(`${id}: missing text (${boxes.length}/${expectedText})`);
                    const collisionBoxes = [...boxes.reduce((groups, box) => {
                        const previous = groups.get(box.group);
                        if (!previous) groups.set(box.group, { ...box });
                        else {
                            previous.text += box.text;
                            previous.left = Math.min(previous.left, box.left);
                            previous.right = Math.max(previous.right, box.right);
                            previous.top = Math.min(previous.top, box.top);
                            previous.bottom = Math.max(previous.bottom, box.bottom);
                        }
                        return groups;
                    }, new Map<string, (typeof boxes)[number]>()).values()];
                    for (let i = 0; i < collisionBoxes.length; i++) {
                        const a = collisionBoxes[i]!;
                        if (a.left < 0 || a.top < 0 || a.right > w! || a.bottom > h!) failures.push(`${id}: outside ${a.text}`);
                        for (const b of collisionBoxes.slice(i + 1)) {
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
    expect(result.cases).toBe(1395);
    expect(result.failures).toEqual([]);
});
