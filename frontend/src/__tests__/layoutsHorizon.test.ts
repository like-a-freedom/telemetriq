import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHorizonLayout } from '../modules/layouts/horizonLayout';
import { DEFAULT_OVERLAY_CONFIG } from '../modules/overlayRenderer';
import type { MetricItem } from '../core/types';
import type { ExtendedOverlayConfig } from '../core/types';

function createMockContext() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
        roundRect: vi.fn(),
        createLinearGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textBaseline: '',
        textAlign: '',
        letterSpacing: '0px',
        shadowColor: '',
        shadowBlur: 0,
        globalAlpha: 1,
    };
}

describe('Horizon Layout', () => {
    let mockCtx: ReturnType<typeof createMockContext>;
    const width = 1920;
    const height = 1080;

    const baseConfig: ExtendedOverlayConfig = {
        ...DEFAULT_OVERLAY_CONFIG,
        templateId: 'horizon',
        position: 'bottom-left',
        fontSizePercent: 2.4,
        textColor: '#FFFFFF',
        backgroundOpacity: 0.7,
        showHr: true,
        showPace: true,
        showDistance: true,
        showTime: true,
    };

    beforeEach(() => {
        mockCtx = createMockContext();
    });

    it('should render layout with metrics', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
            { label: 'Pace', value: '5:30', unit: '/km' },
            { label: 'HR', value: '140', unit: 'bpm' },
        ];

        renderHorizonLayout(mockCtx as any, metrics, width, height, baseConfig);

        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
        expect(mockCtx.fillText.mock.calls.map(([text]) => text)).toEqual([
            'D', 'I', 'S', 'T', 'A', 'N', 'C', 'E', '5.2', 'km',
            'P', 'A', 'C', 'E', '5:30', '/km',
            'H', 'R', '140', 'bpm',
        ]);
    });

    it('should render gradient background', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];
        let fillStyleAtFillRect: unknown;
        mockCtx.fillRect.mockImplementation(() => { fillStyleAtFillRect = mockCtx.fillStyle; });

        renderHorizonLayout(mockCtx as any, metrics, width, height, baseConfig);

        expect(mockCtx.createLinearGradient).toHaveBeenCalled();
        const gradient = mockCtx.createLinearGradient.mock.results[0]!.value;
        const [x0, y0, x1, y1] = mockCtx.createLinearGradient.mock.calls[0]!;
        // Vertical fade anchored to the bottom strip: top edge above, canvas bottom below.
        expect(x0).toBe(0);
        expect(x1).toBe(0);
        expect(y1).toBe(height);
        expect(y0).toBeGreaterThanOrEqual(0);
        expect(y0).toBeLessThan(y1);
        // The gradient object is what actually paints the backdrop.
        expect(fillStyleAtFillRect).toBe(gradient);
        expect(gradient.addColorStop.mock.calls).toEqual([
            [0, 'rgba(0,0,0,0)'],
            [0.5, 'rgba(0,0,0,0.9)'],
            [1, 'rgba(0,0,0,0.9)'],
        ]);
    });

    it('should handle landscape orientation', () => {
        const metrics: MetricItem[] = ['10', '20', '30', '40', '50', '60'].map((value, index) => (
            { label: `M${index + 1}`, value, unit: '' }
        ));

        renderHorizonLayout(mockCtx as any, metrics, 1920, 1080, baseConfig);
        expect(mockCtx.fillText).toHaveBeenCalled();

        const values = mockCtx.fillText.mock.calls
            .filter(([text]) => metrics.some(m => m.value === text))
            .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
        expect(values).toHaveLength(6);
        // Landscape packs all six metrics into a single row near the bottom strip.
        expect(new Set(values.map(v => v.y)).size).toBe(1);
        expect(values[0]!.y).toBeGreaterThan(1080 / 2);
        const xs = values.map(v => v.x).sort((a, b) => a - b);
        expect(xs[0]! + xs[5]!).toBeCloseTo(1920, 3); // row is centered on the canvas
    });

    it('should handle portrait orientation', () => {
        const metrics: MetricItem[] = ['10', '20', '30', '40', '50', '60'].map((value, index) => (
            { label: `M${index + 1}`, value, unit: '' }
        ));

        renderHorizonLayout(mockCtx as any, metrics, 1080, 1920, baseConfig);
        expect(mockCtx.fillText).toHaveBeenCalled();

        const values = mockCtx.fillText.mock.calls
            .filter(([text]) => metrics.some(m => m.value === text))
            .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
        expect(values).toHaveLength(6);
        // Portrait wraps into two rows of three, both inside the bottom strip.
        const rowYs = [...new Set(values.map(v => v.y))];
        expect(rowYs).toHaveLength(2);
        for (const y of rowYs) expect(y).toBeGreaterThan(1920 / 2);
        const topRowXs = values.filter(v => v.y === rowYs[0]).map(v => v.x).sort((a, b) => a - b);
        expect(topRowXs).toHaveLength(3);
        expect(topRowXs[0]! + topRowXs[2]!).toBeCloseTo(1080, 3); // row is centered
    });

    it('scales the value font size with valueSizeMultiplier', () => {
        const metrics: MetricItem[] = [
            { label: 'VeryLongLabel', value: '999.9', unit: 'km' },
            { label: 'Short', value: '5', unit: '' },
        ];

        const drawnValueFontPx = (valueSizeMultiplier: number) => {
            mockCtx = createMockContext();
            let fontAtValue = '';
            mockCtx.fillText.mockImplementation((text: string) => {
                if (text === '999.9') fontAtValue = mockCtx.font;
            });
            renderHorizonLayout(mockCtx as any, metrics, width, height, { ...baseConfig, valueSizeMultiplier });
            return Number.parseFloat(fontAtValue.match(/([\d.]+)px/)?.[1] ?? '0');
        };

        // horizonLayout.ts: min(shortSide * 0.065 * sizeScale * valueScale, h * 0.13 / rows)
        const expectedValueFontPx = (valueSizeMultiplier: number) => {
            const sizeScale = (baseConfig.fontSizePercent ?? 2.4) / 2.4;
            const valueScale = Math.min(2, Math.max(0.5, valueSizeMultiplier / 2.5));
            return Math.min(1080 * 0.065 * sizeScale * valueScale, (height * 0.13) / 1);
        };

        expect(drawnValueFontPx(2.5)).toBeCloseTo(expectedValueFontPx(2.5), 5);
        expect(drawnValueFontPx(4)).toBeCloseTo(expectedValueFontPx(4), 5);
        expect(drawnValueFontPx(4)).toBeGreaterThan(drawnValueFontPx(2.5));
    });

    it('applies label tracking when drawing the metric name', () => {
        const config: ExtendedOverlayConfig = {
            ...baseConfig,
            labelLetterSpacing: 0.15,
            labelSizeMultiplier: 0.52,
        };

        renderHorizonLayout(mockCtx as any, [{ label: 'Pace', value: '5:30', unit: 'min/km' }], 1920, 1080, config);

        const labelCalls = mockCtx.fillText.mock.calls.filter(([text]) => ['P', 'A', 'C', 'E'].includes(String(text)));
        expect(labelCalls).toHaveLength(4);
        expect(Number(labelCalls[1]![1]) - Number(labelCalls[0]![1])).toBeGreaterThan(10);
    });

    it('omits the label line when labels are hidden', () => {
        const config: ExtendedOverlayConfig = { ...baseConfig, labelStyle: 'hidden' };

        renderHorizonLayout(mockCtx as any, [{ label: 'Distance', value: '5.2', unit: 'km' }], 1920, 1080, config);

        expect(mockCtx.fillText.mock.calls.map(([text]) => text)).toEqual(['5.2', 'km']);
    });

    it('does not apply a text shadow when the template disables shadows', () => {
        const config: ExtendedOverlayConfig = { ...baseConfig, textShadow: false, textShadowColor: '#000000' };
        mockCtx.shadowBlur = 12;
        mockCtx.shadowColor = '#222222';

        renderHorizonLayout(mockCtx as any, [{ label: 'Pace', value: '5:30', unit: 'min/km' }], 1920, 1080, config);

        expect(mockCtx.shadowBlur).toBe(0);
        expect(mockCtx.shadowColor).toBe('transparent');
    });
});
