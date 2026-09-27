import { describe, it, expect, vi } from 'vitest';
import { renderCyclingProLayout } from '../modules/layouts/cyclingProLayout';
import { getTemplateConfig } from '../modules/templateConfigs';
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
            showCadence: false,
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

        expect(ctx.fillText).not.toHaveBeenCalledWith('Cadence', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('POWER', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('HEART RATE', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('054', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('km/h', expect.any(Number), expect.any(Number));
    });

    it('does not render sidebar metrics when data is missing', () => {
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
            showCadence: false,
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

        expect(ctx.fillText).toHaveBeenCalledWith('HEART RATE', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).not.toHaveBeenCalledWith('Cadence', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).not.toHaveBeenCalledWith('POWER', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).not.toHaveBeenCalledWith('N/A', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).not.toHaveBeenCalledWith('NO SENSOR', expect.any(Number), expect.any(Number));
    });

    it.each([[1920, 1080], [1080, 1920], [640, 360], [360, 640], [320, 180], [884, 151]])(
        'keeps values and speed dial inside %ix%i without a large dark fill', (width, height) => {
            const ctx = createMockContext();
            const text: { value: string; x: number; y: number; width: number; align: string }[] = [];
            ctx.fillText.mockImplementation((value: string, x: number, y: number) => {
                const textWidth = ctx.measureText(value).width;
                text.push({ value, x, y, width: textWidth, align: ctx.textAlign });
            });

            renderCyclingProLayout(ctx as any, {
                timeOffset: 60,
                hr: 199,
                powerWatts: 1999,
                speedKmh: 99,
                distanceKm: 12345.6,
                elapsedTime: '01:21:00',
                movingTimeSeconds: 60,
            }, width, height, getTemplateConfig('cycling-pro'));

            expect(text.map(entry => entry.value)).toEqual(expect.arrayContaining([
                'POWER', '1999', 'HEART RATE', '199', 'DISTANCE', '12345.6', 'KM', '099', 'km/h',
            ]));
            for (const entry of text) {
                const left = entry.align === 'center' ? entry.x - entry.width / 2 : entry.x;
                expect(left).toBeGreaterThanOrEqual(-2);
                expect(left + entry.width).toBeLessThanOrEqual(width + 2);
                expect(entry.y).toBeGreaterThan(0);
                expect(entry.y).toBeLessThan(height);
            }
            for (const [, , radius] of ctx.arc.mock.calls) {
                expect(radius).toBeGreaterThan(0);
            }
            expect(ctx.fillRect.mock.calls.every(([, , , rectHeight]) => rectHeight <= 3)).toBe(true);
        },
    );

    it('does not show a zero-speed dial when speed data is missing', () => {
        const ctx = createMockContext();
        renderCyclingProLayout(ctx as any, {
            timeOffset: 60,
            distanceKm: 4.2,
            elapsedTime: '00:01:00',
            movingTimeSeconds: 60,
        }, 640, 360, getTemplateConfig('cycling-pro'));

        expect(ctx.arc).not.toHaveBeenCalled();
        expect(ctx.fillText).not.toHaveBeenCalledWith('000', expect.any(Number), expect.any(Number));
    });
});
