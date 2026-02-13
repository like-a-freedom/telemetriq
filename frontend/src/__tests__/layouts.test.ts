/**
 * Unit tests for layout rendering modules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderClassicLayout } from '../modules/layouts/classic-layout';
import { renderHorizonLayout } from '../modules/layouts/horizon-layout';
import type { MetricItem } from '../modules/overlay-renderer';
import type { ExtendedOverlayConfig } from '../core/types';

describe('layout modules', () => {
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
        roundRect: vi.fn(),
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

    const defaultConfig: ExtendedOverlayConfig = {
        templateId: 'classic',
        layoutMode: 'box',
        position: 'bottom-left',
        backgroundOpacity: 0.8,
        fontSizePercent: 2.0,
        showHr: true,
        showPace: true,
        showDistance: true,
        showTime: true,
        fontFamily: 'Inter, sans-serif',
        textColor: '#FFFFFF',
        backgroundColor: '#000000',
    };

    const sampleMetrics: MetricItem[] = [
        { label: 'Heart Rate', value: '165', unit: 'bpm' },
        { label: 'Pace', value: '5:30', unit: 'min/km' },
    ];

    beforeEach(() => {
        mockCtx = createMockContext();
        vi.stubGlobal('CanvasRenderingContext2D', mockCtx);
    });

    describe('renderClassicLayout', () => {
        it('should render without throwing', () => {
            expect(() => {
                renderClassicLayout(mockCtx, sampleMetrics, 1920, 1080, defaultConfig);
            }).not.toThrow();
        });

        it('should save and restore context', () => {
            renderClassicLayout(mockCtx, sampleMetrics, 1920, 1080, defaultConfig);
            expect(mockCtx.save).toHaveBeenCalled();
            expect(mockCtx.restore).toHaveBeenCalled();
        });

        it('should handle empty metrics', () => {
            expect(() => {
                renderClassicLayout(mockCtx, [], 1920, 1080, defaultConfig);
            }).not.toThrow();
        });

        it('should use gradient when gradientBackground is true', () => {
            const config = { ...defaultConfig, gradientBackground: true, gradientStartColor: 'rgba(0,0,0,0)', gradientEndColor: 'rgba(0,0,0,0.9)' };
            renderClassicLayout(mockCtx, sampleMetrics, 1920, 1080, config as ExtendedOverlayConfig);
            expect(mockCtx.createLinearGradient).toHaveBeenCalled();
        });

        it('should position overlay based on config.position', () => {
            const config = { ...defaultConfig, position: 'top-right' as const };
            expect(() => {
                renderClassicLayout(mockCtx, sampleMetrics, 1920, 1080, config as ExtendedOverlayConfig);
            }).not.toThrow();
        });
    });

    describe('renderHorizonLayout', () => {
        const horizonConfig: ExtendedOverlayConfig = {
            ...defaultConfig,
            templateId: 'horizon',
            layoutMode: 'bottom-bar',
            accentColor: '#ef4444',
        };

        it('should render without throwing', () => {
            expect(() => {
                renderHorizonLayout(mockCtx, sampleMetrics, 1920, 1080, horizonConfig);
            }).not.toThrow();
        });

        it('should save and restore context', () => {
            renderHorizonLayout(mockCtx, sampleMetrics, 1920, 1080, horizonConfig);
            expect(mockCtx.save).toHaveBeenCalled();
            expect(mockCtx.restore).toHaveBeenCalled();
        });

        it('should create gradient background', () => {
            renderHorizonLayout(mockCtx, sampleMetrics, 1920, 1080, horizonConfig);
            expect(mockCtx.createLinearGradient).toHaveBeenCalled();
        });

        it('should handle empty metrics', () => {
            expect(() => {
                renderHorizonLayout(mockCtx, [], 1920, 1080, horizonConfig);
            }).not.toThrow();
        });
    });
});
