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
        expect(mockCtx.fillText.mock.calls.map(([text]) => text)).toEqual([
            'D', 'I', 'S', 'T', 'A', 'N', 'C', 'E', '5.2', 'km',
            'P', 'A', 'C', 'E', '5:30', '/km',
            'H', 'R', '140', 'bpm',
        ]);
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

        const drawAt = (w: number, h: number) => {
            mockCtx = createMockContext();
            renderLFrameLayout(mockCtx as any, metrics, mockFrame, w, h, baseConfig);
            const valueCall = mockCtx.fillText.mock.calls.find(([text]) => text === '5.2')!;
            const frameStart = mockCtx.moveTo.mock.calls[0]!;
            return {
                x: Number(valueCall[1]),
                y: Number(valueCall[2]),
                frameX: Number(frameStart[0]),
            };
        };

        const small = drawAt(1280, 720);
        const large = drawAt(3840, 2160);

        // Values are horizontally centered and anchored to the bottom strip at every size.
        expect(small.x).toBeCloseTo(1280 / 2, 3);
        expect(large.x).toBeCloseTo(3840 / 2, 3);
        expect(small.y).toBeGreaterThan(720 / 2);
        expect(large.y).toBeGreaterThan(2160 / 2);

        // Coordinates scale with the short side (both sizes share the 16:9 ratio).
        expect(small.x).not.toBe(large.x);
        expect(small.y).not.toBe(large.y);
        expect(large.y / small.y).toBeCloseTo(3, 2);
        expect(large.frameX / small.frameX).toBeCloseTo(3, 2);
    });

    it('scales the value font size with valueSizeMultiplier', () => {
        const metrics: MetricItem[] = [
            { label: 'VeryLongLabel', value: '999.9', unit: 'km' },
            { label: 'Short', value: '5', unit: '' },
        ];

        const drawnValueFontPx = (valueSizeMultiplier?: number) => {
            mockCtx = createMockContext();
            let fontAtValue = '';
            mockCtx.fillText.mockImplementation((text: string) => {
                if (text === '999.9') fontAtValue = mockCtx.font;
            });
            const config: ExtendedOverlayConfig = valueSizeMultiplier === undefined
                ? baseConfig
                : { ...baseConfig, valueSizeMultiplier };
            renderLFrameLayout(mockCtx as any, metrics, mockFrame, width, height, config);
            return Number.parseFloat(fontAtValue.match(/([\d.]+)px/)?.[1] ?? '0');
        };

        // lframeLayout.ts: min(shortSide * 0.065 * sizeScale * valueScale, h * 0.13 / rows)
        const expectedValueFontPx = (valueSizeMultiplier: number) => {
            const sizeScale = (baseConfig.fontSizePercent ?? 2) / 2;
            const valueScale = Math.min(2, Math.max(0.5, valueSizeMultiplier / 3));
            return Math.min(1080 * 0.065 * sizeScale * valueScale, (height * 0.13) / 1);
        };

        // The template default (2.5) must render smaller than the configured multiplier of 3.
        expect(drawnValueFontPx(3)).toBeCloseTo(expectedValueFontPx(3), 5);
        expect(drawnValueFontPx(3)).toBeGreaterThan(drawnValueFontPx(undefined)!);
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
