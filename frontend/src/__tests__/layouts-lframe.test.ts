import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderLFrameLayout } from '../modules/layouts/lframe-layout';
import type { MetricItem } from '../modules/overlay-renderer';
import type { ExtendedOverlayConfig, TelemetryFrame } from '../core/types';

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

describe('LFrame Layout', () => {
    let mockCtx: ReturnType<typeof createMockContext>;
    const width = 1920;
    const height = 1080;
    const mockFrame: TelemetryFrame = {
        timeOffset: 0,
        hr: 140,
        paceSecondsPerKm: 300,
        distanceKm: 5.2,
        elevationM: 150,
        elapsedTime: '0:10:00',
        movingTimeSeconds: 600,
    };

    const baseConfig: ExtendedOverlayConfig = {
        templateId: 'lframe',
        position: 'bottom-left',
        fontSizePercent: 2,
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

        renderLFrameLayout(mockCtx as any, metrics, mockFrame, width, height, baseConfig);

        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should render bottom gradient', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];

        renderLFrameLayout(mockCtx as any, metrics, mockFrame, width, height, baseConfig);

        expect(mockCtx.createLinearGradient).toHaveBeenCalled();
    });

    it('should handle different screen sizes', () => {
        const metrics: MetricItem[] = [
            { label: 'Distance', value: '5.2', unit: 'km' },
        ];

        // Test different aspect ratios
        renderLFrameLayout(mockCtx as any, metrics, mockFrame, 1280, 720, baseConfig);
        expect(mockCtx.fillText).toHaveBeenCalled();

        mockCtx = createMockContext();
        renderLFrameLayout(mockCtx as any, metrics, mockFrame, 3840, 2160, baseConfig);
        expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should calculate optimal font sizes', () => {
        const metrics: MetricItem[] = [
            { label: 'VeryLongLabel', value: '999.9', unit: 'km' },
            { label: 'Short', value: '5', unit: '' },
        ];
        const config: ExtendedOverlayConfig = {
            ...baseConfig,
            valueSizeMultiplier: 3,
        };

        renderLFrameLayout(mockCtx as any, metrics, mockFrame, width, height, config);

        // Should adjust font sizes to fit
        expect(mockCtx.font).toContain('px');
    });

});
