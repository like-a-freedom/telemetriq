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

        // Pin the dial geometry for speedKmh 54 / maxSpeed 60 → progress 0.9.
        const startAngle = (135 * Math.PI) / 180;
        const sweep = (270 * Math.PI) / 180;
        const progress = 54 / 60;
        const endAngle = startAngle + sweep * progress;
        const ringRadius = 180 / 2 - Math.max(6, 180 * 0.12);

        // The unlit track spans the full 270° sweep.
        expect(ctx.arc).toHaveBeenCalledWith(90, 90, ringRadius, startAngle, startAngle + sweep);
        // The last warning segment ends exactly at the speed-derived angle.
        expect(ctx.arc).toHaveBeenCalledWith(
            90,
            90,
            ringRadius,
            startAngle + sweep * 0.88,
            startAngle + sweep * progress,
        );
        // The needle points from the dial center along that angle.
        const needleBase = ringRadius + 180 * 0.01;
        const needleTip = ringRadius + 180 * 0.075;
        expect(ctx.moveTo).toHaveBeenCalledWith(
            90 + Math.cos(endAngle) * needleBase,
            90 + Math.sin(endAngle) * needleBase,
        );
        expect(ctx.lineTo).toHaveBeenCalledWith(
            90 + Math.cos(endAngle + 0.12) * needleTip,
            90 + Math.sin(endAngle + 0.12) * needleTip,
        );
    });
});
