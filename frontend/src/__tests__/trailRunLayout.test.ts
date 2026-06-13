import { describe, it, expect, vi } from 'vitest';
import { renderTrailRunLayout } from '../modules/layouts/trailRunLayout';
import type { ExtendedOverlayConfig, TelemetryFrame } from '../core/types';

function createMockContext() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
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
    };
}

describe('trailRun layout', () => {
    it('draws the elevation trace and the fixed HR / GRADE / ELEVATION trio', () => {
        const ctx = createMockContext();
        const frame: TelemetryFrame = {
            timeOffset: 60,
            hr: 159,
            gradePercent: 27,
            elevationM: 2921,
            distanceKm: 0,
            elapsedTime: '00:01:00',
            movingTimeSeconds: 60,
        };
        const config: ExtendedOverlayConfig = {
            templateId: 'trail-run',
            layoutMode: 'trail-run',
            position: 'top-left',
            backgroundOpacity: 0,
            fontSizePercent: 2.4,
            showHr: true,
            showPace: false,
            showDistance: false,
            showTime: false,
            showSpeed: false,
            showGrade: true,
            showElevation: true,
            showCadence: false,
            showPower: false,
            fontFamily: 'Inter, sans-serif',
            textColor: '#FFFFFF',
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderColor: 'transparent',
            cornerRadius: 0,
            textShadow: true,
            textShadowColor: 'rgba(0,0,0,0.7)',
            textShadowBlur: 4,
            lineSpacing: 1,
            layout: 'horizontal',
            iconStyle: 'none',
            gradientBackground: false,
            gradientStartColor: 'transparent',
            gradientEndColor: 'transparent',
            labelStyle: 'uppercase',
            valueFontWeight: 'light',
            valueSizeMultiplier: 2.6,
            labelSizeMultiplier: 0.32,
            labelLetterSpacing: 0.12,
            accentColor: '#FF3B30',
        };

        renderTrailRunLayout(ctx as any, frame, 1080, 1920, config, {
            hrHistory: [148, 150, 152, 155, 159],
            elevationHistory: [2900, 2905, 2910, 2915, 2921],
        });

        expect(ctx.bezierCurveTo).toHaveBeenCalled();
        expect(ctx.arc).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith('Elevation', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('HR', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('GRADE', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('ELEVATION', expect.any(Number), expect.any(Number));
    });
});
