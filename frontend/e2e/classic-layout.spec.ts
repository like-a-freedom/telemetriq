import { expect, test } from '@playwright/test';

test('Classic keeps every metric inside the frame without text collisions', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const rendererPath = '/src/modules/layouts/classicLayout.ts';
        const templatesPath = '/src/modules/templateConfigs.ts';
        const fontsPath = '/src/modules/trailRunFonts.ts';
        const { renderClassicLayout } = await import(rendererPath);
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
            {
                fontSizePercent: 1,
                valueSizeMultiplier: 0.5,
                labelStyle: 'uppercase',
                lineSpacing: 0.8,
                backgroundOpacity: 0,
                borderWidth: 0,
                textShadow: false,
            },
            {
                fontSizePercent: 3.5,
                valueSizeMultiplier: 2.5,
                labelStyle: 'uppercase',
                lineSpacing: 1.5,
                backgroundColor: '#000000',
                backgroundOpacity: 0.35,
                borderWidth: 2,
                textShadow: true,
            },
            {
                fontSizePercent: 8,
                valueSizeMultiplier: 4,
                labelStyle: 'hidden',
                lineSpacing: 2.2,
                backgroundColor: '#000000',
                backgroundOpacity: 0.8,
                borderWidth: 8,
                textShadow: true,
            },
        ];
        const failures: string[] = [];
        let cases = 0;
        for (const [w, h] of [[320, 180], [320, 568], [360, 640], [640, 360], [884, 151], [1080, 1080], [1080, 1920], [1920, 1080], [3840, 2160]]) {
            for (let mask = 1; mask < 32; mask++) {
                for (const overrides of configurations) {
                  for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
                   for (const layout of ['vertical', 'horizontal']) {
                    const canvas = document.createElement('canvas');
                    canvas.width = w!;
                    canvas.height = h!;
                    const ctx = canvas.getContext('2d')!;
                    const boxes: { text: string; left: number; right: number; top: number; bottom: number; advance: number; inkLeft: number; inkRight: number; font: string }[] = [];
                    ctx.fillText = (text, x, y) => {
                        const bounds = ctx.measureText(text);
                        boxes.push({ text, left: x - bounds.actualBoundingBoxLeft, right: x + bounds.actualBoundingBoxRight,
                            top: y - bounds.actualBoundingBoxAscent, bottom: y + bounds.actualBoundingBoxDescent,
                            advance: bounds.width, inkLeft: bounds.actualBoundingBoxLeft, inkRight: bounds.actualBoundingBoxRight, font: ctx.font });
                    };
                    const enabled = metrics.filter((_, index) => mask & (1 << index));
                    const config = { ...getTemplateConfig('classic'), ...overrides, position, layout };
                    renderClassicLayout(ctx, enabled, w, h, config);
                    const id = `${w}x${h}/${mask}/${config.fontSizePercent}/${position}/${layout}/${config.labelStyle}`;
                    if (boxes.length !== (layout === 'horizontal' ? 1 : enabled.length)) failures.push(`${id}: missing text`);
                    for (let i = 0; i < boxes.length; i++) {
                        const a = boxes[i]!;
                        if (a.left < 0 || a.top < 0 || a.right > w! || a.bottom > h!) {
                            failures.push(`${id}: bounds ${a.left.toFixed(2)},${a.top.toFixed(2)}–${a.right.toFixed(2)},${a.bottom.toFixed(2)} exceed ${w}x${h}; advance=${a.advance.toFixed(2)} ink=${a.inkLeft.toFixed(2)}+${a.inkRight.toFixed(2)} font=${a.font}`);
                        }
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
            }
        }
        return { cases, failures };
    });
    expect(result.cases).toBe(6696);
    expect(result.failures).toEqual([]);
});
