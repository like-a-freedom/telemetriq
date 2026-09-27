import { describe, it, expect, vi } from 'vitest';
import { renderExtendedLayout } from '../modules/layouts/extendedLayouts';
import { getTemplateConfig } from '../modules/templateConfigs';
import { getTemplateDefinition } from '../modules/templates/registry';
import type { MetricItem } from '../core/types';
import type { OverlayContext2D } from '../modules/overlayUtils';
import { TRAIL_RUN_FONT_FAMILY } from '../modules/trailRunFonts';

type FillTextEntry = {
    text: string;
    x: number;
    y: number;
    align: CanvasTextAlign;
    font: string;
    maxWidth?: number;
    measuredWidth: number;
    fontSize: number;
    baseline: CanvasTextBaseline;
};

type StubContext = OverlayContext2D & {
    __fillTextEntries: FillTextEntry[];
};

function createStubContext(options: { scaleWithFont?: boolean } = {}): StubContext {
    const fillTextEntries: FillTextEntry[] = [];
    let context: Partial<OverlayContext2D> = {};
    const charWidth: Record<string, number> = {
        '0': 8,
        '1': 5,
        '2': 8,
        '3': 8,
        '4': 8,
        '5': 8,
        '6': 8,
        '7': 8,
        '8': 9,
        '9': 8,
        ':': 3,
        '.': 3,
        ' ': 4,
    };
    const measure = (text: string): number => {
        let width = 0;
        for (const char of text) {
            width += charWidth[char] ?? 7;
        }
        if (!options.scaleWithFont) return width;
        const fontSize = Number(String(context.font ?? '').match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 12);
        return width * fontSize / 12;
    };

    const ctx: Partial<OverlayContext2D> = {
        canvas: {} as HTMLCanvasElement,
        font: '',
        fillStyle: '#fff',
        strokeStyle: '#fff',
        textBaseline: 'alphabetic',
        textAlign: 'left',
        lineWidth: 1,
        shadowColor: 'transparent',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        lineCap: 'butt',
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: measure(text) } as TextMetrics)),
        strokeText: vi.fn(),
        fillText: vi.fn((text: string, x: number, y: number, maxWidth?: number) => {
            fillTextEntries.push({
                text,
                x,
                y,
                align: (ctx.textAlign ?? 'left') as CanvasTextAlign,
                font: String(ctx.font ?? ''),
                maxWidth,
                measuredWidth: measure(text),
                fontSize: Number(String(ctx.font ?? '').match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0),
                baseline: (ctx.textBaseline ?? 'alphabetic') as CanvasTextBaseline,
            });
        }),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() } as unknown as CanvasGradient)),
        translate: vi.fn(),
        rotate: vi.fn(),
    };

    context = ctx;

    return Object.assign(ctx, {
        __fillTextEntries: fillTextEntries,
    }) as StubContext;
}

const METRICS: MetricItem[] = [
    { label: 'Pace', value: '05:30', unit: 'min/km' },
    { label: 'Heart Rate', value: '150', unit: 'bpm' },
    { label: 'Distance', value: '10.2', unit: 'km' },
    { label: 'Time', value: '00:45:12', unit: '' },
];

const EXTENDED_LAYOUTS = [
    'arc-gauge',
    'hero-number',
    'cinematic-bar',
    'editorial',
    'ticker-tape',
    'whisper',
    'two-tone',
    'condensed-strip',
    'soft-rounded',
    'thin-line',
    'swiss-grid',
    'garmin-style',
    'sports-broadcast',
    'cockpit-hud',
    'terminal',
    'night-runner',
    'data-block',
    'race-tag',
    'glass-panel',
    'minimal-ring',
    'focus-type',
] as const;

const METRICS_WITHOUT_PACE: MetricItem[] = [
    { label: 'Heart Rate', value: '150', unit: 'bpm' },
    { label: 'Distance', value: '10.2', unit: 'km' },
    { label: 'Time', value: '00:45:12', unit: '' },
];

function expectTextInsideFrame(ctx: StubContext, width: number, height: number): void {
    for (const entry of ctx.__fillTextEntries) {
        const renderedWidth = Math.min(entry.measuredWidth, entry.maxWidth ?? entry.measuredWidth);
        const left = entry.align === 'right' || entry.align === 'end'
            ? entry.x - renderedWidth
            : entry.align === 'center'
                ? entry.x - renderedWidth / 2
                : entry.x;
        const top = entry.baseline === 'top'
            ? entry.y
            : entry.baseline === 'middle'
                ? entry.y - entry.fontSize / 2
                : entry.y - entry.fontSize * 0.8;
        const bottom = entry.baseline === 'top'
            ? entry.y + entry.fontSize
            : entry.baseline === 'middle'
                ? entry.y + entry.fontSize / 2
                : entry.y + entry.fontSize * 0.2;

        expect(left, `${entry.text} should stay inside the left frame edge`).toBeGreaterThanOrEqual(-0.5);
        expect(left + renderedWidth, `${entry.text} should stay inside ${width}x${height}`)
            .toBeLessThanOrEqual(width + 0.5);
        expect(top, `${entry.text} should stay inside the top frame edge`).toBeGreaterThanOrEqual(-0.5);
        expect(bottom, `${entry.text} should stay inside ${width}x${height}`)
            .toBeLessThanOrEqual(height + 0.5);
    }
}

function expectNoTextCollisions(ctx: StubContext): void {
    const boxes = ctx.__fillTextEntries.map((entry) => {
        const width = Math.min(entry.measuredWidth, entry.maxWidth ?? entry.measuredWidth);
        const left = entry.align === 'right' || entry.align === 'end'
            ? entry.x - width
            : entry.align === 'center'
                ? entry.x - width / 2
                : entry.x;
        const top = entry.baseline === 'top'
            ? entry.y
            : entry.baseline === 'middle'
                ? entry.y - entry.fontSize / 2
                : entry.y - entry.fontSize * 0.8;
        return {
            text: entry.text,
            left,
            right: left + width,
            top,
            bottom: top + entry.fontSize,
        };
    });

    for (let first = 0; first < boxes.length; first += 1) {
        for (let second = first + 1; second < boxes.length; second += 1) {
            const a = boxes[first]!;
            const b = boxes[second]!;
            const overlapsHorizontally = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5;
            const overlapsVertically = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
            expect(
                overlapsHorizontally && overlapsVertically,
                `"${a.text}" and "${b.text}" should not overlap`,
            ).toBe(false);
        }
    }
}

describe('extended layouts renderer', () => {
    it.each(EXTENDED_LAYOUTS)('renders %s without errors and draws text', (layoutMode) => {
        const ctx = createStubContext();
        const config = getTemplateConfig(layoutMode);

        expect(() => {
            renderExtendedLayout(ctx, METRICS, 1280, 720, config, layoutMode);
        }).not.toThrow();

        expect(ctx.save.mock.calls.length).toBeGreaterThan(0);
        expect(ctx.restore.mock.calls.length).toBe(ctx.save.mock.calls.length);
        expect(ctx.__fillTextEntries.length).toBeGreaterThan(0);
    });

    it('keeps Cinematic Bar typography aligned with its supported controls', () => {
        const config = getTemplateConfig('cinematic-bar');
        const template = getTemplateDefinition('cinematic-bar');
        const ctx = createStubContext();

        expect(template?.styles.typography.fontFamily).toBe(config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe('bold');
        expect(template?.styles.typography.labelFontWeight).toBe('semibold');
        expect(template?.styles.typography.labelSizeMultiplier).toBe(config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(config.labelLetterSpacing);
        expect(template?.styles.visual.textShadow).toBe(false);
        expect(template?.capabilities.supportsTextShadow).toBe(false);

        renderExtendedLayout(ctx, METRICS, 1280, 720, config, 'cinematic-bar');
        expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Barlow Semi Condensed'))).toBe(true);
        expect(ctx.__fillTextEntries.find((entry) => entry.text === '05:30')?.font).toMatch(/^700 /);
    });

    it('gives Editorial units a smaller role and uses its text contour on bright footage', () => {
        const config = getTemplateConfig('editorial');
        const template = getTemplateDefinition('editorial');
        const ctx = createStubContext({ scaleWithFont: true });

        expect(template?.styles.typography.fontFamily).toBe(config.fontFamily);
        expect(template?.styles.typography.labelFontWeight).toBe('medium');
        expect(template?.styles.spacing.lineSpacing).toBe(config.lineSpacing);
        expect(template?.capabilities.supportsAccentColor).toBe(false);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);

        renderExtendedLayout(ctx, METRICS, 1280, 720, config, 'editorial');

        const value = ctx.__fillTextEntries.find((entry) => entry.text === '150');
        const unit = ctx.__fillTextEntries.find((entry) => entry.text === 'bpm');
        expect(value).toBeDefined();
        expect(unit).toBeDefined();
        expect(unit!.fontSize).toBeLessThan(value!.fontSize);
        expect(ctx.strokeText).toHaveBeenCalled();

        const noContour = createStubContext();
        renderExtendedLayout(noContour, METRICS, 1280, 720, { ...config, textShadow: false }, 'editorial');
        expect(noContour.strokeText).not.toHaveBeenCalled();
    });

    it('fits two-tone pace and side metrics across shallow, compact, wide, and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('two-tone'),
            fontSizePercent: 3.4,
            labelSizeMultiplier: 1.2,
            valueSizeMultiplier: 3.1,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'two-tone');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('120:59');
            expect(renderedText).toContain('MIN / KM');
            expect(renderedText).toContain('199 bpm');
            expect(renderedText).toContain('12345.6 km');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).not.toContain('1999');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Barlow Semi Condensed'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);

            const pace = ctx.__fillTextEntries.find((entry) => entry.text === '120:59');
            const rightValues = ctx.__fillTextEntries.filter((entry) => entry.align === 'right');
            const rightColumnLeft = Math.min(...rightValues.map((entry) => entry.x - entry.measuredWidth));
            expect(pace).toBeDefined();
            expect(pace!.x + pace!.measuredWidth).toBeLessThanOrEqual(rightColumnLeft);
        }
    });

    it('keeps two-tone typography readable in shallow frames and aligns template metadata', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 884, 151, getTemplateConfig('two-tone'), 'two-tone');

        const template = getTemplateDefinition('two-tone');
        const sideValues = ctx.__fillTextEntries.filter((entry) =>
            ['150', '10.2', '00:45:12'].includes(entry.text),
        );
        const sideUnits = ctx.__fillTextEntries.filter((entry) => [' bpm', ' km'].includes(entry.text));
        expect(Math.min(...sideValues.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(12);
        expect(Math.max(...sideUnits.map((entry) => entry.fontSize)))
            .toBeLessThan(Math.min(...sideValues.map((entry) => entry.fontSize)));
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time']);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadowBlur).toBe(template?.config.textShadowBlur);
        expectTextInsideFrame(ctx, 884, 151);
    });

    it('keeps Two Tone values, labels, and units legible across frame sizes and aggressive controls', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const configs = [
            getTemplateConfig('two-tone'),
            {
                ...getTemplateConfig('two-tone'),
                fontSizePercent: 3.4,
                valueSizeMultiplier: 3.1,
                labelSizeMultiplier: 1.2,
                labelLetterSpacing: 0.18,
                textShadowBlur: 80,
            },
        ];

        for (const config of configs) {
            for (const [width, height] of sizes) {
                const ctx = createStubContext({ scaleWithFont: true });
                renderExtendedLayout(ctx, metrics, width, height, config, 'two-tone');

                const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
                expect(renderedText, `${width}x${height}`).toContain('120:59');
                expect(renderedText).toContain('199 bpm');
                expect(renderedText).toContain('12345.6 km');
                expect(renderedText).toContain('123:59:59');
                expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Barlow Semi Condensed'))).toBe(true);
                expect(ctx.shadowBlur).toBe(config.textShadow ? Math.min(config.textShadowBlur ?? 2, 4) : 0);
                expect(ctx.strokeText).toHaveBeenCalled();
                expectTextInsideFrame(ctx, width, height);
                expectNoTextCollisions(ctx);

                const values = ctx.__fillTextEntries.filter((entry) =>
                    ['120:59', '199', '12345.6', '123:59:59'].includes(entry.text),
                );
                const units = ctx.__fillTextEntries.filter((entry) => [' min/km', ' bpm', ' km'].includes(entry.text));
                expect(Math.max(...units.map((entry) => entry.fontSize)))
                    .toBeLessThan(Math.min(...values.map((entry) => entry.fontSize)));
            }
        }
    });

    it('keeps two-tone units visible when labels are hidden', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('two-tone'),
            labelStyle: 'hidden',
        }, 'two-tone');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('HEART RATE');
        expect(renderedText).not.toContain('DISTANCE');
        expect(renderedText).not.toContain('TIME');
        expect(renderedText).toContain('MIN / KM');
        expect(renderedText).toContain('150 bpm');
        expectTextInsideFrame(ctx, 320, 180);
    });

    it('fits condensed-strip labels and long values inside every compact segment', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('condensed-strip'),
            fontSizePercent: 3.5,
            labelSizeMultiplier: 1.2,
            valueSizeMultiplier: 3.1,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'condensed-strip');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText, `${width}x${height}`).toContain('PACE · MIN/KM');
            expect(renderedText).toContain('HR · BPM');
            expect(renderedText).toContain('DIST · KM');
            expect(renderedText).toContain('120:59');
            expect(renderedText).toContain('199');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).not.toContain('1999');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Barlow Semi Condensed'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);

            const labels = ctx.__fillTextEntries.filter((entry) => entry.align === 'left');
            const drawnValues = ctx.__fillTextEntries.filter((entry) => entry.align === 'center');
            expect(Math.max(...labels.map((entry) => entry.fontSize)))
                .toBeLessThan(Math.min(...drawnValues.map((entry) => entry.fontSize)));

            const values = ctx.__fillTextEntries.filter((entry) =>
                ['120:59', '199', '12345.6', '123:59:59'].includes(entry.text),
            ).sort((first, second) => first.x - second.x);
            expect(values).toHaveLength(4);
            for (let index = 0; index < values.length - 1; index += 1) {
                const current = values[index]!;
                const next = values[index + 1]!;
                const currentRight = current.x + Math.min(current.measuredWidth, current.maxWidth ?? current.measuredWidth) / 2;
                const nextLeft = next.x - Math.min(next.measuredWidth, next.maxWidth ?? next.measuredWidth) / 2;
                expect(currentRight).toBeLessThanOrEqual(nextLeft);
            }
        }
    });

    it('keeps condensed-strip value sizing stable across normal and maximum telemetry', () => {
        const maximums: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;

        for (const [width, height] of sizes) {
            const frames = [METRICS, maximums].map((metrics) => {
                const ctx = createStubContext({ scaleWithFont: true });
                renderExtendedLayout(ctx, metrics, width, height, getTemplateConfig('condensed-strip'), 'condensed-strip');
                expectTextInsideFrame(ctx, width, height);
                expectNoTextCollisions(ctx);
                return ctx.__fillTextEntries
                    .filter((entry) => entry.align === 'center')
                    .map((entry) => entry.fontSize);
            });

            expect(frames[0]).toHaveLength(4);
            expect(frames[1]).toEqual(frames[0]);
        }
    });

    it('keeps condensed-strip capabilities and typography metadata aligned', () => {
        const template = getTemplateDefinition('condensed-strip');
        expect(template?.config.fontFamily).toBe(TRAIL_RUN_FONT_FAMILY);
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.capabilities.supportsTextShadow).toBe(false);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.labelFontWeight).toBe('medium');
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(template?.config.textShadow);
    });

    it('keeps condensed-strip values readable in shallow and compact frames by default', () => {
        for (const [width, height] of [[884, 151], [320, 180]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('condensed-strip'), 'condensed-strip');

            const valueEntries = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            const labelEntries = ctx.__fillTextEntries.filter((entry) => entry.align === 'left');
            expect(Math.min(...valueEntries.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(12);
            expect(Math.min(...labelEntries.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(7);
            expectTextInsideFrame(ctx, width, height);
        }
    });

    it('keeps condensed-strip values visible when labels are hidden', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('condensed-strip'),
            labelStyle: 'hidden',
        }, 'condensed-strip');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('PACE');
        expect(renderedText).not.toContain('DIST');
        expect(renderedText).toContain('05:30 min/km');
        expect(renderedText).toContain('10.2 km');
        expectTextInsideFrame(ctx, 320, 180);
    });

    it('keeps condensed-strip segments clear as metrics are toggled off', () => {
        const metricSets = [METRICS.slice(0, 1), METRICS.slice(0, 2), METRICS.slice(0, 3), METRICS];
        const sizes = [[884, 151], [320, 180], [320, 568]] as const;

        for (const [width, height] of sizes) {
            for (const metrics of metricSets) {
                const ctx = createStubContext({ scaleWithFont: true });
                renderExtendedLayout(
                    ctx,
                    metrics,
                    width,
                    height,
                    getTemplateConfig('condensed-strip'),
                    'condensed-strip',
                );

                expect(ctx.__fillTextEntries).not.toHaveLength(0);
                expectTextInsideFrame(ctx, width, height);
                expectNoTextCollisions(ctx);
            }
        }
    });

    it('fits soft-rounded cards and long metric values across compact and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('soft-rounded'),
            fontSizePercent: 3.5,
            labelSizeMultiplier: 1.2,
            valueSizeMultiplier: 3.1,
            labelLetterSpacing: 0.18,
            cornerRadius: 128,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'soft-rounded');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('PACE');
            expect(renderedText).toContain('HEART RATE');
            expect(renderedText).toContain('DISTANCE');
            expect(renderedText).toContain('TIME');
            expect(renderedText).toContain('120:59');
            expect(renderedText).toContain('min/km');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).not.toContain('1999');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Barlow Semi Condensed'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);

            const values = ctx.__fillTextEntries.filter((entry) =>
                ['120:59', '199', '12345.6', '123:59:59'].includes(entry.text),
            ).sort((first, second) => first.x - second.x);
            expect(values).toHaveLength(4);
            const supportingText = ctx.__fillTextEntries.filter((entry) => entry.font.startsWith('500 '));
            expect(supportingText.length).toBeGreaterThan(0);
            expect(Math.max(...supportingText.map((entry) => entry.fontSize)))
                .toBeLessThan(Math.min(...values.map((entry) => entry.fontSize)));
            for (let index = 0; index < values.length - 1; index += 1) {
                const current = values[index]!;
                const next = values[index + 1]!;
                const currentRight = current.x + Math.min(current.measuredWidth, current.maxWidth ?? current.measuredWidth) / 2;
                const nextLeft = next.x - Math.min(next.measuredWidth, next.maxWidth ?? next.measuredWidth) / 2;
                expect(currentRight).toBeLessThanOrEqual(nextLeft);
            }
        }
    });

    it('keeps soft-rounded values readable in shallow frames and metadata consistent', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 884, 151, getTemplateConfig('soft-rounded'), 'soft-rounded');

        const template = getTemplateDefinition('soft-rounded');
        const values = ctx.__fillTextEntries.filter((entry) =>
            ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
        );
        expect(Math.min(...values.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(16);
        const supportingText = ctx.__fillTextEntries.filter((entry) => entry.font.startsWith('500 '));
        expect(supportingText.length).toBeGreaterThan(0);
        expect(Math.min(...supportingText.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(10);
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.config.fontFamily).toBe(TRAIL_RUN_FONT_FAMILY);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.labelFontWeight).toBe('medium');
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.cornerRadius).toBe(template?.config.cornerRadius);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expectTextInsideFrame(ctx, 884, 151);
    });

    it('keeps soft-rounded value sizing stable across normal and maximum telemetry', () => {
        const maximums: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;

        for (const [width, height] of sizes) {
            const frames = [METRICS, maximums].map((metrics) => {
                const ctx = createStubContext({ scaleWithFont: true });
                renderExtendedLayout(ctx, metrics, width, height, getTemplateConfig('soft-rounded'), 'soft-rounded');
                expectTextInsideFrame(ctx, width, height);
                expectNoTextCollisions(ctx);
                return ctx.__fillTextEntries
                    .filter((entry) => entry.align === 'center' && ['05:30', '150', '10.2', '00:45:12', '120:59', '199', '12345.6', '123:59:59'].includes(entry.text))
                    .map((entry) => entry.fontSize);
            });

            expect(frames[0]).toHaveLength(4);
            expect(frames[1]).toEqual(frames[0]);
        }
    });

    it('keeps soft-rounded units visible when labels are hidden', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('soft-rounded'),
            labelStyle: 'hidden',
        }, 'soft-rounded');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('PACE');
        expect(renderedText).not.toContain('DISTANCE');
        expect(renderedText).toContain('min/km');
        expect(renderedText).toContain('05:30');
        expectTextInsideFrame(ctx, 320, 180);
    });

    it('fits glass-panel metrics and typography in compact, wide, and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('glass-panel'),
            fontSizePercent: 3.4,
            labelSizeMultiplier: 1.2,
            valueSizeMultiplier: 3.1,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'glass-panel');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText, `${width}x${height}`).toContain('PACE');
            expect(renderedText).toContain('HR');
            expect(renderedText).toContain('DISTANCE');
            expect(renderedText).toContain('ELAPSED');
            expect(renderedText).toContain('POWER');
            expect(renderedText).toContain('120:59');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).toContain('1999');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Inter'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
            expect(ctx.createLinearGradient).not.toHaveBeenCalled();
            expect(ctx.fillRect).not.toHaveBeenCalled();
        }
    });

    it('keeps glass-panel labels optional and its style metadata aligned with the renderer', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('glass-panel'),
            labelStyle: 'hidden',
        }, 'glass-panel');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('PACE');
        expect(renderedText).not.toContain('DISTANCE');
        expect(renderedText).toContain('05:30');
        expect(renderedText).toContain('MIN/KM');
        expect(renderedText).toContain('10.2');
        expectTextInsideFrame(ctx, 320, 180);

        const template = getTemplateDefinition('glass-panel');
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(true);
        expect(template?.capabilities.supportsBorder).toBe(true);
        expect(template?.capabilities.supportsTextShadow).toBe(false);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.cornerRadius).toBe(template?.config.cornerRadius);
        expect(template?.styles.visual.borderWidth).toBe(template?.config.borderWidth);
        expect(template?.styles.visual.textShadow).toBe(false);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
    });

    it('fits minimal-ring pace and supporting metrics across compact and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('minimal-ring'),
            fontSizePercent: 3.4,
            labelSizeMultiplier: 1.1,
            valueSizeMultiplier: 3.1,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'minimal-ring');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText, `${width}x${height}`).toContain('120:59');
            expect(renderedText).toContain('MIN/KM');
            expect(renderedText).toContain('HR');
            expect(renderedText).toContain('BPM');
            expect(renderedText).toContain('DISTANCE');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('1999');
            expect(renderedText).toContain('POWER');
            expect(renderedText).not.toContain('123:59:59');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Inter'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
            expect(ctx.createLinearGradient).not.toHaveBeenCalled();
            expect(ctx.fillRect).not.toHaveBeenCalled();
        }
    });

    it('keeps minimal-ring units when labels are hidden and style metadata aligned', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('minimal-ring'),
            labelStyle: 'hidden',
        }, 'minimal-ring');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('DISTANCE');
        expect(renderedText).not.toContain('HR');
        expect(renderedText).toContain('MIN/KM');
        expect(renderedText).toContain('BPM');
        expect(renderedText).toContain('KM');
        expectTextInsideFrame(ctx, 320, 180);

        const template = getTemplateDefinition('minimal-ring');
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'power']);
        expect(template?.capabilities.requiredMetrics).toEqual(['pace']);
        expect(template?.capabilities.supportsAccentColor).toBe(true);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(false);
    });

    it('shows available minimal-ring metrics when the current frame has no pace sample', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        const metrics: MetricItem[] = [
            { label: 'Heart Rate', value: '150', unit: 'bpm' },
            { label: 'Distance', value: '10.2', unit: 'km' },
            { label: 'Power', value: '240', unit: 'W' },
        ];
        renderExtendedLayout(ctx, metrics, 320, 180, getTemplateConfig('minimal-ring'), 'minimal-ring');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).toContain('150');
        expect(renderedText).toContain('10.2');
        expect(renderedText).toContain('240');
        expect(renderedText).toContain('BPM');
        expect(renderedText).toContain('KM');
        expect(renderedText).toContain('W');
        expect(renderedText).not.toContain('MIN/KM');
        expectTextInsideFrame(ctx, 320, 180);
        expectNoTextCollisions(ctx);
        expect(vi.mocked(ctx.arc)).not.toHaveBeenCalled();
    });

    it('fits focus-type pace and all supported metrics across compact and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('focus-type'),
            fontSizePercent: 3.4,
            labelSizeMultiplier: 1.1,
            valueSizeMultiplier: 3.1,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'focus-type');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText, `${width}x${height}`).toContain('120:59');
            expect(renderedText).toContain('MIN/KM');
            expect(renderedText).toContain('HR');
            expect(renderedText).toContain('BPM');
            expect(renderedText).toContain('DISTANCE');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('ELAPSED');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).toContain('POWER');
            expect(renderedText).toContain('1999');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Inter'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
            expect(ctx.createLinearGradient).not.toHaveBeenCalled();
            expect(ctx.fillRect).not.toHaveBeenCalled();
        }
    });

    it('keeps focus-type units visible when labels are hidden and falls back without pace', () => {
        const metrics: MetricItem[] = [
            { label: 'Heart Rate', value: '150', unit: 'bpm' },
            { label: 'Distance', value: '10.2', unit: 'km' },
            { label: 'Time', value: '00:45:12', unit: '' },
            { label: 'Power', value: '240', unit: 'W' },
        ];
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, metrics, 320, 180, {
            ...getTemplateConfig('focus-type'),
            labelStyle: 'hidden',
        }, 'focus-type');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('DISTANCE');
        expect(renderedText).not.toContain('ELAPSED');
        expect(renderedText).toContain('150');
        expect(renderedText).toContain('BPM');
        expect(renderedText).toContain('10.2');
        expect(renderedText).toContain('00:45:12');
        expect(renderedText).toContain('240');
        expect(renderedText).toContain('W');
        expectTextInsideFrame(ctx, 320, 180);
        expectNoTextCollisions(ctx);

        const template = getTemplateDefinition('focus-type');
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsTextShadow).toBe(false);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.textShadow).toBe(false);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
    });

    it('keeps cinematic-bar labels and long metric values inside compact and wide frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[320, 568], [320, 180], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('cinematic-bar'),
            fontSizePercent: 3.4,
            labelSizeMultiplier: 1.3,
            valueSizeMultiplier: 1.3,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext();
            renderExtendedLayout(ctx, metrics, width, height, config, 'cinematic-bar');

            const longValueEntries = ctx.__fillTextEntries.filter((entry) =>
                ['120:59', '199', '12345.6', '123:59:59', '1999'].includes(entry.text),
            );
            expect(longValueEntries).toHaveLength(5);
            expect(longValueEntries.every((entry) =>
                entry.maxWidth !== undefined
                    && entry.maxWidth > 0
                    && entry.x >= 0
                    && entry.x <= width
                    && entry.y >= 0
                    && entry.y < height,
            )).toBe(true);
            expect(ctx.__fillTextEntries.some((entry) => entry.text === 'W')).toBe(true);
        }
    });

    it('keeps editorial typography inside the frame across aspect ratios and large settings', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('editorial'),
            fontSizePercent: 3.5,
            labelSizeMultiplier: 1.2,
            valueSizeMultiplier: 3.1,
            labelLetterSpacing: 0.24,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext();
            renderExtendedLayout(ctx, metrics, width, height, config, 'editorial');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('120:59');
            expect(renderedText).toContain('199');
            expect(renderedText).toContain('bpm');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('km');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).toContain('1999');
            expect(renderedText).toContain('W');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Georgia'))).toBe(true);
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Inter'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
        }
    });

    it('respects hidden editorial labels and keeps units visible', () => {
        const ctx = createStubContext();
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('editorial'),
            labelStyle: 'hidden',
        }, 'editorial');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('PACE');
        expect(renderedText).not.toContain('HEART RATE');
        expect(renderedText).not.toContain('DISTANCE');
        expect(renderedText).not.toContain('ELAPSED');
        expect(renderedText).toContain('min/km');
        expectTextInsideFrame(ctx, 320, 180);
    });

    it('keeps the editorial side stats readable in a shallow preview frame', () => {
        const ctx = createStubContext();
        renderExtendedLayout(ctx, METRICS, 884, 151, getTemplateConfig('editorial'), 'editorial');

        const sideValue = ctx.__fillTextEntries.find((entry) => entry.text === '150');
        const unit = ctx.__fillTextEntries.find((entry) => entry.text === 'bpm');
        const labelSizes = ctx.__fillTextEntries
            .filter((entry) => entry.font.includes('Inter'))
            .map((entry) => entry.fontSize);
        expect(sideValue?.fontSize).toBeGreaterThanOrEqual(11);
        expect(unit?.fontSize).toBeLessThan(sideValue?.fontSize ?? 0);
        expect(Math.min(...labelSizes)).toBeGreaterThanOrEqual(8);
        expectTextInsideFrame(ctx, 884, 151);
    });

    it('advertises only metrics rendered by the editorial overlay', () => {
        const template = getTemplateDefinition('editorial');
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
    });

    it('fits ticker-tape metrics and typography across shallow, compact, wide, and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('ticker-tape'),
            fontSizePercent: 3.2,
            valueSizeMultiplier: 1.3,
            labelSizeMultiplier: 1.1,
            labelLetterSpacing: 0.16,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'ticker-tape');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('LIVE');
            expect(renderedText).toContain('120:59');
            expect(renderedText).toContain('199');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).toContain('1999');
            expect(renderedText).toContain('W');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes(TRAIL_RUN_FONT_FAMILY))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
        }
    });

    it('keeps ticker-tape capabilities and typography metadata aligned with its rendered content', () => {
        const template = getTemplateDefinition('ticker-tape');
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
    });

    it('keeps ticker labels secondary when the size controls are pushed to their limit', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        const config = {
            ...getTemplateConfig('ticker-tape'),
            fontSizePercent: 5,
            valueSizeMultiplier: 3,
            labelSizeMultiplier: 1.4,
        };
        const metrics: MetricItem[] = [{ label: 'Pace', value: '120:59', unit: 'min/km' }];

        renderExtendedLayout(ctx, metrics, 320, 180, config, 'ticker-tape');

        const label = ctx.__fillTextEntries.find((entry) => entry.text === 'P');
        const value = ctx.__fillTextEntries.find((entry) => entry.text === '120:59');
        expect(label).toBeDefined();
        expect(value).toBeDefined();
        expect(label!.fontSize).toBeLessThan(value!.fontSize);
        expectTextInsideFrame(ctx, 320, 180);
    });

    it('keeps whisper labels and long telemetry inside shallow, compact, wide, and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('whisper'),
            fontSizePercent: 3.2,
            valueSizeMultiplier: 1.3,
            labelSizeMultiplier: 1.1,
            labelLetterSpacing: 0.16,
            textShadowBlur: 100,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'whisper');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('PACE');
            expect(renderedText).toContain('120:59 min/km');
            expect(renderedText).toContain('199 bpm');
            expect(renderedText).toContain('12345.6 km');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).toContain('1999 W');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Barlow Semi Condensed'))).toBe(true);
            const labels = ctx.__fillTextEntries.filter((entry) => ['P', 'A', 'C', 'E'].includes(entry.text));
            const values = ctx.__fillTextEntries.filter((entry) => ['120:59', '199', '12345.6', '123:59:59', '1999'].includes(entry.text));
            expect(Math.max(...labels.map((entry) => entry.fontSize)))
                .toBeLessThan(Math.min(...values.map((entry) => entry.fontSize)));
            expect(ctx.fillRect).not.toHaveBeenCalled();
            expect(ctx.shadowBlur).toBe(4);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
        }
    });

    it('keeps whisper capabilities and typography metadata aligned with the rendered overlay', () => {
        const template = getTemplateDefinition('whisper');
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(template?.config.textShadow);
        expect(template?.styles.visual.textShadowBlur).toBe(template?.config.textShadowBlur);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
    });

    it('keeps whisper values readable in a shallow frame at its default settings', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '05:30', unit: 'min/km' },
            { label: 'Heart Rate', value: '150', unit: 'bpm' },
            { label: 'Distance', value: '10.2', unit: 'km' },
            { label: 'Time', value: '00:45:12', unit: '' },
            { label: 'Power', value: '255', unit: 'W' },
        ];

        renderExtendedLayout(ctx, metrics, 884, 151, getTemplateConfig('whisper'), 'whisper');

        const valueEntries = ctx.__fillTextEntries.filter((entry) =>
            ['05:30', '150', '10.2', '00:45:12', '255'].includes(entry.text),
        );
        const unitEntries = ctx.__fillTextEntries.filter((entry) =>
            [' min/km', ' bpm', ' km', ' W'].includes(entry.text),
        );
        const labelEntries = ctx.__fillTextEntries.filter((entry) =>
            ['PACE', 'HEART RATE', 'DISTANCE', 'TIME', 'POWER'].includes(entry.text),
        );

        expect(valueEntries).toHaveLength(5);
        expect(unitEntries).toHaveLength(4);
        expect(Math.max(...unitEntries.map((entry) => entry.fontSize)))
            .toBeLessThan(Math.min(...valueEntries.map((entry) => entry.fontSize)));
        expect(Math.min(...valueEntries.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(12);
        expect(Math.min(...labelEntries.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(7);
        expectTextInsideFrame(ctx, 884, 151);
    });

    it('keeps Whisper font sizing steady across normal and maximum-width telemetry', () => {
        const maximums: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const frames = [
            [...METRICS, { label: 'Power', value: '255', unit: 'W' }],
            maximums,
        ];
        const valueSizes = frames.map((metrics) => {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, 320, 180, getTemplateConfig('whisper'), 'whisper');
            return Math.min(...ctx.__fillTextEntries
                .filter((entry) => entry.align === 'right' && !entry.text.startsWith(' '))
                .map((entry) => entry.fontSize));
        });

        expect(valueSizes[0]).toBeGreaterThan(0);
        expect(valueSizes[1]).toBe(valueSizes[0]);
    });

    it('honors hidden whisper labels without shifting values beyond the corner safe area', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('whisper'),
            labelStyle: 'hidden',
        }, 'whisper');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('PACE');
        expect(renderedText).not.toContain('HEART RATE');
        expect(renderedText).not.toContain('DISTANCE');
        expect(renderedText).toContain('05:30 min/km');
        expectTextInsideFrame(ctx, 320, 180);
    });

    it('keeps Swiss Grid labels, values, and units aligned on a symmetric grid', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        const width = 1280;
        const height = 720;
        renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('swiss-grid'), 'swiss-grid');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).toContain('PACE');
        expect(renderedText).toContain('HEART RATE');
        expect(renderedText).toContain('DISTANCE');
        expect(renderedText).toContain('TIME');

        const valueTexts = ['05:30', '150', '10.2', '00:45:12'];
        const unitTexts = ['min/km', 'bpm', 'km'];
        const values = valueTexts.map((value) => ctx.__fillTextEntries.find((entry) => entry.text === value));
        const units = unitTexts.map((unit) => ctx.__fillTextEntries.find((entry) => entry.text === unit));
        expect(values.every(Boolean)).toBe(true);
        expect(units.every(Boolean)).toBe(true);
        expect(values.every((entry) => entry!.align === 'center')).toBe(true);
        expect(units.every((entry) => entry!.align === 'center')).toBe(true);

        const sidePad = Math.min(width, height) * 0.03;
        const leftInset = values[0]!.x - sidePad;
        const rightInset = (width - sidePad) - values[3]!.x;
        expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(1);
        const firstLabel = ctx.__fillTextEntries.find((entry) => entry.text === 'P');
        expect(firstLabel).toBeDefined();
        expect(firstLabel!.y).toBeLessThan(values[0]!.y);
        expect(values[0]!.y).toBeLessThan(units[0]!.y);
        expectTextInsideFrame(ctx, width, height);
    });

    it('fits Swiss Grid long values and typography across shallow, compact, wide, and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('swiss-grid'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 2.5,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'swiss-grid');
            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('120:59');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).toContain('min/km');
            expect(renderedText).not.toContain('1999');
            expectTextInsideFrame(ctx, width, height);

            const valueTexts = ['120:59', '199', '12345.6', '123:59:59'];
            const values = valueTexts.map((value) => ctx.__fillTextEntries.find((entry) => entry.text === value));
            expect(values.every(Boolean)).toBe(true);
            const labelSizes = ctx.__fillTextEntries
                .filter((entry) => /^[A-Z]$/.test(entry.text))
                .map((entry) => entry.fontSize);
            const unitSizes = ctx.__fillTextEntries
                .filter((entry) => ['min/km', 'bpm', 'km'].includes(entry.text))
                .map((entry) => entry.fontSize);
            expect(Math.max(...labelSizes)).toBeLessThan(Math.min(...values.map((entry) => entry!.fontSize)));
            expect(Math.max(...unitSizes)).toBeLessThan(Math.min(...values.map((entry) => entry!.fontSize)));
            for (let index = 0; index < values.length; index += 1) {
                const entry = values[index]!;
                const cellWidth = (width - Math.min(width, height) * (height > width ? 0.08 : 0.06)) / 4;
                const sidePad = Math.min(width, height) * (height > width ? 0.04 : 0.03);
                const cellCenter = sidePad + cellWidth * (index + 0.5);
                expect(Math.abs(entry!.x - cellCenter)).toBeLessThanOrEqual(0.01);
            }
        }
    });

    it('keeps Swiss Grid text readable in shallow frames and aligns template metadata', () => {
        const template = getTemplateDefinition('swiss-grid');
        for (const [width, height] of [[884, 151], [320, 180]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('swiss-grid'), 'swiss-grid');
            const values = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            expect(values).toHaveLength(4);
            expect(Math.min(...values.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(12);
            expectTextInsideFrame(ctx, width, height);
        }

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.capabilities.supportsTextShadow).toBe(true);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.config.fontFamily).toBe(TRAIL_RUN_FONT_FAMILY);
        expect(template?.styles.typography.labelFontWeight).toBe('medium');
        expect(template?.config.backgroundOpacity).toBe(0);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(template?.config.textShadow);
        expect(template?.styles.visual.textShadowBlur).toBe(template?.config.textShadowBlur);
    });

    it('keeps Swiss Grid transparent while units remain visible without labels', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('swiss-grid'),
            labelStyle: 'hidden',
            backgroundOpacity: 1,
        }, 'swiss-grid');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('PACE');
        expect(renderedText).not.toContain('DISTANCE');
        expect(renderedText).toContain('min/km');
        expect(renderedText).toContain('bpm');
        expect(renderedText).toContain('05:30');
        expect(ctx.fillRect).not.toHaveBeenCalled();
        expectTextInsideFrame(ctx, 320, 180);
    });

    it('keeps stable font sizing in ticker-tape and condensed-strip for different metric glyph widths', () => {
        const narrowMetrics: MetricItem[] = [
            { label: 'Pace', value: '01:11', unit: 'min/km' },
            { label: 'Heart Rate', value: '111', unit: 'bpm' },
            { label: 'Distance', value: '11.1', unit: 'km' },
            { label: 'Time', value: '01:11:11', unit: '' },
        ];
        const wideMetrics: MetricItem[] = [
            { label: 'Pace', value: '08:88', unit: 'min/km' },
            { label: 'Heart Rate', value: '188', unit: 'bpm' },
            { label: 'Distance', value: '88.8', unit: 'km' },
            { label: 'Time', value: '08:88:88', unit: '' },
        ];

        const tickerConfig = getTemplateConfig('ticker-tape');
        const tickerTemplate = getTemplateDefinition('ticker-tape');
        expect(tickerConfig.fontFamily).toBe(TRAIL_RUN_FONT_FAMILY);
        expect(tickerTemplate?.styles.typography.fontFamily).toBe(TRAIL_RUN_FONT_FAMILY);
        const narrowTickerCtx = createStubContext();
        const wideTickerCtx = createStubContext();

        renderExtendedLayout(narrowTickerCtx, narrowMetrics, 1280, 720, tickerConfig, 'ticker-tape');
        renderExtendedLayout(wideTickerCtx, wideMetrics, 1280, 720, tickerConfig, 'ticker-tape');

        const narrowTickerEntry = narrowTickerCtx.__fillTextEntries
            .find((entry) => entry.text === '01:11');
        const wideTickerEntry = wideTickerCtx.__fillTextEntries
            .find((entry) => entry.text === '08:88');

        expect(narrowTickerEntry).toBeDefined();
        expect(wideTickerEntry).toBeDefined();
        expect(narrowTickerEntry?.font).toBe(wideTickerEntry?.font);

        const stripConfig = getTemplateConfig('condensed-strip');
        const narrowStripCtx = createStubContext();
        const wideStripCtx = createStubContext();

        renderExtendedLayout(narrowStripCtx, narrowMetrics, 1280, 720, stripConfig, 'condensed-strip');
        renderExtendedLayout(wideStripCtx, wideMetrics, 1280, 720, stripConfig, 'condensed-strip');

        const narrowPaceDraw = narrowStripCtx.__fillTextEntries
            .find((entry) => entry.text === '01:11');
        const widePaceDraw = wideStripCtx.__fillTextEntries
            .find((entry) => entry.text === '08:88');

        expect(narrowPaceDraw).toBeDefined();
        expect(widePaceDraw).toBeDefined();
        expect(narrowPaceDraw?.font).toBe(widePaceDraw?.font);
    });

    it('focus-type still renders secondary metrics when pace is disabled', () => {
        const ctx = createStubContext();
        const config = getTemplateConfig('focus-type');

        expect(() => {
            renderExtendedLayout(ctx, METRICS_WITHOUT_PACE, 1280, 720, config, 'focus-type');
        }).not.toThrow();

        expect(ctx.__fillTextEntries.some((entry) => entry.text.includes('150'))).toBe(true);
        expect(ctx.__fillTextEntries.some((entry) => entry.text.includes('10.2'))).toBe(true);
        expect(ctx.__fillTextEntries.some((entry) => entry.text.includes('00:45:12'))).toBe(true);
    });

    it('fits thin-line values and units across shallow, compact, wide, and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('thin-line'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 2.6,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
            labelStyle: 'uppercase' as const,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'thin-line');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('PACE');
            expect(renderedText).toContain('HR');
            expect(renderedText).toContain('DIST');
            expect(renderedText).toContain('TIME');
            expect(renderedText).toContain('120:59');
            expect(renderedText).toContain('min/km');
            expect(renderedText).toContain('12345.6');
            expect(renderedText).toContain('123:59:59');
            expect(renderedText).not.toContain('1999');
            expectTextInsideFrame(ctx, width, height);

            const safePad = Math.min(width, height) * (height > width ? 0.04 : 0.03);
            const cellWidth = (width - safePad * 2) / 4;
            const valueTexts = ['120:59', '199', '12345.6', '123:59:59'];
            for (let index = 0; index < valueTexts.length; index += 1) {
                const entry = ctx.__fillTextEntries.find((candidate) => candidate.text === valueTexts[index]);
                expect(entry).toBeDefined();
                const drawLeft = entry!.align === 'center' ? entry!.x - entry!.measuredWidth / 2 : entry!.x;
                const drawRight = drawLeft + Math.min(entry!.measuredWidth, entry!.maxWidth ?? entry!.measuredWidth);
                const cellLeft = safePad + cellWidth * index;
                expect(drawLeft).toBeGreaterThanOrEqual(cellLeft - 1);
                expect(drawRight).toBeLessThanOrEqual(cellLeft + cellWidth + 1);
            }
        }
    });

    it('keeps thin-line values readable by default and aligns template capabilities', () => {
        const template = getTemplateDefinition('thin-line');
        for (const [width, height] of [[884, 151], [320, 180]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('thin-line'), 'thin-line');
            const values = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            expect(values).toHaveLength(4);
            expect(Math.min(...values.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(12);
            expectTextInsideFrame(ctx, width, height);
            expect(ctx.strokeText).toHaveBeenCalled();
        }

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.capabilities.supportsTextShadow).toBe(true);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.config.fontFamily).toBe(TRAIL_RUN_FONT_FAMILY);
        expect(template?.config.valueFontWeight).toBe('bold');
        expect(template?.styles.typography.labelFontWeight).toBe('medium');
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(template?.config.textShadow);
        expect(template?.styles.visual.textShadowBlur).toBe(template?.config.textShadowBlur);

        const shadowOffContext = createStubContext();
        renderExtendedLayout(shadowOffContext, METRICS, 884, 151, {
            ...getTemplateConfig('thin-line'),
            textShadow: false,
        }, 'thin-line');
        expect(shadowOffContext.strokeText).not.toHaveBeenCalled();
    });

    it('keeps thin-line units visible when labels are hidden', () => {
        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 180, {
            ...getTemplateConfig('thin-line'),
            labelStyle: 'hidden',
        }, 'thin-line');

        const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
        expect(renderedText).not.toContain('PACE');
        expect(renderedText).not.toContain('DIST');
        expect(renderedText).toContain('min/km');
        expect(renderedText).toContain('bpm');
        expect(renderedText).toContain('05:30');
        expectTextInsideFrame(ctx, 320, 180);
    });

    it('fits Garmin metrics and the heart-rate dial across aspect ratios and long values', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('garmin-style'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 3.1,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'garmin-style');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            for (const value of ['120:59', '199', '12345.6', '123:59:59', '1999']) {
                expect(ctx.__fillTextEntries.some((entry) => entry.text === value), `${value} at ${width}x${height}`).toBe(true);
            }
            expect(renderedText).toContain('min/km');
            expect(renderedText).toContain('km');
            expect(renderedText).toContain('W');
            expect(renderedText).toContain('bpm');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Barlow Semi Condensed'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
        }
    });

    it('keeps Garmin labels separate from values and honors its typography and capability metadata', () => {
        const template = getTemplateDefinition('garmin-style');
        for (const [width, height] of [[884, 151], [320, 180]] as const) {
            const defaultContext = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(defaultContext, METRICS, width, height, getTemplateConfig('garmin-style'), 'garmin-style');
            const defaultValues = defaultContext.__fillTextEntries.filter((entry) =>
                ['05:30', '10.2', '00:45:12'].includes(entry.text),
            );
            const defaultLabels = defaultContext.__fillTextEntries.filter((entry) =>
                ['P', 'A', 'C', 'E', 'D', 'I', 'S', 'T'].includes(entry.text),
            );
            expect(defaultValues).toHaveLength(3);
            expect(Math.min(...defaultValues.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(12);
            expect(defaultLabels.length).toBeGreaterThan(0);
            expect(Math.min(...defaultLabels.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(7);
            expect(defaultContext.arc).toHaveBeenCalled();
            expectTextInsideFrame(defaultContext, width, height);
        }

        const ctx = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(ctx, METRICS, 320, 568, getTemplateConfig('garmin-style'), 'garmin-style');

        const labelEntries = ctx.__fillTextEntries.filter((entry) => ['P', 'A', 'C', 'E', 'D', 'I', 'S', 'T'].includes(entry.text));
        const timeValue = ctx.__fillTextEntries.find((entry) => entry.text === '00:45:12');
        const minKmUnit = ctx.__fillTextEntries.find((entry) => entry.text === 'min/km');
        expect(labelEntries.length).toBeGreaterThan(0);
        expect(timeValue).toBeDefined();
        expect(minKmUnit).toBeDefined();
        expectTextInsideFrame(ctx, 320, 568);

        const hiddenLabels = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(hiddenLabels, METRICS, 320, 180, {
            ...getTemplateConfig('garmin-style'),
            labelStyle: 'hidden',
        }, 'garmin-style');
        const hiddenText = hiddenLabels.__fillTextEntries.map((entry) => entry.text).join('');
        expect(hiddenText).not.toContain('PACE');
        expect(hiddenText).toContain('min/km');
        expect(hiddenText).toContain('bpm');
        expectTextInsideFrame(hiddenLabels, 320, 180);

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.capabilities.supportsTextShadow).toBe(true);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(template?.config.textShadow);
        expect(template?.styles.visual.textShadowBlur).toBe(template?.config.textShadowBlur);
    });

    it('fits Sports Broadcast metrics, including power, across compact and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('sports-broadcast'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 3.1,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'sports-broadcast');

            for (const value of ['120:59', '199', '12345.6', '123:59:59', '1999']) {
                expect(ctx.__fillTextEntries.some((entry) => entry.text === value), `${value} at ${width}x${height}`).toBe(true);
            }
            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('min/km');
            expect(renderedText).toContain('bpm');
            expect(renderedText).toContain('km');
            expect(renderedText).toContain('W');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Inter'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
        }
    });

    it('keeps Sports Broadcast typography readable by default and aligned with its settings', () => {
        const template = getTemplateDefinition('sports-broadcast');
        for (const [width, height] of [[884, 151], [320, 180]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('sports-broadcast'), 'sports-broadcast');
            const values = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            const labels = ctx.__fillTextEntries.filter((entry) =>
                ['P', 'A', 'C', 'E', 'H', 'R', 'D', 'I', 'S', 'T'].includes(entry.text),
            );
            expect(values).toHaveLength(4);
            expect(Math.min(...values.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(12);
            expect(Math.min(...labels.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(7);
            expectTextInsideFrame(ctx, width, height);
        }

        const hiddenLabels = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(hiddenLabels, METRICS, 320, 180, {
            ...getTemplateConfig('sports-broadcast'),
            labelStyle: 'hidden',
            backgroundOpacity: 0,
        }, 'sports-broadcast');
        const hiddenText = hiddenLabels.__fillTextEntries.map((entry) => entry.text).join('');
        expect(hiddenText).not.toContain('PACE');
        expect(hiddenText).toContain('05:30');
        expect(hiddenText).toContain('min/km');
        expectTextInsideFrame(hiddenLabels, 320, 180);

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(true);
        expect(template?.capabilities.supportsTextShadow).toBe(true);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(template?.config.textShadow);
        expect(template?.styles.visual.textShadowBlur).toBe(template?.config.textShadowBlur);
    });

    it('fits Cockpit HUD metrics, including power, across compact and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('cockpit-hud'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 3.1,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'cockpit-hud');

            for (const value of ['120:59', '199', '12345.6', '123:59:59', '1999']) {
                expect(ctx.__fillTextEntries.some((entry) => entry.text === value), `${value} at ${width}x${height}`).toBe(true);
            }
            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('MIN/KM');
            expect(renderedText).toContain('BPM');
            expect(renderedText).toContain('KM');
            expect(renderedText).toContain('W');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('Inter'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
        }
    });

    it('keeps Cockpit HUD typography readable by default and aligned with its settings', () => {
        const template = getTemplateDefinition('cockpit-hud');
        for (const [width, height] of [[884, 151], [320, 180], [320, 568]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('cockpit-hud'), 'cockpit-hud');
            const values = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            const labels = ctx.__fillTextEntries.filter((entry) =>
                ['P', 'A', 'C', 'E', 'H', 'R', 'D', 'I', 'S', 'T', 'L'].includes(entry.text),
            );
            expect(values).toHaveLength(4);
            expect(Math.min(...values.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(12);
            expect(Math.min(...labels.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(7);
            expectTextInsideFrame(ctx, width, height);
        }

        const hiddenLabels = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(hiddenLabels, METRICS, 320, 180, {
            ...getTemplateConfig('cockpit-hud'),
            labelStyle: 'hidden',
            backgroundOpacity: 0,
        }, 'cockpit-hud');
        const hiddenText = hiddenLabels.__fillTextEntries.map((entry) => entry.text).join('');
        expect(hiddenText).not.toContain('PACE');
        expect(hiddenText).not.toContain('DISTANCE');
        expect(hiddenText).toContain('05:30');
        expect(hiddenText).toContain('MIN/KM');
        expectTextInsideFrame(hiddenLabels, 320, 180);

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(true);
        expect(template?.capabilities.supportsTextShadow).toBe(true);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(template?.config.textShadow);
        expect(template?.styles.visual.textShadowBlur).toBe(template?.config.textShadowBlur);
    });

    it('fits Race Tag telemetry without a shaded full-width strip across aspect ratios', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('race-tag'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 3.1,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'race-tag');

            for (const value of ['120:59', '199', '12345.6', '123:59:59', '1999']) {
                expect(ctx.__fillTextEntries.some((entry) => entry.text === value), `${value} at ${width}x${height}`).toBe(true);
            }
            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('PACE');
            expect(renderedText).toContain('POWER');
            expect(renderedText).toContain('MIN/KM');
            expect(renderedText).toContain('BPM');
            expect(renderedText).toContain('W');
            expect(ctx.fillRect).not.toHaveBeenCalled();
            expect(ctx.createLinearGradient).not.toHaveBeenCalled();
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
        }
    });

    it('keeps Race Tag typography legible and template settings consistent', () => {
        const template = getTemplateDefinition('race-tag');
        for (const [width, height] of [[884, 151], [320, 180], [320, 568]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('race-tag'), 'race-tag');
            const values = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            const pace = ctx.__fillTextEntries.find((entry) => entry.text === '05:30');
            expect(values).toHaveLength(4);
            expect(pace?.fontSize).toBeGreaterThanOrEqual(14);
            expect(Math.min(...values.filter((entry) => entry.text !== '05:30').map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(8);
            expectTextInsideFrame(ctx, width, height);
        }

        const hiddenLabels = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(hiddenLabels, METRICS, 320, 180, {
            ...getTemplateConfig('race-tag'),
            labelStyle: 'hidden',
        }, 'race-tag');
        const hiddenText = hiddenLabels.__fillTextEntries.map((entry) => entry.text).join('');
        expect(hiddenText).not.toContain('PACE');
        expect(hiddenText).not.toContain('DIST');
        expect(hiddenText).toContain('05:30');
        expect(hiddenText).toContain('MIN/KM');
        expectTextInsideFrame(hiddenLabels, 320, 180);

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(true);
        expect(template?.capabilities.supportsTextShadow).toBe(false);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
    });

    it('fits Data Block metrics in compact, shallow, wide, and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('data-block'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 3.1,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'data-block');

            for (const value of ['120:59', '199', '12345.6', '123:59:59', '1999']) {
                expect(ctx.__fillTextEntries.some((entry) => entry.text === value), `${value} at ${width}x${height}`).toBe(true);
            }
            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('HEART RATE');
            expect(renderedText).toContain('PACE');
            expect(renderedText).toContain('DISTANCE');
            expect(renderedText).toContain('ELAPSED');
            expect(renderedText).toContain('POWER');
            expect(renderedText).toContain('BPM');
            expect(renderedText).toContain('MIN/KM');
            expect(renderedText).toContain('W');
            expect(ctx.fillRect).not.toHaveBeenCalled();
            expect(ctx.createLinearGradient).not.toHaveBeenCalled();
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
        }
    });

    it('keeps Data Block typography readable and aligns supported metrics and settings', () => {
        const template = getTemplateDefinition('data-block');
        for (const [width, height] of [[884, 151], [320, 180], [320, 568]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('data-block'), 'data-block');
            const values = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            const heartRate = ctx.__fillTextEntries.find((entry) => entry.text === '150');
            expect(values).toHaveLength(4);
            expect(heartRate?.fontSize).toBeGreaterThanOrEqual(20);
            expect(Math.min(...values.filter((entry) => entry.text !== '150').map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(9);
            expectTextInsideFrame(ctx, width, height);
        }

        const hiddenLabels = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(hiddenLabels, METRICS, 320, 180, {
            ...getTemplateConfig('data-block'),
            labelStyle: 'hidden',
        }, 'data-block');
        const hiddenText = hiddenLabels.__fillTextEntries.map((entry) => entry.text).join('');
        expect(hiddenText).not.toContain('HEART RATE');
        expect(hiddenText).not.toContain('DISTANCE');
        expect(hiddenText).toContain('05:30');
        expect(hiddenText).toContain('MIN/KM');
        expect(hiddenText).toContain('BPM');
        expectTextInsideFrame(hiddenLabels, 320, 180);

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.capabilities.supportsTextShadow).toBe(false);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.textShadow).toBe(template?.config.textShadow);
    });

    it('fits Night Runner telemetry on compact, shallow, wide, and portrait frames without shading the video', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('night-runner'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 3.1,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'night-runner');

            for (const value of ['120:59', '199', '12345.6', '123:59:59', '1999']) {
                expect(ctx.__fillTextEntries.some((entry) => entry.text === value), `${value} at ${width}x${height}`).toBe(true);
            }
            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            expect(renderedText).toContain('MIN / KM');
            expect(renderedText).toContain('BPM');
            expect(renderedText).toContain('KM');
            expect(renderedText).toContain('W');
            expect(ctx.fillRect).not.toHaveBeenCalled();
            expect(ctx.createLinearGradient).not.toHaveBeenCalled();
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
        }
    });

    it('keeps Night Runner type legible by default and aligns supported metrics and settings', () => {
        const template = getTemplateDefinition('night-runner');
        for (const [width, height] of [[884, 151], [320, 180], [320, 568]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('night-runner'), 'night-runner');
            const values = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            const heroValue = ctx.__fillTextEntries.find((entry) => entry.text === '05:30');
            const labelGlyphs = ctx.__fillTextEntries.filter((entry) => entry.text.length === 1);
            expect(values).toHaveLength(4);
            expect(heroValue?.fontSize).toBeGreaterThanOrEqual(20);
            expect(Math.min(...values.filter((entry) => entry.text !== '05:30').map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(13);
            expect(Math.min(...labelGlyphs.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(9);
            expectTextInsideFrame(ctx, width, height);
        }

        const hiddenLabels = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(hiddenLabels, METRICS, 320, 180, {
            ...getTemplateConfig('night-runner'),
            labelStyle: 'hidden',
        }, 'night-runner');
        const hiddenText = hiddenLabels.__fillTextEntries.map((entry) => entry.text).join('');
        expect(hiddenText).not.toContain('ELAPSED');
        expect(hiddenText).not.toContain('DIST');
        expect(hiddenText).toContain('05:30');
        expect(hiddenText).toContain('BPM');
        expectTextInsideFrame(hiddenLabels, 320, 180);

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(false);
        expect(template?.capabilities.supportsTextShadow).toBe(false);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
    });

    it('fits Terminal metrics, including power, inside compact, shallow, wide, and portrait frames', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '120:59', unit: 'min/km' },
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
            { label: 'Time', value: '123:59:59', unit: '' },
            { label: 'Power', value: '1999', unit: 'W' },
        ];
        const sizes = [[884, 151], [320, 180], [320, 568], [1920, 1080], [1080, 1920]] as const;
        const config = {
            ...getTemplateConfig('terminal'),
            fontSizePercent: 3.4,
            valueSizeMultiplier: 3.1,
            labelSizeMultiplier: 1.2,
            labelLetterSpacing: 0.18,
        };

        for (const [width, height] of sizes) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, metrics, width, height, config, 'terminal');

            const renderedText = ctx.__fillTextEntries.map((entry) => entry.text).join('');
            for (const value of ['120:59', '199', '12345.6', '123:59:59', '1999']) {
                expect(renderedText, `${value} at ${width}x${height}`).toContain(value);
            }
            expect(renderedText).toContain('POWER');
            expect(renderedText).toContain('min/km');
            expect(renderedText).toContain('bpm');
            expect(renderedText).toContain('W');
            expect(ctx.__fillTextEntries.some((entry) => entry.font.includes('monospace'))).toBe(true);
            expectTextInsideFrame(ctx, width, height);
            expectNoTextCollisions(ctx);
        }
    });

    it('keeps Terminal type readable, supports hidden labels, and aligns its template settings', () => {
        const template = getTemplateDefinition('terminal');
        for (const [width, height] of [[884, 151], [320, 180], [320, 568]] as const) {
            const ctx = createStubContext({ scaleWithFont: true });
            renderExtendedLayout(ctx, METRICS, width, height, getTemplateConfig('terminal'), 'terminal');
            const values = ctx.__fillTextEntries.filter((entry) =>
                ['05:30', '150', '10.2', '00:45:12'].includes(entry.text),
            );
            const labelEntries = ctx.__fillTextEntries.filter((entry) =>
                ['P', 'A', 'C', 'E', 'H', 'R', 'D', 'I', 'S', 'T'].includes(entry.text),
            );
            expect(values).toHaveLength(4);
            expect(Math.min(...values.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(9);
            expect(Math.min(...labelEntries.map((entry) => entry.fontSize))).toBeGreaterThanOrEqual(7);
            expectTextInsideFrame(ctx, width, height);
        }

        const hiddenLabels = createStubContext({ scaleWithFont: true });
        renderExtendedLayout(hiddenLabels, METRICS, 320, 180, {
            ...getTemplateConfig('terminal'),
            labelStyle: 'hidden',
            backgroundOpacity: 0,
        }, 'terminal');
        const hiddenText = hiddenLabels.__fillTextEntries.map((entry) => entry.text).join('');
        expect(hiddenText).not.toContain('PACE');
        expect(hiddenText).not.toContain('DIST');
        expect(hiddenText).toContain('05:30');
        expect(hiddenText).toContain('min/km');
        expectTextInsideFrame(hiddenLabels, 320, 180);

        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time', 'power']);
        expect(template?.capabilities.supportsBackgroundOpacity).toBe(true);
        expect(template?.capabilities.supportsBorder).toBe(true);
        expect(template?.capabilities.supportsTextShadow).toBe(true);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
        expect(template?.styles.visual.labelStyle).toBe(template?.config.labelStyle);
        expect(template?.styles.visual.cornerRadius).toBe(template?.config.cornerRadius);
        expectTextInsideFrame(hiddenLabels, 320, 180);
    });

});
