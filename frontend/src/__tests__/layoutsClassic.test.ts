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

        renderClassicLayout(mockCtx as any, metrics, width, height, baseConfig);

        // Font should be set with calculated size
        expect(mockCtx.font).toContain('px');
    });

    it('should render at different positions', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

        for (const position of positions) {
            mockCtx = createMockContext();
            const config: ExtendedOverlayConfig = {
                ...baseConfig,
                position,
            };

            renderClassicLayout(mockCtx as any, metrics, width, height, config);
            expect(mockCtx.fillText).toHaveBeenCalled();
        }
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
