import { describe, it, expect, vi } from 'vitest';
import { renderCyclingProLayout } from '../modules/layouts/cyclingProLayout';
import type { ExtendedOverlayConfig, TelemetryFrame } from '../core/types';

function createMockContext() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        arc: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left',
        textBaseline: 'alphabetic',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        lineCap: 'round',
    };
}

describe('cyclingPro layout', () => {
    it('draws sidebar metrics, distance, and the lower-left speedometer', () => {
        const ctx = createMockContext();
        const frame: TelemetryFrame = {
            timeOffset: 60,
            hr: 130,
            cadenceRpm: 88,
            powerWatts: 308,
            speedKmh: 54,
            distanceKm: 16.9,
            elapsedTime: '00:01:00',
            movingTimeSeconds: 60,
        };
        const config: ExtendedOverlayConfig = {
            templateId: 'cycling-pro',
            layoutMode: 'cycling-pro',
            position: 'bottom-left',
            backgroundOpacity: 0,
            fontSizePercent: 2.2,
            showHr: true,
            showPace: false,
            showDistance: true,
            showTime: false,
            showSpeed: true,
            showGrade: false,
            showElevation: false,
            showCadence: true,
            showPower: true,
            fontFamily: 'Inter, sans-serif',
            textColor: '#FFFFFF',
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderColor: 'transparent',
            cornerRadius: 0,
            textShadow: true,
            textShadowColor: 'rgba(0,0,0,0.9)',
            textShadowBlur: 6,
            lineSpacing: 1,
            layout: 'vertical',
            iconStyle: 'none',
            gradientBackground: false,
            gradientStartColor: 'transparent',
            gradientEndColor: 'transparent',
            labelStyle: 'uppercase',
            valueFontWeight: 'normal',
            valueSizeMultiplier: 2.1,
            labelSizeMultiplier: 0.32,
            labelLetterSpacing: 0.05,
            accentColor: '#00E676',
        };

        renderCyclingProLayout(ctx as any, frame, 1080, 1920, config);

        expect(ctx.fillText).toHaveBeenCalledWith('Cadence', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('Power', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('Heart rate', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('054', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('KM/h', expect.any(Number), expect.any(Number));
    });

    it('does not render unavailable metrics for missing cadence and power data', () => {
        const ctx = createMockContext();
        const frame: TelemetryFrame = {
            timeOffset: 60,
            hr: 130,
            speedKmh: 36,
            distanceKm: 4.2,
            elapsedTime: '00:01:00',
            movingTimeSeconds: 60,
        };
        const config: ExtendedOverlayConfig = {
            templateId: 'cycling-pro',
            layoutMode: 'cycling-pro',
            position: 'bottom-left',
            backgroundOpacity: 0,
            fontSizePercent: 2.2,
            showHr: true,
            showPace: false,
            showDistance: true,
            showTime: false,
            showSpeed: true,
            showGrade: false,
            showElevation: false,
            showCadence: true,
            showPower: true,
            fontFamily: 'Inter, sans-serif',
            textColor: '#FFFFFF',
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderColor: 'transparent',
            cornerRadius: 0,
            textShadow: true,
            textShadowColor: 'rgba(0,0,0,0.9)',
            textShadowBlur: 6,
            lineSpacing: 1,
            layout: 'vertical',
            iconStyle: 'none',
            gradientBackground: false,
            gradientStartColor: 'transparent',
            gradientEndColor: 'transparent',
            labelStyle: 'uppercase',
            valueFontWeight: 'normal',
            valueSizeMultiplier: 2.1,
            labelSizeMultiplier: 0.32,
            labelLetterSpacing: 0.05,
            accentColor: '#00E676',
        };

        renderCyclingProLayout(ctx as any, frame, 1080, 1920, config);

        // Only HR should be rendered as a sidebar metric (cadence and power are unavailable)
        expect(ctx.fillText).toHaveBeenCalledWith('Heart rate', expect.any(Number), expect.any(Number));
        // Cadence and Power should not be rendered
        expect(ctx.fillText).not.toHaveBeenCalledWith('Cadence', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).not.toHaveBeenCalledWith('Power', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).not.toHaveBeenCalledWith('N/A', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).not.toHaveBeenCalledWith('NO SENSOR', expect.any(Number), expect.any(Number));
    });
});
