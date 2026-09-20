import { expect, test } from '@playwright/test';

test('Horizon keeps every metric inside the frame without text collisions', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const rendererPath = '/src/modules/layouts/horizonLayout.ts';
        const templatesPath = '/src/modules/templateConfigs.ts';
        const fontsPath = '/src/modules/trailRunFonts.ts';
        const { renderHorizonLayout } = await import(rendererPath);
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
        const failures: string[] = [];
        let cases = 0;
        for (const [w, h] of [[320, 568], [360, 640], [640, 360], [1080, 1080], [1080, 1920], [1920, 1080], [3840, 2160]]) {
            for (let mask = 1; mask < 32; mask++) {
                for (const fontSizePercent of [1, 2.4, 8]) {
                    const canvas = document.createElement('canvas');
                    canvas.width = w!;
                    canvas.height = h!;
                    const ctx = canvas.getContext('2d')!;
                    const boxes: { text: string; left: number; right: number; top: number; bottom: number }[] = [];
                    ctx.fillText = (text, x, y) => {
                        const bounds = ctx.measureText(text);
                        boxes.push({ text, left: x - bounds.actualBoundingBoxLeft, right: x + bounds.actualBoundingBoxRight,
                            top: y - bounds.actualBoundingBoxAscent, bottom: y + bounds.actualBoundingBoxDescent });
                    };
                    const enabled = metrics.filter((_, index) => mask & (1 << index));
                    renderHorizonLayout(ctx, enabled, w, h, { ...getTemplateConfig('horizon'), fontSizePercent });
                    const id = `${w}x${h}/${mask}/${fontSizePercent}`;
                    if (boxes.length !== enabled.reduce((count, metric) => count + (metric.unit ? 3 : 2), 0)) failures.push(`${id}: missing text`);
                    for (let i = 0; i < boxes.length; i++) {
                        const a = boxes[i]!;
                        if (a.left < 0 || a.top < 0 || a.right > w! || a.bottom > h!) failures.push(`${id}: outside ${a.text}`);
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
    expect(result.cases).toBe(651);
    expect(result.failures).toEqual([]);
});
