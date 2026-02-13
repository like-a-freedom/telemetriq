/**
 * Unit tests for lframe-layout and margin-layout modules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderLFrameLayout } from '../modules/layouts/lframe-layout';
import { renderMarginLayout } from '../modules/layouts/margin-layout';
import type { MetricItem } from '../modules/overlay-renderer';
import type { ExtendedOverlayConfig } from '../core/types';

describe('layout modules - additional', () => {
    let mockCtx: any;

    const createMockContext = (): any => ({
        createLinearGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
        fillStyle: '',
        fillRect: vi.fn(),
        strokeStyle: '',
        stroke: vi.fn(),
        beginPath: vi.fn(),
        fill: vi.fn(),
        font: '',
        fillText: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
        textAlign: 'left',
        textBaseline: 'alphabetic',
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        clearRect: vi.fn(),
        shadowColor: '',
        shadowBlur: 0,
    });

    const sampleMetrics: MetricItem[] = [
        { label: 'Heart Rate', value: '165', unit: 'bpm' },
        { label: 'Pace', value: '5:30', unit: 'min/km' },
        { label: 'Distance', value: '12.4', unit: 'km' },
    ];

    beforeEach(() => {
        mockCtx = createMockContext();
        vi.stubGlobal('CanvasRenderingContext2D', mockCtx);
    });

    describe('renderLFrameLayout', () => {
        const lFrameConfig: ExtendedOverlayConfig = {
            templateId: 'l-frame',
            layoutMode: 'corner-frame',
            position: 'bottom-left',
            backgroundOpacity: 0.6,
            fontSizePercent: 2.0,
            fontFamily: 'Inter, sans-serif',
            textColor: '#FFFFFF',
            valueFontWeight: 'light',
            valueSizeMultiplier: 3.0,
            labelLetterSpacing: 0.15,
            showHr: true,
            showPace: true,
            showDistance: true,
            showTime: true,
        };

        it('should render without throwing', () => {
            expect(() => {
                renderLFrameLayout(mockCtx, sampleMetrics, {} as any, 1920, 1080, lFrameConfig);
            }).not.toThrow();
        });

        it('should create bottom gradient', () => {
            renderLFrameLayout(mockCtx, sampleMetrics, {} as any, 1920, 1080, lFrameConfig);
            expect(mockCtx.createLinearGradient).toHaveBeenCalled();
        });

        it('should draw progress bar and bottom shapes', () => {
            renderLFrameLayout(mockCtx, sampleMetrics, {} as any, 1920, 1080, lFrameConfig);
            // implementation draws bottom gradient and progress bar via fillRect
            expect(mockCtx.createLinearGradient).toHaveBeenCalled();
            expect(mockCtx.fillRect).toHaveBeenCalled();
        });

        it('should handle empty metrics gracefully', () => {
            expect(() => {
                renderLFrameLayout(mockCtx, [], {} as any, 1920, 1080, lFrameConfig);
            }).not.toThrow();
        });
    });

    describe('renderMarginLayout', () => {
        const marginConfig: ExtendedOverlayConfig = {
            templateId: 'margin',
            layoutMode: 'side-margins',
            position: 'bottom-left',
            fontSizePercent: 2.0,
            fontFamily: 'Inter, sans-serif',
            textColor: '#FFFFFF',
            valueFontWeight: 'light',
            valueSizeMultiplier: 3.5,
            backgroundOpacity: 0.6,
            showHr: true,
            showPace: true,
            showDistance: true,
            showTime: true,
        };

        it('should render without throwing', () => {
            expect(() => {
                renderMarginLayout(mockCtx, sampleMetrics, 1920, 1080, marginConfig);
            }).not.toThrow();
        });

        it('should draw edge gradients', () => {
            renderMarginLayout(mockCtx, sampleMetrics, 1920, 1080, marginConfig);
            expect(mockCtx.createLinearGradient).toHaveBeenCalledTimes(2);
        });

        it('should render left and right side metrics', () => {
            renderMarginLayout(mockCtx, sampleMetrics, 1920, 1080, marginConfig);
            expect(mockCtx.fillText).toHaveBeenCalled();
        });

        it('should handle single metric', () => {
            const singleMetric = [sampleMetrics[0]!];
            expect(() => {
                renderMarginLayout(mockCtx, singleMetric, 1920, 1080, marginConfig);
            }).not.toThrow();
        });

        it('should rotate labels for left side', () => {
            renderMarginLayout(mockCtx, sampleMetrics, 1920, 1080, marginConfig);
            expect(mockCtx.save).toHaveBeenCalled();
            expect(mockCtx.rotate).toHaveBeenCalledWith(-Math.PI / 2);
        });
    });
});
