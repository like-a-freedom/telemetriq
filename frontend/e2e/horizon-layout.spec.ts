import { expect, test } from '@playwright/test';

test('Horizon keeps every label, value, and unit inside the frame without collisions', async ({ page }) => {
    await page.goto('/?e2e');

    const result = await page.evaluate(async () => {
        const { renderHorizonLayout } = await import('/src/modules/layouts/horizonLayout.ts');
        const { getTemplateConfig } = await import('/src/modules/templateConfigs.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();

        const dimensions = [
            [320, 180], [320, 568], [360, 640], [640, 360], [884, 151], [1080, 1080],
            [1080, 1920], [1920, 1080], [3840, 2160],
        ];
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
            },
            {
                fontSizePercent: 2.4,
            },
            {
                fontSizePercent: 8,
            },
            {
                fontSizePercent: 4.8,
                valueSizeMultiplier: 4,
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

        for (const [width, height] of dimensions) {
            for (let mask = 1; mask < 1 << metrics.length; mask += 1) {
                const enabled = metrics.filter((_, index) => mask & (1 << index));
                for (const overrides of configurations) {
                    cases += 1;
                    const canvas = document.createElement('canvas');
                    canvas.width = width!;
                    canvas.height = height!;
                    const ctx = canvas.getContext('2d')!;
                    ctx.fillStyle = '#617348';
                    ctx.fillRect(0, 0, width!, height!);

                    const drawnText: Array<{ left: number; right: number; top: number; bottom: number }> = [];
                    const originalFillText = ctx.fillText.bind(ctx);
                    ctx.fillText = ((text: string, x: number, y: number, maxWidth?: number) => {
                        const measured = ctx.measureText(text);
                        const fontSize = Number.parseFloat(ctx.font.match(/[\d.]+px/)?.[0] ?? '0');
                        const left = ctx.textAlign === 'center'
                            ? x - measured.width / 2
                            : ctx.textAlign === 'right' ? x - measured.width : x;
                        drawnText.push({ left, right: left + measured.width, top: y, bottom: y + fontSize });
                        originalFillText(text, x, y, maxWidth);
                    }) as typeof ctx.fillText;

                    const config = { ...getTemplateConfig('horizon'), ...overrides };
                    renderHorizonLayout(ctx as never, enabled, width!, height!, config);

                    const expectedTextCalls = enabled.reduce((count, metric) =>
                        count + (config.labelStyle === 'hidden' ? 0 : metric.label.length) + 1 + (metric.unit ? 1 : 0), 0);
                    if (drawnText.length !== expectedTextCalls) {
                        failures.push(`${width}x${height}/${mask}: missing text (${drawnText.length}/${expectedTextCalls})`);
                    }
                    const outside = drawnText.some((box) =>
                        box.left < -0.5 || box.right > width! + 0.5 || box.top < -0.5 || box.bottom > height! + 0.5,
                    );
                    const collisions = drawnText.some((a, index) => drawnText.slice(index + 1).some((b) =>
                        a.left < b.right - 0.5 && b.left < a.right - 0.5
                        && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5,
                    ));

                    if (outside) failures.push(`${width}x${height}/${mask}: text outside frame`);
                    if (collisions) failures.push(`${width}x${height}/${mask}: text collision`);
                }
            }
        }

        return { cases, failures };
    });

    expect(result.cases).toBe(1395);
    expect(result.failures).toEqual([]);
});
