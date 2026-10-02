import { describe, it, expect, vi } from 'vitest';
import { getTemplateConfig } from '../modules/templateConfigs';
import { renderTrailRunLayout } from '../modules/layouts/trailRunLayout';
import type { ExtendedOverlayConfig, TelemetryFrame } from '../core/types';

function createMockContext() {
    let currentFont = '';
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
        strokeText: vi.fn(),
        fillRect: vi.fn(),
        measureText: vi.fn((text: string) => {
            const size = Number(currentFont.match(/([\d.]+)px/)?.[1] ?? 16);
            return { width: text.length * size * 0.48 };
        }),
        get font() {
            return currentFont;
        },
        set font(value: string) {
            currentFont = value;
        },
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left',
        textBaseline: 'alphabetic',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        letterSpacing: '0px',
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
        expect(ctx.fillText).toHaveBeenCalledWith('ELEVATION', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('HR', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('GRADE', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('ELEVATION', expect.any(Number), expect.any(Number));
    });
    it.each([[1920, 1080], [1080, 1920], [640, 360], [360, 640]])(
        'keeps labels separate from sharp elevation peaks at %ix%i', (width, height) => {
            const ctx = createMockContext();
            const text: { value: string; y: number; font: string }[] = [];
            ctx.fillText.mockImplementation((value: string, _x: number, y: number) => {
                text.push({ value, y, font: ctx.font });
            });
            const frame: TelemetryFrame = {
                timeOffset: 60, hr: 159, paceSecondsPerKm: 321,
                gradePercent: 27, elevationM: 2921, distanceKm: 12.34,
                elapsedTime: '01:21:00', movingTimeSeconds: 60,
            };
            renderTrailRunLayout(ctx as any, frame, width, height, getTemplateConfig('trail-run'), {
                elevationHistory: [3000, 3000, 1000, 3000, 1000, 1000, 3000],
            });
            const title = text[0]!;
            const labels = text.filter(entry => ['PACE', 'HR', 'DISTANCE', 'TIME', 'GRADE', 'ELEVATION'].includes(entry.value));
            expect(title.value).toBe('ELEVATION PROFILE');
            expect(new Set(labels.map(entry => entry.font)).size).toBe(1);
            const labelSize = Number(title.font.match(/([\d.]+)px/)![1]);
            const metricLabelSize = Number(labels[0]!.font.match(/([\d.]+)px/)![1]);
            const firstMetricLabelTop = labels[0]!.y - metricLabelSize;
            for (const [, y1, , y2, , y3] of ctx.bezierCurveTo.mock.calls) {
                for (const y of [y1, y2, y3]) {
                    expect(y).toBeGreaterThan(title.y + labelSize * 0.35);
                    expect(y).toBeLessThan(firstMetricLabelTop);
                }
            }
            for (const [, y, radius] of ctx.arc.mock.calls) {
                expect(y - radius).toBeGreaterThan(title.y);
                expect(y + radius).toBeLessThan(firstMetricLabelTop);
            }
            const heartRate = text.find(entry => entry.value === '159')!;
            expect(text.find(entry => entry.value === 'bpm')!.y).toBeLessThan(heartRate.y);
        },
    );

    it.each([[1920, 1080], [1080, 1920], [640, 360], [360, 640], [320, 180], [884, 151]])(
        'fits every enabled metric inside %ix%i without tinting the footage', (width, height) => {
            const ctx = createMockContext();
            const drawCalls: { value: string; x: number; y: number; width: number; align: string }[] = [];
            ctx.fillText.mockImplementation((value: string, x: number, y: number) => {
                const fontSize = Number(ctx.font.match(/([\d.]+)px/)?.[1] ?? 16);
                drawCalls.push({
                    value,
                    x,
                    y,
                    width: value.length * fontSize * 0.48,
                    align: ctx.textAlign,
                });
            });
            const config = {
                ...getTemplateConfig('trail-run'),
                showPower: true,
                fontSizePercent: 8,
                valueSizeMultiplier: 4,
                labelLetterSpacing: 0.12,
            };
            renderTrailRunLayout(ctx as any, {
                timeOffset: 60,
                hr: 199,
                paceSecondsPerKm: 359.6,
                gradePercent: -27,
                elevationM: 12921,
                distanceKm: 12345.6,
                elapsedTime: '123:59:59',
                powerWatts: 1999,
                movingTimeSeconds: 60,
            }, width, height, config, { elevationHistory: [1000, 1700, 800, 1500, 900] });

            expect(drawCalls.map(call => call.value)).toEqual(expect.arrayContaining([
                'ELEVATION PROFILE', 'PACE', 'HR', 'DISTANCE', 'TIME', 'GRADE', 'ELEVATION', 'POWER', '6:00',
            ]));
            for (const call of drawCalls) {
                const left = call.align === 'center' ? call.x - call.width / 2 : call.x;
                expect(left).toBeGreaterThanOrEqual(-1);
                expect(left + call.width).toBeLessThanOrEqual(width + 1);
                expect(call.y).toBeGreaterThan(0);
                expect(call.y).toBeLessThan(height);
            }
            expect(ctx.fillRect).not.toHaveBeenCalled();
        },
    );

    it('keeps the metric grid visible when the elevation history is unavailable', () => {
        const ctx = createMockContext();
        const drawn: { value: string; y: number }[] = [];
        ctx.fillText.mockImplementation((value: string, _x: number, y: number) => drawn.push({ value, y }));

        renderTrailRunLayout(ctx as any, {
            timeOffset: 60,
            hr: 159,
            distanceKm: 12.34,
            elapsedTime: '01:21:00',
            gradePercent: 2,
            elevationM: 2921,
            movingTimeSeconds: 60,
        }, 640, 360, getTemplateConfig('trail-run'), { elevationHistory: [] });

        expect(drawn.map(call => call.value)).toContain('HR');
        expect(drawn.map(call => call.value)).toContain('ELEVATION');
        expect(drawn.map(call => call.value)).not.toContain('ELEVATION PROFILE');
        expect(Math.min(...drawn.map(call => call.y))).toBeLessThan(40);
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('falls back to N/A when the elapsed label is not a paintable clock string', () => {
        const ctx = createMockContext();
        const drawn: string[] = [];
        ctx.fillText.mockImplementation((value: string) => {
            drawn.push(value);
        });

        renderTrailRunLayout(ctx as never, {
            timeOffset: 60,
            distanceKm: 1.2,
            elapsedTime: 'NaN:NaN',
            movingTimeSeconds: Number.NaN,
        }, 640, 360, {
            ...getTemplateConfig('trail-run'),
            showPace: false,
            showHr: false,
            showDistance: false,
            showTime: true,
            showGrade: false,
            showElevation: false,
            showPower: false,
        }, { elevationHistory: [] });

        expect(drawn).toContain('N/A');
        expect(drawn.some(value => /NaN|Infinity/.test(value))).toBe(false);
    });

});
