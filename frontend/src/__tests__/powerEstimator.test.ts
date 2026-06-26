import { describe, it, expect } from 'vitest';
import {
    estimateRunningPower,
    hasNativePowerData,
    preparePointsWithPower,
} from '../modules/telemetry/powerEstimator';
import type { TrackPoint } from '../core/types';

function makePoint(overrides: Partial<TrackPoint> & { lat: number; lon: number; time: Date }): TrackPoint {
    return { ...overrides } as TrackPoint;
}

function time(dateStr: string): Date {
    return new Date(dateStr);
}

function makeFlatTrack(count: number, startLat = 55.75, startLon = 37.62): TrackPoint[] {
    const points: TrackPoint[] = [];
    for (let i = 0; i < count; i++) {
        points.push(makePoint({
            lat: startLat + i * 0.0001,
            lon: startLon,
            time: time(`2024-01-01T00:00:${String(i * 5).padStart(2, '0')}Z`),
        }));
    }
    return points;
}

function makeUphillTrack(count: number): TrackPoint[] {
    const points: TrackPoint[] = [];
    for (let i = 0; i < count; i++) {
        points.push(makePoint({
            lat: 55.75 + i * 0.0001,
            lon: 37.62,
            ele: 100 + i * 10,
            time: time(`2024-01-01T00:00:${String(i * 5).padStart(2, '0')}Z`),
        }));
    }
    return points;
}

function makeDownhillTrack(count: number): TrackPoint[] {
    const points: TrackPoint[] = [];
    for (let i = 0; i < count; i++) {
        points.push(makePoint({
            lat: 55.75 + i * 0.0001,
            lon: 37.62,
            ele: 500 - i * 10,
            time: time(`2024-01-01T00:00:${String(i * 5).padStart(2, '0')}Z`),
        }));
    }
    return points;
}

describe('powerEstimator', () => {
    describe('estimateRunningPower', () => {
        it('returns all undefined for fewer than 2 points', () => {
            const result = estimateRunningPower([], 75);
            expect(result).toEqual([]);

            const single = [makePoint({ lat: 55.75, lon: 37.62, time: time('2024-01-01T00:00:00Z') })];
            const resultSingle = estimateRunningPower(single, 75);
            expect(resultSingle).toEqual([undefined]);
        });

        it('returns all undefined for weightKg <= 0', () => {
            const points = makeFlatTrack(5);
            expect(estimateRunningPower(points, 0)).toEqual(points.map(() => undefined));
            expect(estimateRunningPower(points, -75)).toEqual(points.map(() => undefined));
        });

        it('first point may get a value from median filter window', () => {
            const points = makeFlatTrack(10);
            const result = estimateRunningPower(points, 75);
            expect(result).toHaveLength(10);
            // The first point starts as undefined in raw calculation but the
            // median filter (window=5) can back-fill it from neighbors
        });

        it('skips points with dt <= 0 (same or reversed timestamp)', () => {
            const points = [
                makePoint({ lat: 55.75, lon: 37.62, time: time('2024-01-01T00:00:05Z') }),
                makePoint({ lat: 55.751, lon: 37.62, time: time('2024-01-01T00:00:05Z') }),
                makePoint({ lat: 55.752, lon: 37.62, time: time('2024-01-01T00:00:00Z') }),
            ];
            const result = estimateRunningPower(points, 75);
            expect(result[1]).toBeUndefined();
            expect(result[2]).toBeUndefined();
        });

        it('skips points with dt > 300 (sparse gap)', () => {
            const points = [
                makePoint({ lat: 55.75, lon: 37.62, time: time('2024-01-01T00:00:00Z') }),
                makePoint({ lat: 55.751, lon: 37.62, time: time('2024-01-01T00:10:00Z') }),
            ];
            const result = estimateRunningPower(points, 75);
            expect(result[1]).toBeUndefined();
        });

        it('skips points with speed < 0.1 m/s (nearly stationary)', () => {
            const points = [
                makePoint({ lat: 55.75, lon: 37.62, time: time('2024-01-01T00:00:00Z') }),
                makePoint({ lat: 55.75, lon: 37.62, time: time('2024-01-01T00:00:05Z') }),
            ];
            const result = estimateRunningPower(points, 75);
            expect(result[1]).toBeUndefined();
        });

        it('produces positive power for flat running', () => {
            const points = makeFlatTrack(10);
            const result = estimateRunningPower(points, 75);
            const defined = result.filter((v) => v !== undefined) as number[];
            expect(defined.length).toBeGreaterThan(0);
            defined.forEach((v) => {
                expect(v).toBeGreaterThan(0);
            });
        });

        it('produces higher power on uphill vs flat', () => {
            const flatPoints = makeFlatTrack(10);
            const uphillPoints = makeUphillTrack(10);

            const flatResult = estimateRunningPower(flatPoints, 75);
            const uphillResult = estimateRunningPower(uphillPoints, 75);

            const flatDefined = flatResult.filter((v) => v !== undefined) as number[];
            const uphillDefined = uphillResult.filter((v) => v !== undefined) as number[];

            expect(flatDefined.length).toBeGreaterThan(0);
            expect(uphillDefined.length).toBeGreaterThan(0);

            const avgFlat = flatDefined.reduce((a, b) => a + b, 0) / flatDefined.length;
            const avgUphill = uphillDefined.reduce((a, b) => a + b, 0) / uphillDefined.length;
            expect(avgUphill).toBeGreaterThan(avgFlat);
        });

        it('produces lower power on downhill vs flat', () => {
            const flatPoints = makeFlatTrack(10);
            const downhillPoints = makeDownhillTrack(10);

            const flatResult = estimateRunningPower(flatPoints, 75);
            const downhillResult = estimateRunningPower(downhillPoints, 75);

            const flatDefined = flatResult.filter((v) => v !== undefined) as number[];
            const downhillDefined = downhillResult.filter((v) => v !== undefined) as number[];

            expect(flatDefined.length).toBeGreaterThan(0);
            expect(downhillDefined.length).toBeGreaterThan(0);

            const avgFlat = flatDefined.reduce((a, b) => a + b, 0) / flatDefined.length;
            const avgDownhill = downhillDefined.reduce((a, b) => a + b, 0) / downhillDefined.length;
            expect(avgDownhill).toBeLessThan(avgFlat);
        });

        it('output values are integers (rounded)', () => {
            const points = makeFlatTrack(10);
            const result = estimateRunningPower(points, 75);
            result.forEach((v) => {
                if (v !== undefined) {
                    expect(v).toBe(Math.round(v));
                }
            });
        });

        it('output length matches input length', () => {
            const points = makeFlatTrack(15);
            const result = estimateRunningPower(points, 75);
            expect(result).toHaveLength(15);
        });

        it('handles points without elevation (ele undefined)', () => {
            const points = makeFlatTrack(10);
            points.forEach((p) => delete p.ele);
            const result = estimateRunningPower(points, 75);
            const defined = result.filter((v) => v !== undefined) as number[];
            expect(defined.length).toBeGreaterThan(0);
            defined.forEach((v) => {
                expect(v).toBeGreaterThan(0);
            });
        });

        it('handles heavier runner producing more power on uphill', () => {
            const lightPoints = makeUphillTrack(10);
            const heavyPoints = makeUphillTrack(10);

            const lightResult = estimateRunningPower(lightPoints, 60);
            const heavyResult = estimateRunningPower(heavyPoints, 90);

            const lightDefined = lightResult.filter((v) => v !== undefined) as number[];
            const heavyDefined = heavyResult.filter((v) => v !== undefined) as number[];

            expect(lightDefined.length).toBeGreaterThan(0);
            expect(heavyDefined.length).toBeGreaterThan(0);

            const avgLight = lightDefined.reduce((a, b) => a + b, 0) / lightDefined.length;
            const avgHeavy = heavyDefined.reduce((a, b) => a + b, 0) / heavyDefined.length;
            expect(avgHeavy).toBeGreaterThan(avgLight);
        });
    });

    describe('hasNativePowerData', () => {
        it('returns true when any point has power', () => {
            const points = [
                makePoint({ lat: 55.75, lon: 37.62, time: time('2024-01-01T00:00:00Z') }),
                makePoint({ lat: 55.751, lon: 37.62, time: time('2024-01-01T00:00:05Z'), power: 250 }),
            ];
            expect(hasNativePowerData(points)).toBe(true);
        });

        it('returns false when no points have power', () => {
            const points = makeFlatTrack(5);
            expect(hasNativePowerData(points)).toBe(false);
        });

        it('returns false for empty array', () => {
            expect(hasNativePowerData([])).toBe(false);
        });
    });

    describe('preparePointsWithPower', () => {
        it('returns original array when native power exists', () => {
            const points = [
                makePoint({ lat: 55.75, lon: 37.62, time: time('2024-01-01T00:00:00Z'), power: 200 }),
            ];
            const result = preparePointsWithPower(points, 75);
            expect(result).toBe(points);
        });

        it('returns original array when weightKg is null', () => {
            const points = makeFlatTrack(5);
            const result = preparePointsWithPower(points, null);
            expect(result).toBe(points);
        });

        it('returns original array when weightKg <= 0', () => {
            const points = makeFlatTrack(5);
            expect(preparePointsWithPower(points, 0)).toBe(points);
            expect(preparePointsWithPower(points, -75)).toBe(points);
        });

        it('returns new array with estimated power injected', () => {
            const points = makeFlatTrack(10);
            const result = preparePointsWithPower(points, 75);
            expect(result).not.toBe(points);
            expect(result).toHaveLength(10);
        });

        it('does not mutate original array', () => {
            const points = makeFlatTrack(10);
            const originalFirst = { ...points[0] };
            preparePointsWithPower(points, 75);
            expect(points[0]).toEqual(originalFirst);
        });

        it('preserves points where estimation failed', () => {
            const singlePoint = [makePoint({ lat: 55.75, lon: 37.62, time: time('2024-01-01T00:00:00Z') })];
            const result = preparePointsWithPower(singlePoint, 75);
            expect(result[0]).toEqual(singlePoint[0]);
        });
    });
});
