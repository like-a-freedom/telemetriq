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
    });

    it('should handle odd number of metrics', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
            { label: 'Pace', value: '5:30', unit: '/km' },
            { label: 'HR', value: '140', unit: 'bpm' },
        ];

        renderMarginLayout(mockCtx as any, metrics, width, height, baseConfig);

        expect(mockCtx.fillText).toHaveBeenCalled();
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

        // Test different resolutions
        renderMarginLayout(mockCtx as any, metrics, 1280, 720, baseConfig);
        expect(mockCtx.fillText).toHaveBeenCalled();

        mockCtx = createMockContext();
        renderMarginLayout(mockCtx as any, metrics, 3840, 2160, baseConfig);
        expect(mockCtx.fillText).toHaveBeenCalled();
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
