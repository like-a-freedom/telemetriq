import { describe, it, expect, vi } from 'vitest';
import { renderExtendedLayout } from '../modules/layouts/extendedLayouts';
import { getTemplateConfig } from '../modules/templateConfigs';
import type { MetricItem } from '../modules/overlayRenderer';
import type { OverlayContext2D } from '../modules/overlayUtils';

type FillTextEntry = {
    text: string;
    x: number;
    y: number;
    align: CanvasTextAlign;
    font: string;
};

type StubContext = OverlayContext2D & {
    __fillTextEntries: FillTextEntry[];
};

function createStubContext(): StubContext {
    const fillTextEntries: FillTextEntry[] = [];
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
        return width;
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
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: measure(text) } as TextMetrics)),
        fillText: vi.fn((text: string, x: number, y: number) => {
            fillTextEntries.push({
                text,
                x,
                y,
                align: (ctx.textAlign ?? 'left') as CanvasTextAlign,
                font: String(ctx.font ?? ''),
            });
        }),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() } as unknown as CanvasGradient)),
        translate: vi.fn(),
        rotate: vi.fn(),
    };

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
] as const;

describe('extended layouts renderer', () => {
    it.each(EXTENDED_LAYOUTS)('renders %s without errors and draws text', (layoutMode) => {
        const ctx = createStubContext();
        const config = getTemplateConfig(layoutMode);

        expect(() => {
            renderExtendedLayout(ctx, METRICS, 1280, 720, config, layoutMode);
        }).not.toThrow();

        expect(ctx.save).toHaveBeenCalledTimes(1);
        expect(ctx.restore).toHaveBeenCalledTimes(1);
        expect(ctx.__fillTextEntries.length).toBeGreaterThan(0);
    });

    it('swiss-grid aligns labels/values/units by center and keeps symmetric side alignment', () => {
        const ctx = createStubContext();
        const width = 1280;
        const height = 720;
        const config = getTemplateConfig('swiss-grid');

        renderExtendedLayout(ctx, METRICS, width, height, config, 'swiss-grid');

        const paceLabel = ctx.__fillTextEntries.find((e) => e.text === 'PACE');
        const paceValue = ctx.__fillTextEntries.find((e) => e.text === '05:30');
        const paceUnit = ctx.__fillTextEntries.find((e) => e.text === 'min/km');

        const hrLabel = ctx.__fillTextEntries.find((e) => e.text === 'HEART RATE');
        const hrValue = ctx.__fillTextEntries.find((e) => e.text === '150');
        const hrUnit = ctx.__fillTextEntries.find((e) => e.text === 'bpm');

        const distLabel = ctx.__fillTextEntries.find((e) => e.text === 'DISTANCE');
        const distValue = ctx.__fillTextEntries.find((e) => e.text === '10.2');
        const distUnit = ctx.__fillTextEntries.find((e) => e.text === 'km');

        const timeLabel = ctx.__fillTextEntries.find((e) => e.text === 'TIME');
        const timeValue = ctx.__fillTextEntries.find((e) => e.text === '00:45:12');

        expect(paceLabel).toBeDefined();
        expect(paceValue).toBeDefined();
        expect(paceUnit).toBeDefined();
        expect(hrLabel).toBeDefined();
        expect(hrValue).toBeDefined();
        expect(hrUnit).toBeDefined();
        expect(distLabel).toBeDefined();
        expect(distValue).toBeDefined();
        expect(distUnit).toBeDefined();
        expect(timeLabel).toBeDefined();
        expect(timeValue).toBeDefined();

        const xTriples: Array<[number, number, number]> = [
            [paceLabel!.x, paceValue!.x, paceUnit!.x],
            [hrLabel!.x, hrValue!.x, hrUnit!.x],
            [distLabel!.x, distValue!.x, distUnit!.x],
        ];

        xTriples.forEach((triple) => {
            const [a, b, c] = triple;
            expect(Math.abs(a - b)).toBeLessThanOrEqual(0.01);
            expect(Math.abs(b - c)).toBeLessThanOrEqual(0.01);
        });

        expect(Math.abs(timeLabel!.x - timeValue!.x)).toBeLessThanOrEqual(0.01);

        const swissTextCalls = [
            paceLabel!, paceValue!, paceUnit!,
            hrLabel!, hrValue!, hrUnit!,
            distLabel!, distValue!, distUnit!,
            timeLabel!, timeValue!,
        ];
        swissTextCalls.forEach((call) => {
            expect(call.align).toBe('center');
        });

        const shortSide = Math.min(width, height);
        const sidePad = shortSide * 0.03;
        const leftInset = paceLabel!.x - sidePad;
        const rightInset = (width - sidePad) - timeLabel!.x;
        expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(1);
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
        const narrowTickerCtx = createStubContext();
        const wideTickerCtx = createStubContext();

        renderExtendedLayout(narrowTickerCtx, narrowMetrics, 1280, 720, tickerConfig, 'ticker-tape');
        renderExtendedLayout(wideTickerCtx, wideMetrics, 1280, 720, tickerConfig, 'ticker-tape');

        const narrowTickerEntry = narrowTickerCtx.__fillTextEntries
            .find((entry) => entry.text.includes('PACE'));
        const wideTickerEntry = wideTickerCtx.__fillTextEntries
            .find((entry) => entry.text.includes('PACE'));

        expect(narrowTickerEntry).toBeDefined();
        expect(wideTickerEntry).toBeDefined();
        expect(narrowTickerEntry?.font).toBe(wideTickerEntry?.font);

        const stripConfig = getTemplateConfig('condensed-strip');
        const narrowStripCtx = createStubContext();
        const wideStripCtx = createStubContext();

        renderExtendedLayout(narrowStripCtx, narrowMetrics, 1280, 720, stripConfig, 'condensed-strip');
        renderExtendedLayout(wideStripCtx, wideMetrics, 1280, 720, stripConfig, 'condensed-strip');

        const narrowPaceDraw = narrowStripCtx.__fillTextEntries
            .find((entry) => entry.text.includes('min/km'));
        const widePaceDraw = wideStripCtx.__fillTextEntries
            .find((entry) => entry.text.includes('min/km'));

        expect(narrowPaceDraw).toBeDefined();
        expect(widePaceDraw).toBeDefined();
        expect(narrowPaceDraw?.font).toBe(widePaceDraw?.font);
    });

});
