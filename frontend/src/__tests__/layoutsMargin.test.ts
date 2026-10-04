import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderMarginLayout } from '../modules/layouts/marginLayout';
import { DEFAULT_OVERLAY_CONFIG } from '../modules/overlayRenderer';
import type { MetricItem } from '../core/types';
import type { ExtendedOverlayConfig } from '../core/types';

function createMockContext() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
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
        createRadialGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textBaseline: '',
        textAlign: '',
        shadowColor: '',
        shadowBlur: 0,
        globalAlpha: 1,
    };
}

describe('Margin Layout', () => {
    let mockCtx: ReturnType<typeof createMockContext>;
    const width = 1920;
    const height = 1080;

    beforeEach(() => {
        mockCtx = createMockContext();
    });

    const baseConfig: ExtendedOverlayConfig = {
        ...DEFAULT_OVERLAY_CONFIG,
        templateId: 'margin',
        position: 'bottom-left',
        fontSizePercent: 2,
        textColor: '#FFFFFF',
        backgroundOpacity: 0.7,
        showHr: true,
        showPace: true,
        showDistance: true,
        showTime: true,
    };

    it('should render layout with metrics on both sides', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
            { label: 'Pace', value: '5:30', unit: '/km' },
            { label: 'HR', value: '140', unit: 'bpm' },
            { label: 'Time', value: '30:00', unit: '' },
        ];

        renderMarginLayout(mockCtx as any, metrics, width, height, baseConfig);

        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
        expect(mockCtx.fillText.mock.calls.map(([text]) => text)).toEqual([
            '5.2', 'km', 'D', 'I', 'S', 'T',
            '5:30', '/km', 'P', 'A', 'C', 'E',
            '140', 'bpm', 'H', 'R',
            '30:00', 'T', 'I', 'M', 'E',
        ]);
    });

    it('should split metrics between left and right sides', () => {
        const metrics: MetricItem[] = [
            { label: 'Left1', value: '10', unit: '' },
            { label: 'Left2', value: '20', unit: '' },
            { label: 'Right1', value: '30', unit: '' },
            { label: 'Right2', value: '40', unit: '' },
        ];

        renderMarginLayout(mockCtx as any, metrics, width, height, baseConfig);

        // Should render all metrics
        expect(mockCtx.fillText).toHaveBeenCalled();

        // half = ceil(4 / 2) = 2 → the first two values anchor to the left rail,
        // the last two anchor to the right rail.
        const valueXs = mockCtx.fillText.mock.calls
            .filter(([text]) => ['10', '20', '30', '40'].includes(String(text)))
            .map(([text, x]) => ({ text: String(text), x: Number(x) }));
        expect(valueXs).toHaveLength(4);
        const leftXs = valueXs.filter(entry => entry.x < width / 2);
        const rightXs = valueXs.filter(entry => entry.x > width / 2);
        expect(leftXs.map(entry => entry.text)).toEqual(['10', '20']);
        expect(rightXs.map(entry => entry.text)).toEqual(['30', '40']);
        expect(new Set(leftXs.map(entry => entry.x)).size).toBe(1); // one shared left rail
        expect(new Set(rightXs.map(entry => entry.x)).size).toBe(1); // one shared right rail
    });

    it('should handle odd number of metrics', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
            { label: 'Pace', value: '5:30', unit: '/km' },
            { label: 'HR', value: '140', unit: 'bpm' },
        ];

        renderMarginLayout(mockCtx as any, metrics, width, height, baseConfig);

        expect(mockCtx.fillText).toHaveBeenCalled();
        const drawnTexts = mockCtx.fillText.mock.calls.map(([text]) => text);
        expect(drawnTexts).toEqual(expect.arrayContaining(['5.2', '5:30', '140']));

        // half = ceil(3 / 2) = 2 → two values on the left rail, one on the right.
        const valueXs = mockCtx.fillText.mock.calls
            .filter(([text]) => ['5.2', '5:30', '140'].includes(String(text)))
            .map(([text, x]) => ({ text: String(text), x: Number(x) }));
        expect(valueXs.filter(entry => entry.x < width / 2).map(entry => entry.text)).toEqual(['5.2', '5:30']);
        expect(valueXs.filter(entry => entry.x > width / 2).map(entry => entry.text)).toEqual(['140']);
    });

    it('keeps the video clear without drawing backdrops', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];
        const config: ExtendedOverlayConfig = {
            ...baseConfig,
            backgroundOpacity: 0.5,
        };

        renderMarginLayout(mockCtx as any, metrics, width, height, config);

        expect(mockCtx.createRadialGradient).not.toHaveBeenCalled();
        expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should handle different screen sizes', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
        ];

        const drawAt = (w: number, h: number) => {
            mockCtx = createMockContext();
            renderMarginLayout(mockCtx as any, metrics, w, h, baseConfig);
            const valueCall = mockCtx.fillText.mock.calls.find(([text]) => text === '5.2')!;
            return { x: Number(valueCall[1]), y: Number(valueCall[2]) };
        };

        const small = drawAt(1280, 720);
        const large = drawAt(3840, 2160);

        expect(small.x).not.toBe(large.x);
        expect(small.y).not.toBe(large.y);

        // marginLayout anchors the first slot at x = shortSide * 0.045 + rail (left side)
        // and y = h * 0.16, both scaling with the frame size.
        expect(small.x).toBeLessThan(1280 / 2);
        expect(large.x).toBeLessThan(3840 / 2);
        expect(small.y).toBeCloseTo(720 * 0.16, 5);
        expect(large.y).toBeCloseTo(2160 * 0.16, 5);
        expect(large.x / small.x).toBeCloseTo(3, 3);
        expect(large.y / small.y).toBeCloseTo(3, 3);
    });

    it('applies value and label size multipliers to the rendered type hierarchy', () => {
        const metric: MetricItem[] = [{ label: 'Pace', value: '5:30', unit: 'km' }];
        const normalConfig: ExtendedOverlayConfig = {
            ...baseConfig,
            valueSizeMultiplier: 3.5,
            labelSizeMultiplier: 0.5,
        };
        renderMarginLayout(mockCtx as any, metric, width, height, normalConfig);
        const normalUnitY = Number(mockCtx.fillText.mock.calls[1]![2]);
        const normalLabelSize = Number.parseFloat(mockCtx.font.match(/[\d.]+px/)?.[0] ?? '0');

        mockCtx = createMockContext();
        renderMarginLayout(mockCtx as any, metric, width, height, {
            ...normalConfig,
            valueSizeMultiplier: 7,
            labelSizeMultiplier: 0.75,
        });

        const largerUnitY = Number(mockCtx.fillText.mock.calls[1]![2]);
        const largerLabelSize = Number.parseFloat(mockCtx.font.match(/[\d.]+px/)?.[0] ?? '0');
        expect(largerUnitY).toBeGreaterThan(normalUnitY);
        expect(largerLabelSize).toBeGreaterThan(normalLabelSize);
    });

    it('uses tracking for vertical labels and supports hiding them', () => {
        const metric: MetricItem[] = [{ label: 'Pace', value: '5:30', unit: 'min/km' }];
        const trackedConfig: ExtendedOverlayConfig = {
            ...baseConfig,
            labelLetterSpacing: 0.12,
        };

        renderMarginLayout(mockCtx as any, metric, width, height, trackedConfig);
        const labelCalls = mockCtx.fillText.mock.calls.filter(([text]) => ['P', 'A', 'C', 'E'].includes(String(text)));
        expect(labelCalls).toHaveLength(4);
        expect(Number(labelCalls[1]![1]) - Number(labelCalls[0]![1])).toBeGreaterThan(10);

        mockCtx = createMockContext();
        renderMarginLayout(mockCtx as any, metric, width, height, { ...trackedConfig, labelStyle: 'hidden' });
        expect(mockCtx.fillText.mock.calls.map(([text]) => text)).toEqual(['5:30', 'min/km']);
    });

    it('keeps the readable text contour thin and only draws it when enabled', () => {
        renderMarginLayout(mockCtx as any, [{ label: 'Pace', value: '5:30', unit: '' }], width, height, {
            ...baseConfig,
            textShadow: true,
        });
        expect(mockCtx.lineWidth).toBeCloseTo(1.404);
        expect(mockCtx.strokeText).toHaveBeenCalled();

        mockCtx = createMockContext();
        renderMarginLayout(mockCtx as any, [{ label: 'Pace', value: '5:30', unit: '' }], width, height, {
            ...baseConfig,
            textShadow: false,
        });
        expect(mockCtx.strokeText).not.toHaveBeenCalled();
    });

});
