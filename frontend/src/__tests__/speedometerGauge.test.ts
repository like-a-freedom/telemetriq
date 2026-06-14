import { describe, it, expect, vi } from 'vitest';
import { drawSpeedometerGauge } from '../modules/layouts/speedometerGauge';

function createGaugeContext() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: vi.fn(),
        fillText: vi.fn(),
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'round',
        textAlign: 'center',
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
        shadowColor: '',
        shadowBlur: 0,
    };
}

describe('speedometerGauge', () => {
    it('pads speed to three digits and draws the unit label', () => {
        const ctx = createGaugeContext();

        drawSpeedometerGauge(ctx as any, {
            cx: 90,
            cy: 90,
            diameter: 180,
            speedKmh: 54,
            maxSpeed: 60,
        });

        expect(ctx.fillText).toHaveBeenCalledWith('054', expect.any(Number), expect.any(Number));
        expect(ctx.fillText).toHaveBeenCalledWith('km/h', expect.any(Number), expect.any(Number));
        expect(ctx.arc).toHaveBeenCalled();
    });
});
