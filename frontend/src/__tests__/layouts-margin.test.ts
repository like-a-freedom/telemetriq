import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderMarginLayout } from '../modules/layouts/margin-layout';
import type { MetricItem } from '../modules/overlay-renderer';
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
        translate: vi.fn(),
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

    it('should render edge gradients', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];
        const config: ExtendedOverlayConfig = {
            ...baseConfig,
            backgroundOpacity: 0.5,
        };

        renderMarginLayout(mockCtx as any, metrics, width, height, config);

        expect(mockCtx.createLinearGradient).toHaveBeenCalled();
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

});
