import { expect, test } from '@playwright/test';

test('corner and ticker metrics remain readable at normal video resolutions', async ({ page }, testInfo) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderExtendedLayout } = await import('/src/modules/layouts/extendedLayouts.ts');
        const { getTemplateConfig } = await import('/src/modules/templateConfigs.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const metrics = [
            { label: 'Pace', value: '05:30', unit: 'min/km' },
            { label: 'Heart Rate', value: '150', unit: 'bpm' },
            { label: 'Distance', value: '10.2', unit: 'km' },
            { label: 'Time', value: '00:45:12', unit: '' },
        ];
        const failures: string[] = [];
        const previews: Record<string, string> = {};
        for (const id of ['ticker-tape', 'whisper', 'garmin-style']) {
            for (const [width, height] of [[1280, 720], [1920, 1080], [320, 568]]) {
                const canvas = document.createElement('canvas');
                canvas.width = width!; canvas.height = height!;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = '#496455'; ctx.fillRect(0, 0, width!, height!);
                const fillText = ctx.fillText.bind(ctx);
                ctx.fillText = (text, x, y, maxWidth) => {
                    const size = Number.parseFloat(ctx.font.match(/([\d.]+)px/)?.[1] || '0');
                    if (id !== 'garmin-style' && width! >= 1280 && metrics.some((m) => m.value === text)
                        && size < (width === 1920 ? 36 : 22)) failures.push(`${id}/${width}: small value ${text}: ${size}`);
                    if (maxWidth === undefined) fillText(text, x, y);
                    else fillText(text, x, y, maxWidth);
                };
                renderExtendedLayout(ctx, metrics, width!, height!, getTemplateConfig(id), id);
                if (width !== 1920) previews[`${id}-${width}`] = canvas.toDataURL();
            }
        }
        return { failures, previews };
    });
    for (const [name, url] of Object.entries(result.previews)) {
        await testInfo.attach(name, { body: Buffer.from(url.split(',')[1]!, 'base64'), contentType: 'image/png' });
    }
    expect(result.failures).toEqual([]);
});
