import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHorizonLayout } from '../modules/layouts/horizon-layout';
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

describe('Horizon Layout', () => {
    let mockCtx: ReturnType<typeof createMockContext>;
    const width = 1920;
    const height = 1080;

    const baseConfig: ExtendedOverlayConfig = {
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
    });

    it('should render gradient background', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];

        renderHorizonLayout(mockCtx as any, metrics, width, height, baseConfig);

        expect(mockCtx.createLinearGradient).toHaveBeenCalled();
    });

    it('should handle landscape orientation', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
        ];

        renderHorizonLayout(mockCtx as any, metrics, 1920, 1080, baseConfig);
        expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should handle portrait orientation', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
        ];

        renderHorizonLayout(mockCtx as any, metrics, 1080, 1920, baseConfig);
        expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should calculate optimal font sizes', () => {
        const metrics: MetricItem[] = [
            { label: 'VeryLongLabel', value: '999.9', unit: 'km' },
            { label: 'Short', value: '5', unit: '' },
        ];
        const config: ExtendedOverlayConfig = {
            ...baseConfig,
            valueSizeMultiplier: 2.5,
        };

        renderHorizonLayout(mockCtx as any, metrics, width, height, config);

        expect(mockCtx.font).toContain('px');
    });
});
