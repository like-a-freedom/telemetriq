import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderClassicLayout } from '../modules/layouts/classicLayout';
import { DEFAULT_OVERLAY_CONFIG } from '../modules/overlayRenderer';
import type { MetricItem } from '../core/types';
import type { ExtendedOverlayConfig } from '../core/types';

// Mock canvas context
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
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        globalAlpha: 1,
    };
}

describe('Classic Layout', () => {
    let mockCtx: ReturnType<typeof createMockContext>;
    const width = 1920;
    const height = 1080;

    beforeEach(() => {
        mockCtx = createMockContext();
    });

    const baseConfig: ExtendedOverlayConfig = {
        ...DEFAULT_OVERLAY_CONFIG,
        templateId: 'classic',
        position: 'bottom-left',
        fontSizePercent: 2,
        fontFamily: 'Inter, sans-serif',
        textColor: '#FFFFFF',
        backgroundOpacity: 0.7,
        showHr: true,
        showPace: true,
        showDistance: true,
        showTime: true,
    };

    it('should render layout with basic metrics', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
            { label: 'Pace', value: '5:30', unit: '/km' },
        ];
        const config: ExtendedOverlayConfig = {
            ...baseConfig,
            backgroundColor: '#000000',
        };

        renderClassicLayout(mockCtx as any, metrics, width, height, config);

        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
        expect(mockCtx.fillText.mock.calls.map(([text]) => text)).toEqual([
            'DISTANCE   5.2 km   ·   PACE   5:30 /km',
        ]);
    });

    it('should handle empty metrics', () => {
        renderClassicLayout(mockCtx as any, [], width, height, baseConfig);

        // Should return early without rendering
        expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('keeps a zero-opacity background transparent even with an opaque color', () => {
        renderClassicLayout(mockCtx as any, [{ label: 'Power', value: '999', unit: 'W' }], width, height,
            { ...baseConfig, backgroundColor: '#000000', backgroundOpacity: 0 });
        expect(mockCtx.fill).not.toHaveBeenCalled();
    });

    it('applies background opacity without dimming the text', () => {
        let opacityAtFill = 0;
        mockCtx.fill.mockImplementation(() => { opacityAtFill = mockCtx.globalAlpha; });
        renderClassicLayout(mockCtx as any, [{ label: 'Power', value: '999', unit: 'W' }], width, height,
            { ...baseConfig, backgroundColor: '#000000', backgroundOpacity: 0.4 });
        expect(opacityAtFill).toBe(0.4);
        expect(mockCtx.save).toHaveBeenCalledTimes(mockCtx.restore.mock.calls.length);
    });

    it('should calculate correct font size based on height', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];

        // classicLayout.ts pins the draw size to the short side of the canvas:
        // max(12, min(w, h) * fontSizePercent/100 * textScale * valueSizeMultiplier/2.5)
        const expectedFontSize = (targetHeight: number) => {
            const shortSide = Math.min(width, targetHeight);
            const textScale = Math.min(1.18, Math.max(0.86, shortSide / 1080));
            const multiplier = (baseConfig.valueSizeMultiplier ?? 2.5) / 2.5;
            return Math.max(12, shortSide * ((baseConfig.fontSizePercent ?? 2) / 100) * textScale * multiplier);
        };
        const drawnFontSize = () => Number.parseFloat(mockCtx.font.match(/([\d.]+)px/)?.[1] ?? '0');

        renderClassicLayout(mockCtx as any, metrics, width, 1080, baseConfig);
        expect(drawnFontSize()).toBeCloseTo(expectedFontSize(1080), 5);

        mockCtx = createMockContext();
        renderClassicLayout(mockCtx as any, metrics, width, 2160, baseConfig);
        expect(drawnFontSize()).toBeCloseTo(expectedFontSize(2160), 5);
    });

    it('should render at different positions', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
        const anchors: Record<string, { x: number; y: number }> = {};

        for (const position of positions) {
            mockCtx = createMockContext();
            const config: ExtendedOverlayConfig = {
                ...baseConfig,
                position,
            };

            renderClassicLayout(mockCtx as any, metrics, width, height, config);
            const call = mockCtx.fillText.mock.calls[0];
            expect(call).toBeDefined();
            anchors[position] = { x: Number(call![1]), y: Number(call![2]) };
        }

        // Each position anchors the overlay box in its own quadrant.
        const midX = width / 2;
        const midY = height / 2;
        expect(anchors['top-left']!.x).toBeLessThan(midX);
        expect(anchors['top-left']!.y).toBeLessThan(midY);
        expect(anchors['top-right']!.x).toBeGreaterThan(midX);
        expect(anchors['top-right']!.y).toBeLessThan(midY);
        expect(anchors['bottom-left']!.x).toBeLessThan(midX);
        expect(anchors['bottom-left']!.y).toBeGreaterThan(midY);
        expect(anchors['bottom-right']!.x).toBeGreaterThan(midX);
        expect(anchors['bottom-right']!.y).toBeGreaterThan(midY);
    });

    it('respects the label visibility setting without substituting emoji', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '5:30', unit: 'min/km' },
            { label: 'Heart Rate', value: '140', unit: 'bpm' },
        ];

        renderClassicLayout(mockCtx as any, metrics, width, height, {
            ...baseConfig,
            labelStyle: 'hidden',
            layout: 'vertical',
        });

        expect(mockCtx.fillText.mock.calls.map(([text]) => text)).toEqual(['5:30 min/km', '140 bpm']);
    });

    it('uses a soft, offset text shadow for contrast over footage', () => {
        let shadowAtDraw: { blur: number; offsetY: number } | undefined;
        mockCtx.fillText.mockImplementation(() => {
            shadowAtDraw = { blur: mockCtx.shadowBlur, offsetY: mockCtx.shadowOffsetY };
        });

        renderClassicLayout(mockCtx as any, [{ label: 'Pace', value: '5:30', unit: 'min/km' }], width, height, {
            ...baseConfig,
            textShadow: true,
            textShadowBlur: 2,
        });

        expect(shadowAtDraw?.blur).toBe(2);
        expect(shadowAtDraw?.offsetY).toBeGreaterThan(0);
    });

    it('keeps vertical rows separated when configured with tight line spacing', () => {
        const metrics: MetricItem[] = [
            { label: 'Heart Rate', value: '199', unit: 'bpm' },
            { label: 'Distance', value: '12345.6', unit: 'km' },
        ];
        renderClassicLayout(mockCtx as any, metrics, 320, 180, {
            ...baseConfig,
            layout: 'vertical',
            lineSpacing: 0.8,
            textShadow: true,
        });

        const rows = mockCtx.fillText.mock.calls;
        const fontSize = Number.parseFloat(mockCtx.font.match(/([\d.]+)px/)?.[1] ?? '0');
        expect(rows).toHaveLength(2);
        expect(rows[1]![2] - rows[0]![2]).toBeGreaterThanOrEqual(fontSize * 1.25);
    });

});
