import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderClassicLayout } from '../modules/layouts/classicLayout';
import type { MetricItem } from '../modules/overlayRenderer';
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

});
