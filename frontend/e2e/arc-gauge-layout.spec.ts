import { expect, test } from '@playwright/test';

test('Arc Gauge keeps text and dial inside the video across sizes and metric settings', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const layoutPath = '/src/modules/layouts/arcGaugeLayout.ts';
        const sharedPath = '/src/modules/layouts/shared.ts';
        const tuningPath = '/src/modules/overlayUtils.ts';
        const fontsPath = '/src/modules/trailRunFonts.ts';
        const { drawArcGauge } = await import(layoutPath);
        const { getOrientation } = await import(sharedPath);
        const { getResolutionTuning } = await import(tuningPath);
        const { ensureTrailRunFonts } = await import(fontsPath);
        await ensureTrailRunFonts();
        const failures: string[] = [];
        let cases = 0;
        const sizes = [[320, 568], [360, 640], [640, 360], [1080, 1080],
            [1080, 1920], [1920, 1080], [3840, 2160]];
        const baseData = { pace: '99:59', heartRate: '199', distance: '12345.6', time: '123:59:59' };
        for (const [w, h] of sizes) {
            for (let mask = 0; mask < 16; mask++) {
                for (const fontSizePercent of [1, 2.2, 6]) {
                    const canvas = document.createElement('canvas');
                    canvas.width = w!;
                    canvas.height = h!;
                    const ctx = canvas.getContext('2d')!;
                    const boxes: { text: string; left: number; right: number; top: number; bottom: number }[] = [];
                    const arcs: { x: number; y: number; radius: number }[] = [];
                    const fillText = ctx.fillText.bind(ctx);
                    ctx.fillText = (text, x, y, maxWidth) => {
                        const metrics = ctx.measureText(text);
                        const fontSize = Number.parseFloat(ctx.font.match(/([\d.]+)px/)?.[1] || '0');
                        boxes.push({ text, left: x - metrics.actualBoundingBoxLeft,
                            right: x + metrics.actualBoundingBoxRight,
                            top: y, bottom: y + fontSize });
                        fillText(text, x, y, maxWidth);
                    };
                    const arc = ctx.arc.bind(ctx);
                    ctx.arc = (x, y, radius, start, end, anticlockwise) => {
                        arcs.push({ x, y, radius });
                        arc(x, y, radius, start, end, anticlockwise);
                    };
                    const keys = ['pace', 'heartRate', 'distance', 'time'] as const;
                    const data = Object.fromEntries(keys.map((key, i) => [key,
                        mask & (1 << i) ? baseData[key] : undefined]));
                    const config = { fontFamily: '"Barlow Semi Condensed", sans-serif',
                        fontSizePercent, valueSizeMultiplier: fontSizePercent === 1 ? 0.75 : fontSizePercent === 6 ? 3.5 : 1.8,
                        labelSizeMultiplier: fontSizePercent === 1 ? 0.75 : fontSizePercent === 6 ? 1.3 : 0.45,
                        valueFontWeight: 'normal', textColor: '#fff', accentColor: '#00e676' };
                    drawArcGauge(ctx, data as never, w!, h!, config as never,
                        getOrientation(w!, h!), getResolutionTuning(w!, h!));
                    const id = `${w}x${h}/${mask}/${fontSizePercent}`;
                    for (const box of boxes) {
                        if (box.left < 0 || box.right > w! || box.top < 0 || box.bottom > h!) {
                            failures.push(`${id}: outside ${box.text}`);
                        }
                    }
                    for (let i = 0; i < boxes.length; i++) {
                        const a = boxes[i]!;
                        for (const b of boxes.slice(i + 1)) {
                            if (a.left < b.right && a.right > b.left
                                && a.top < b.bottom && a.bottom > b.top) {
                                failures.push(`${id}: text collision ${a.text}(${a.top}-${a.bottom})/${b.text}(${b.top}-${b.bottom})`);
                            }
                        }
                    }
                    for (const shape of arcs) {
                        if (shape.x - shape.radius < 0 || shape.x + shape.radius > w!
                            || shape.y - shape.radius < 0 || shape.y + shape.radius > h!) {
                            failures.push(`${id}: dial outside frame`);
                        }
                    }
                    cases++;
                }
            }
        }
        return { cases, failures };
    });
    expect(result.cases).toBe(336);
    expect(result.failures).toEqual([]);
});
