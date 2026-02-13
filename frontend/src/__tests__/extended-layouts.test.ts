import { describe, it, expect, vi } from 'vitest';
import { renderExtendedLayout } from '../modules/layouts/extended-layouts';
import { getTemplateConfig } from '../modules/template-configs';
import type { MetricItem } from '../modules/overlay-renderer';
import type { OverlayContext2D } from '../modules/overlay-utils';

type FillTextEntry = {
    text: string;
    x: number;
    y: number;
    align: CanvasTextAlign;
};

type StubContext = OverlayContext2D & {
    __fillTextEntries: FillTextEntry[];
};

function createStubContext(): StubContext {
    const fillTextEntries: FillTextEntry[] = [];

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
        measureText: vi.fn((text: string) => ({ width: text.length * 8 } as TextMetrics)),
        fillText: vi.fn((text: string, x: number, y: number) => {
            fillTextEntries.push({
                text,
                x,
                y,
                align: (ctx.textAlign ?? 'left') as CanvasTextAlign,
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
    'floating-pills',
    'arc-gauge',
    'hero-number',
    'dashboard-hud',
    'cinematic-bar',
    'split-edges',
    'stacked-serif',
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

        const paceLabel = ctx.__fillTextEntries.find((e) => e.text === 'Pace');
        const paceValue = ctx.__fillTextEntries.find((e) => e.text === '05:30');
        const paceUnit = ctx.__fillTextEntries.find((e) => e.text === 'min/km');

        const hrLabel = ctx.__fillTextEntries.find((e) => e.text === 'Heart Rate');
        const hrValue = ctx.__fillTextEntries.find((e) => e.text === '150');
        const hrUnit = ctx.__fillTextEntries.find((e) => e.text === 'bpm');

        const distLabel = ctx.__fillTextEntries.find((e) => e.text === 'Distance');
        const distValue = ctx.__fillTextEntries.find((e) => e.text === '10.2');
        const distUnit = ctx.__fillTextEntries.find((e) => e.text === 'km');

        const timeLabel = ctx.__fillTextEntries.find((e) => e.text === 'Time');
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
});
