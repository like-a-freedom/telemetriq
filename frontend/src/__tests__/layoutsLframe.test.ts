import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderLFrameLayout } from '../modules/layouts/lframeLayout';
import { DEFAULT_OVERLAY_CONFIG } from '../modules/overlayRenderer';
import type { MetricItem } from '../core/types';
import type { ExtendedOverlayConfig, TelemetryFrame } from '../core/types';

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
        shadowOffsetX: 0,
        shadowOffsetY: 0,
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
        ...DEFAULT_OVERLAY_CONFIG,
        templateId: 'lframe',
        position: 'bottom-left',
        fontSizePercent: 2,
        textColor: '#FFFFFF',
        backgroundOpacity: 0.7,
        labelStyle: 'uppercase',
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

    it('draws a corner frame without a backdrop or fake progress fill', () => {
        const metrics: MetricItem[] = [{ label: 'Test', value: '10', unit: '' }];

        renderLFrameLayout(mockCtx as any, metrics, mockFrame, width, height, {
            ...baseConfig,
            textShadow: true,
        });

        expect(mockCtx.createLinearGradient).not.toHaveBeenCalled();
        expect(mockCtx.fillRect).not.toHaveBeenCalled();
        expect(mockCtx.moveTo).toHaveBeenCalledTimes(1);
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(2);
        expect(mockCtx.stroke).toHaveBeenCalledTimes(1);
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

    it('applies value and label size multipliers', () => {
        const metric: MetricItem[] = [{ label: 'Pace', value: '5:30', unit: 'km' }];
        const normalConfig: ExtendedOverlayConfig = {
            ...baseConfig,
            valueSizeMultiplier: 3,
            labelSizeMultiplier: 0.52,
        };
        let normalValueFont = '';
        let normalLabelFont = '';
        mockCtx.fillText.mockImplementation((text: string) => {
            if (text === '5:30') normalValueFont = mockCtx.font;
            if (text === 'P') normalLabelFont = mockCtx.font;
        });
        renderLFrameLayout(mockCtx as any, metric, mockFrame, width, height, normalConfig);

        mockCtx = createMockContext();
        let largerValueFont = '';
        let largerLabelFont = '';
        mockCtx.fillText.mockImplementation((text: string) => {
            if (text === '5:30') largerValueFont = mockCtx.font;
            if (text === 'P') largerLabelFont = mockCtx.font;
        });
        renderLFrameLayout(mockCtx as any, metric, mockFrame, width, height, {
            ...normalConfig,
            valueSizeMultiplier: 6,
            labelSizeMultiplier: 0.78,
        });

        const fontSize = (font: string) => Number.parseFloat(font.match(/[\d.]+px/)?.[0] ?? '0');
        expect(fontSize(largerValueFont)).toBeGreaterThan(fontSize(normalValueFont));
        expect(fontSize(largerLabelFont)).toBeGreaterThan(fontSize(normalLabelFont));
    });

    it('tracks uppercase labels and hides them when configured', () => {
        const metric: MetricItem[] = [{ label: 'Pace', value: '5:30', unit: 'min/km' }];
        renderLFrameLayout(mockCtx as any, metric, mockFrame, width, height, {
            ...baseConfig,
            labelLetterSpacing: 0.12,
        });
        const labelCalls = mockCtx.fillText.mock.calls.filter(([text]) => ['P', 'A', 'C', 'E'].includes(String(text)));
        expect(labelCalls).toHaveLength(4);
        expect(Number(labelCalls[1]![1]) - Number(labelCalls[0]![1])).toBeGreaterThan(10);

        mockCtx = createMockContext();
        renderLFrameLayout(mockCtx as any, metric, mockFrame, width, height, {
            ...baseConfig,
            labelStyle: 'hidden',
        });
        expect(mockCtx.fillText.mock.calls.map(([text]) => text)).toEqual(['5:30', 'min/km']);
    });

});
