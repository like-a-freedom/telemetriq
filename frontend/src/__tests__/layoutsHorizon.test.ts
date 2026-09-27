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
