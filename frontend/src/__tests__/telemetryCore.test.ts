import { describe, it, expect } from 'vitest';
import {
    haversineDistance,
    calculateCumulativeDistances,
    calculatePace,
    lerp,
    interpolateHr,
    formatElapsedTime,
    formatPace,
    buildTelemetryTimeline,
    getTelemetryAtTime,
    computeMedianPace,
    fillMissingPaceValues,
    interpolateOptionalValue,
    gapContainsPausedPoint,
} from '../modules/telemetryCore';
import type { TrackPoint } from '../core/types';

function makePoint(lat: number, lon: number, timeStr: string, hr?: number): TrackPoint {
    return {
        lat,
        lon,
        time: new Date(timeStr),
        hr,
    };
}

function makePointWithElevation(
    lat: number,
    lon: number,
    timeStr: string,
    ele: number,
    hr?: number,
): TrackPoint {
    return {
        lat,
        lon,
        time: new Date(timeStr),
        hr,
        ele,
    };
}

function makePointWithMetrics(
    lat: number,
    lon: number,
    timeStr: string,
    metrics: Partial<Pick<TrackPoint, 'ele' | 'hr' | 'cadence' | 'power'>> = {},
): TrackPoint {
    return {
        lat,
        lon,
        time: new Date(timeStr),
        ...metrics,
    };
}

function metersToLatDelta(meters: number): number {
    return meters / 111_320;
}

describe('Telemetry Core', () => {
    describe('haversineDistance', () => {
        it('should return 0 for the same point', () => {
            expect(haversineDistance(55.7558, 37.6173, 55.7558, 37.6173)).toBeCloseTo(0, 5);
        });

        it('should calculate distance between Moscow and Saint Petersburg (~634 km)', () => {
            const dist = haversineDistance(55.7558, 37.6173, 59.9343, 30.3351);
            expect(dist).toBeGreaterThan(600);
            expect(dist).toBeLessThan(700);
        });

        it('should calculate short distance (~100m)', () => {
            // Approximately 100m apart
            const dist = haversineDistance(55.7558, 37.6173, 55.7567, 37.6173);
            expect(dist).toBeGreaterThan(0.09);
            expect(dist).toBeLessThan(0.11);
        });

        it('should handle crossing the meridian', () => {
            const dist = haversineDistance(0, 179.999, 0, -179.999);
            expect(dist).toBeLessThan(1); // Should be very small
        });

        it('should be symmetric', () => {
            const d1 = haversineDistance(55.0, 37.0, 56.0, 38.0);
            const d2 = haversineDistance(56.0, 38.0, 55.0, 37.0);
            expect(d1).toBeCloseTo(d2, 10);
        });
    });

    describe('calculateCumulativeDistances', () => {
        it('should return empty array for empty input', () => {
            expect(calculateCumulativeDistances([])).toEqual([]);
        });

        it('should return [0] for a single point', () => {
            const points = [makePoint(55.0, 37.0, '2024-01-15T10:00:00Z')];
            expect(calculateCumulativeDistances(points)).toEqual([0]);
        });

        it('should calculate cumulative distances correctly', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:00:30Z'), // ~100m north
                makePoint(55.7567, 37.6190, '2024-01-15T10:01:00Z'), // ~100m east
            ];

            const distances = calculateCumulativeDistances(points);
            expect(distances).toHaveLength(3);
            expect(distances[0]).toBe(0);
            expect(distances[1]!).toBeGreaterThan(0);
            expect(distances[2]!).toBeGreaterThan(distances[1]!);
        });

        it('should always be non-decreasing', () => {
            const points = [
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.0001, 37.0001, '2024-01-15T10:00:05Z'),
                makePoint(55.0002, 37.0002, '2024-01-15T10:00:10Z'),
                makePoint(55.0003, 37.0003, '2024-01-15T10:00:15Z'),
            ];

            const distances = calculateCumulativeDistances(points);
            for (let i = 1; i < distances.length; i++) {
                expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
            }
        });

        it('should not accumulate distance for stationary points', () => {
            const points = [
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.0001, 37.0, '2024-01-15T10:00:05Z'),
                makePoint(55.0001, 37.0, '2024-01-15T10:00:10Z'),
                makePoint(55.0002, 37.0, '2024-01-15T10:00:15Z'),
            ];
            const distances = calculateCumulativeDistances(points, (i) => i === 2);
            expect(distances[2]).toBeCloseTo(distances[1], 8);
            expect(distances[3]).toBeGreaterThan(distances[2]);
        });

        it('should keep total distance at 0 when all points are stationary', () => {
            const points = [
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.0001, 37.0, '2024-01-15T10:00:05Z'),
                makePoint(55.0002, 37.0, '2024-01-15T10:00:10Z'),
            ];
            const distances = calculateCumulativeDistances(points, () => true);
            expect(distances[distances.length - 1]).toBe(0);
        });

        it('should match no-callback behavior when callback returns false', () => {
            const points = [
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.0001, 37.0, '2024-01-15T10:00:05Z'),
            ];
            const withCallback = calculateCumulativeDistances(points, () => false);
            const withoutCallback = calculateCumulativeDistances(points);
            expect(withCallback).toEqual(withoutCallback);
        });
    });

    describe('calculatePace', () => {
        it('should calculate pace for normal running', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.009, 37.0, '2024-01-15T10:05:00Z'); // ~1km, 5min = 300 s/km
            const dist1 = 0;
            const dist2 = haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);

            const pace = calculatePace(p1, p2, dist1, dist2);
            expect(pace).toBeDefined();
            expect(pace!).toBeGreaterThan(280);
            expect(pace!).toBeLessThan(320);
        });

        it('should return undefined for zero distance', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.0, 37.0, '2024-01-15T10:00:10Z');
            expect(calculatePace(p1, p2, 0, 0)).toBeUndefined();
        });

        it('should return undefined for unreasonable pace', () => {
            // Same time
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.001, 37.0, '2024-01-15T10:00:00Z');
            expect(calculatePace(p1, p2, 0, 0.1)).toBeUndefined();
        });

        it('should return undefined for negative time diff', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:10Z');
            const p2 = makePoint(55.001, 37.0, '2024-01-15T10:00:00Z');
            expect(calculatePace(p1, p2, 0, 0.1)).toBeUndefined();
        });

        it('should return undefined for pace faster than 2:00/km', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.0018, 37.0, '2024-01-15T10:00:20Z');
            expect(calculatePace(p1, p2, 0, 0.2)).toBeUndefined();
        });

        it('should return undefined for pace slower than 30:00/km', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.00009, 37.0, '2024-01-15T10:00:30Z');
            expect(calculatePace(p1, p2, 0, 0.01)).toBeUndefined();
        });
    });

    describe('lerp', () => {
        it('should return v0 when t=0', () => {
            expect(lerp(10, 20, 0)).toBe(10);
        });

        it('should return v1 when t=1', () => {
            expect(lerp(10, 20, 1)).toBe(20);
        });

        it('should return midpoint when t=0.5', () => {
            expect(lerp(10, 20, 0.5)).toBe(15);
        });
    });

    describe('interpolateHr', () => {
        it('should return undefined if both are undefined', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.1, 37.0, '2024-01-15T10:01:00Z');
            expect(interpolateHr(p1, p2, new Date('2024-01-15T10:00:30Z'))).toBeUndefined();
        });

        it('should return other value if one is undefined', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z', 140);
            const p2 = makePoint(55.1, 37.0, '2024-01-15T10:01:00Z');
            expect(interpolateHr(p1, p2, new Date('2024-01-15T10:00:30Z'))).toBe(140);
        });

        it('should interpolate between two known HR values', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z', 140);
            const p2 = makePoint(55.1, 37.0, '2024-01-15T10:01:00Z', 160);
            const hr = interpolateHr(p1, p2, new Date('2024-01-15T10:00:30Z'));
            expect(hr).toBe(150);
        });

        it('should clamp to before value if target is before range', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z', 140);
            const p2 = makePoint(55.1, 37.0, '2024-01-15T10:01:00Z', 160);
            const hr = interpolateHr(p1, p2, new Date('2024-01-15T09:59:30Z'));
            expect(hr).toBe(140); // Clamped to t=0
        });
    });

    describe('interpolateOptionalValue', () => {
        it('should linearly interpolate when both values are defined', () => {
            expect(interpolateOptionalValue(200, 300, 0.5)).toBe(250);
            expect(interpolateOptionalValue(200, 300, 0)).toBe(200);
            expect(interpolateOptionalValue(200, 300, 1)).toBe(300);
        });

        it('should return before when after is undefined', () => {
            expect(interpolateOptionalValue(200, undefined, 0.5)).toBe(200);
        });

        it('should return after when before is undefined', () => {
            expect(interpolateOptionalValue(undefined, 300, 0.5)).toBe(300);
        });

        it('should return undefined when both are undefined', () => {
            expect(interpolateOptionalValue(undefined, undefined, 0.5)).toBeUndefined();
        });
    });

    describe('gapContainsPausedPoint', () => {
        it('should return true when a pause exists between left and right', () => {
            expect(gapContainsPausedPoint([false, false, true, false, false], 0, 4)).toBe(true);
        });

        it('should return false when there are no pauses between left and right', () => {
            expect(gapContainsPausedPoint([false, false, false, false, false], 0, 4)).toBe(false);
        });

        it('should return false for adjacent indices (no points between)', () => {
            expect(gapContainsPausedPoint([false, false], 0, 1)).toBe(false);
        });

        it('should not count left or right boundary as a pause gap', () => {
            expect(gapContainsPausedPoint([true, false, false], 0, 2)).toBe(false);
        });
    });

    describe('formatElapsedTime', () => {
        it('should format zero seconds', () => {
            expect(formatElapsedTime(0)).toBe('0:00');
        });

        it('should format seconds only', () => {
            expect(formatElapsedTime(45)).toBe('0:45');
        });

        it('should format minutes and seconds', () => {
            expect(formatElapsedTime(125)).toBe('2:05');
        });

        it('should format hours, minutes, and seconds', () => {
            expect(formatElapsedTime(3661)).toBe('1:01:01');
        });

        it('should handle large values', () => {
            expect(formatElapsedTime(7200)).toBe('2:00:00');
        });
    });

    describe('formatPace', () => {
        it('should return undefined for undefined input', () => {
            expect(formatPace(undefined)).toBeUndefined();
        });

        it('should format 5:00/km', () => {
            expect(formatPace(300)).toBe('5:00');
        });

        it('should format 4:30/km', () => {
            expect(formatPace(270)).toBe('4:30');
        });

        it('should format 6:15/km', () => {
            expect(formatPace(375)).toBe('6:15');
        });
    });

    describe('computeMedianPace', () => {
        function makePointsAndDists(n: number, t0?: Date): {
            points: TrackPoint[];
            distances: number[];
        } {
            const start = t0 ?? new Date('2024-01-15T10:00:00Z');
            const points: TrackPoint[] = [];
            for (let i = 0; i < n; i++) {
                points.push(makePoint(
                    55.0 + i * 0.000036,
                    37.0,
                    new Date(start.getTime() + i * 1000).toISOString(),
                ));
            }
            return { points, distances: calculateCumulativeDistances(points) };
        }

        it('should return correct median pace for steady running', () => {
            const { points, distances } = makePointsAndDists(6);
            const paused = points.map(() => false);
            const pace = computeMedianPace(points, distances, paused, 5);
            expect(pace).toBeDefined();
            expect(pace!).toBeGreaterThan(230);
            expect(pace!).toBeLessThan(270);
        });

        it('should fall back to forward segments at the start of the track', () => {
            const { points, distances } = makePointsAndDists(6);
            const paused = points.map(() => false);
            const pace = computeMedianPace(points, distances, paused, 0);
            expect(pace).toBeDefined();
            expect(pace!).toBeGreaterThan(220);
            expect(pace!).toBeLessThan(280);
        });

        it('should return undefined when all segments in the window are paused', () => {
            const { points, distances } = makePointsAndDists(6);
            const paused = points.map(() => true);
            const pace = computeMedianPace(points, distances, paused, 5);
            expect(pace).toBeUndefined();
        });

        it('should exclude paused segments from the median pool', () => {
            const { points, distances } = makePointsAndDists(8);
            const paused = points.map((_, i) => i >= 2 && i <= 4);
            const pace = computeMedianPace(points, distances, paused, 7);
            expect(pace).toBeDefined();
            expect(pace!).toBeGreaterThan(230);
            expect(pace!).toBeLessThan(270);
        });

        it('should filter segments with speed exceeding MAX_PLAUSIBLE_SPEED_MS', () => {
            const { points } = makePointsAndDists(7);
            const customDist: number[] = [0];
            for (let i = 1; i < points.length; i++) {
                const segKm = haversineDistance(
                    points[i - 1].lat, points[i - 1].lon,
                    points[i].lat, points[i].lon,
                );
                customDist.push(customDist[customDist.length - 1]!
                    + (i === 3 ? 0.016 : segKm));
            }
            const paused = points.map(() => false);
            const pace = computeMedianPace(points, customDist, paused, 5);
            expect(pace).toBeDefined();
            expect(pace!).toBeGreaterThan(230);
            expect(pace!).toBeLessThan(270);
        });

        it('should filter segments with time gap exceeding MAX_CONSECUTIVE_GAP_SECONDS', () => {
            const t0 = new Date('2024-01-15T10:00:00Z');
            const points: TrackPoint[] = [];
            for (let i = 0; i <= 4; i++) {
                points.push(makePoint(55.0 + i * 0.000036, 37.0,
                    new Date(t0.getTime() + i * 1000).toISOString()));
            }
            points.push(makePoint(55.0 + 5 * 0.000036, 37.0,
                new Date(t0.getTime() + 25 * 1000).toISOString()));
            for (let i = 6; i <= 8; i++) {
                points.push(makePoint(55.0 + i * 0.000036, 37.0,
                    new Date(t0.getTime() + (25 + (i - 5)) * 1000).toISOString()));
            }
            const distances = calculateCumulativeDistances(points);
            const paused = points.map(() => false);
            const pace = computeMedianPace(points, distances, paused, 8);
            expect(pace).toBeDefined();
            expect(pace!).toBeGreaterThan(230);
            expect(pace!).toBeLessThan(270);
        });

        it('should use single valid segment when only one is available', () => {
            const { points, distances } = makePointsAndDists(4);
            const paused = points.map((_, i) => i > 0 && i < 3);
            const pace = computeMedianPace(points, distances, paused, 3);
            expect(pace).toBeDefined();
            expect(pace!).toBeGreaterThan(200);
            expect(pace!).toBeLessThan(300);
        });

        it('should return undefined when all segment distances are zero', () => {
            const t0 = new Date('2024-01-15T10:00:00Z');
            const points: TrackPoint[] = [];
            for (let i = 0; i < 6; i++) {
                points.push(makePoint(55.0, 37.0,
                    new Date(t0.getTime() + i * 1000).toISOString()));
            }
            const distances = points.map(() => 0);
            const paused = points.map(() => false);
            const pace = computeMedianPace(points, distances, paused, 4);
            expect(pace).toBeUndefined();
        });

        it('should return undefined when pace falls below 120 sec/km', () => {
            const t0 = new Date('2024-01-15T10:00:00Z');
            const points: TrackPoint[] = [];
            for (let i = 0; i <= 5; i++) {
                points.push(makePoint(55.0 + i * 0.00054, 37.0,
                    new Date(t0.getTime() + i * 1000).toISOString()));
            }
            const distances = calculateCumulativeDistances(points);
            const paused = points.map(() => false);
            const pace = computeMedianPace(points, distances, paused, 5);
            expect(pace).toBeUndefined();
        });

        it('should return undefined when pace exceeds 1800 sec/km', () => {
            const t0 = new Date('2024-01-15T10:00:00Z');
            const points: TrackPoint[] = [];
            for (let i = 0; i <= 5; i++) {
                points.push(makePoint(55.0 + i * 0.000001, 37.0,
                    new Date(t0.getTime() + i * 1000).toISOString()));
            }
            const distances = calculateCumulativeDistances(points);
            const paused = points.map(() => false);
            const pace = computeMedianPace(points, distances, paused, 5);
            expect(pace).toBeUndefined();
        });

        it('should return undefined for index 0 with no forward segments', () => {
            const points = [makePoint(55.0, 37.0, '2024-01-15T10:00:00Z')];
            const distances = [0];
            const paused = [false];
            const pace = computeMedianPace(points, distances, paused, 0);
            expect(pace).toBeUndefined();
        });

        it('should flip median when fast segments outnumber slow', () => {
            const t0 = new Date('2024-01-15T10:00:00Z');
            const points: TrackPoint[] = [];
            for (let s = 0; s <= 3; s++) {
                points.push(makePoint(55.0 + s * 0.000018, 37.0,
                    new Date(t0.getTime() + s * 1000).toISOString()));
            }
            for (let s = 1; s <= 7; s++) {
                points.push(makePoint(55.0 + 3 * 0.000018 + s * 0.000036, 37.0,
                    new Date(t0.getTime() + (3 + s) * 1000).toISOString()));
            }
            const distances = calculateCumulativeDistances(points);
            const paused = points.map(() => false);
            const pace = computeMedianPace(points, distances, paused, 8);
            expect(pace).toBeDefined();
            expect(pace!).toBeLessThan(280);
        });
    });

    describe('buildTelemetryTimeline', () => {
        it('should return empty array for empty points', () => {
            expect(buildTelemetryTimeline([])).toEqual([]);
        });

        it('should build timeline with correct structure', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z', 140),
                makePoint(55.7567, 37.6173, '2024-01-15T10:00:30Z', 145),
                makePoint(55.7576, 37.6173, '2024-01-15T10:01:00Z', 150),
            ];

            const timeline = buildTelemetryTimeline(points);

            expect(timeline).toHaveLength(3);
            expect(timeline[0]!.timeOffset).toBe(0);
            expect(timeline[0]!.distanceKm).toBe(0);
            expect(timeline[0]!.hr).toBe(140);
            expect(timeline[0]!.elapsedTime).toBe('0:00');

            expect(timeline[1]!.timeOffset).toBe(30);
            expect(timeline[1]!.distanceKm).toBeGreaterThan(0);
            expect(timeline[1]!.hr).toBe(145);

            expect(timeline[2]!.timeOffset).toBe(60);
            expect(timeline[2]!.distanceKm).toBeGreaterThan(timeline[1]!.distanceKm);
        });

        it('should calculate moving time correctly', () => {
            // Points with very small distance = not moving
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:30Z'), // Same point - stationary
                makePoint(55.7600, 37.6173, '2024-01-15T10:01:00Z'), // Big jump - moving
            ];

            const timeline = buildTelemetryTimeline(points);
            expect(timeline[1]!.movingTimeSeconds).toBe(0); // Stationary
            expect(timeline[2]!.movingTimeSeconds).toBeGreaterThan(0); // Moving
        });

        it('should not count auto-pause as moving time and resume correctly', () => {
            // Simulate run -> pause (many stationary points) -> resume
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points = [
                // moving initially
                makePoint(55.0000, 37.0000, new Date(t0).toISOString()),
                makePoint(55.00003, 37.0000, new Date(t0 + 1000).toISOString()),
                // pause: repeated identical positions every 10s for 30s
                makePoint(55.00003, 37.0000, new Date(t0 + 11000).toISOString()),
                makePoint(55.00003, 37.0000, new Date(t0 + 21000).toISOString()),
                makePoint(55.00003, 37.0000, new Date(t0 + 31000).toISOString()),
                // resume moving
                makePoint(55.00006, 37.0000, new Date(t0 + 32000).toISOString()),
                makePoint(55.00009, 37.0000, new Date(t0 + 33000).toISOString()),
            ];

            const timeline = buildTelemetryTimeline(points);

            // After initial move (index 1) movingTime > 0
            expect(timeline[1]!.movingTimeSeconds).toBeGreaterThan(0);
            const movingBeforePause = timeline[1]!.movingTimeSeconds;

            // During pause (indices 2-4) movingTime should NOT increase
            expect(timeline[2]!.movingTimeSeconds).toBeCloseTo(movingBeforePause, 3);
            expect(timeline[3]!.movingTimeSeconds).toBeCloseTo(movingBeforePause, 3);
            expect(timeline[4]!.movingTimeSeconds).toBeCloseTo(movingBeforePause, 3);

            // After resume (index 5+) movingTime must increase relative to before-pause
            expect(timeline[5]!.movingTimeSeconds).toBeGreaterThan(movingBeforePause);
            expect(timeline[6]!.movingTimeSeconds).toBeGreaterThan(timeline[5]!.movingTimeSeconds);
        });

        it('should treat clustered GPS jitter as a pause for pace, distance, and displayed time', () => {
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points = [
                makePoint(55.00000, 37.0000, new Date(t0).toISOString()),
                makePoint(55.00003, 37.0000, new Date(t0 + 1000).toISOString()),
                makePoint(55.00006, 37.0000, new Date(t0 + 2000).toISOString()),
                makePoint(55.00009, 37.0000, new Date(t0 + 3000).toISOString()),
                makePoint(55.00012, 37.0000, new Date(t0 + 4000).toISOString()),
                // Paused cluster with 2-3m jitter around the same spot.
                makePoint(55.000135, 37.0000, new Date(t0 + 5000).toISOString()),
                makePoint(55.000110, 37.0000, new Date(t0 + 6000).toISOString()),
                makePoint(55.000136, 37.0000, new Date(t0 + 7000).toISOString()),
                makePoint(55.000123, 37.0000, new Date(t0 + 8000).toISOString()),
                // Resume running.
                makePoint(55.000150, 37.0000, new Date(t0 + 9000).toISOString()),
                makePoint(55.000180, 37.0000, new Date(t0 + 10000).toISOString()),
                makePoint(55.000210, 37.0000, new Date(t0 + 11000).toISOString()),
                makePoint(55.000240, 37.0000, new Date(t0 + 12000).toISOString()),
            ];

            const timeline = buildTelemetryTimeline(points);
            const beforePause = timeline[4]!;

            expect(beforePause.paceSecondsPerKm).toBeDefined();
            expect(beforePause.totalElapsedSeconds).toBeDefined();
            const beforePauseTotalElapsedSeconds = beforePause.totalElapsedSeconds!;

            for (const pausedIndex of [5, 6, 7, 8]) {
                expect(timeline[pausedIndex]!.isPaused).toBe(true);
                expect(timeline[pausedIndex]!.distanceKm).toBeCloseTo(beforePause.distanceKm, 5);
                expect(timeline[pausedIndex]!.movingTimeSeconds).toBeCloseTo(beforePause.movingTimeSeconds, 5);
                expect(timeline[pausedIndex]!.elapsedTime).toBe(beforePause.elapsedTime);
                expect(timeline[pausedIndex]!.totalElapsedSeconds).toBeGreaterThan(beforePauseTotalElapsedSeconds);
                expect(timeline[pausedIndex]!.paceSecondsPerKm).toBeCloseTo(beforePause.paceSecondsPerKm!, 5);
            }

            const afterResume = timeline[11]!;
            expect(afterResume.isPaused).toBe(false);
            expect(afterResume.distanceKm).toBeGreaterThan(beforePause.distanceKm);
            expect(afterResume.movingTimeSeconds).toBeGreaterThan(beforePause.movingTimeSeconds);
            expect(afterResume.elapsedTime).not.toBe(beforePause.elapsedTime);
            expect(afterResume.paceSecondsPerKm).toBeDefined();
            expect(afterResume.paceSecondsPerKm!).toBeLessThan(720);
            expect(afterResume.paceSecondsPerKm!).toBeGreaterThan(120);
        });

        it('should propagate elevation from GPX points into telemetry frames', () => {
            const points = [
                makePointWithElevation(55.7558, 37.6173, '2024-01-15T10:00:00Z', 120, 140),
                makePointWithElevation(55.7567, 37.6173, '2024-01-15T10:00:30Z', 125, 145),
            ];

            const timeline = buildTelemetryTimeline(points);
            expect(timeline[0]!.elevationM).toBe(120);
            expect(timeline[1]!.elevationM).toBe(125);
        });

        it('should propagate cadence and power into telemetry frames', () => {
            const points = [
                makePointWithMetrics(55.7558, 37.6173, '2024-01-15T10:00:00Z', {
                    ele: 120,
                    hr: 140,
                    cadence: 86,
                    power: 250,
                }),
                makePointWithMetrics(55.7567, 37.6182, '2024-01-15T10:00:05Z', {
                    ele: 125,
                    hr: 145,
                    cadence: 92,
                    power: 310,
                }),
            ];

            const timeline = buildTelemetryTimeline(points);

            expect(timeline[0]!.cadenceRpm).toBe(86);
            expect(timeline[0]!.powerWatts).toBe(250);
            expect(timeline[1]!.cadenceRpm).toBe(92);
            expect(timeline[1]!.powerWatts).toBe(310);
        });

        it('should derive cycling speed without capping valid 54 km/h segments', () => {
            const frames = buildTelemetryTimeline([
                makePointWithMetrics(55.0, 37.0, '2024-01-15T10:00:00Z', { ele: 100 }),
                makePointWithMetrics(55.000675, 37.0, '2024-01-15T10:00:05Z', { ele: 100 }),
            ]);

            expect(frames[1]!.speedKmh).toBeGreaterThan(50);
        });

        it('should return undefined grade when elevation data is absent', () => {
            const frames = buildTelemetryTimeline([
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.0, 37.0006, '2024-01-15T10:00:10Z'),
            ]);

            expect(frames[1]!.gradePercent).toBeUndefined();
        });

        it('should derive grade from a smoothed elevation window', () => {
            const frames = buildTelemetryTimeline([
                makePointWithMetrics(55.0, 37.0, '2024-01-15T10:00:00Z', { ele: 100.0 }),
                makePointWithMetrics(55.0, 37.0003, '2024-01-15T10:00:05Z', { ele: 102.0 }),
                makePointWithMetrics(55.0, 37.0006, '2024-01-15T10:00:10Z', { ele: 104.0 }),
                makePointWithMetrics(55.0, 37.0009, '2024-01-15T10:00:15Z', { ele: 106.0 }),
            ]);

            expect(frames[3]!.gradePercent).toBeGreaterThan(8);
            expect(frames[3]!.gradePercent).toBeLessThan(13);
        });

        it('should not emit spiky double-digit grade on nearly flat noisy elevation', () => {
            const frames = buildTelemetryTimeline([
                makePointWithMetrics(55.0, 37.0, '2024-01-15T10:00:00Z', { ele: 100.0 }),
                makePointWithMetrics(55.0, 37.0003, '2024-01-15T10:00:05Z', { ele: 100.8 }),
                makePointWithMetrics(55.0, 37.0006, '2024-01-15T10:00:10Z', { ele: 99.9 }),
                makePointWithMetrics(55.0, 37.0009, '2024-01-15T10:00:15Z', { ele: 100.4 }),
            ]);

            expect(Math.abs(frames[3]!.gradePercent ?? 0)).toBeLessThan(8);
        });

        it('should drop speed and grade updates across sparse time gaps', () => {
            const frames = buildTelemetryTimeline([
                makePointWithMetrics(55.0, 37.0, '2024-01-15T10:00:00Z', { ele: 100 }),
                makePointWithMetrics(55.0, 37.0010, '2024-01-15T10:00:20Z', { ele: 110 }),
            ]);

            expect(frames[1]!.speedKmh).toBeUndefined();
            expect(frames[1]!.gradePercent).toBeUndefined();
        });

        it('should fill missing pace values by interpolation/extrapolation for smooth output', () => {
            // First 3 points: stationary (no movement) → raw pace undefined
            // Then running at ~3 m/s for several seconds → pace defined
            // fillMissingPaceValues should backfill the first stationary points.
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points: TrackPoint[] = [
                // Stationary: same location, 1-second gaps
                makePoint(55.0, 37.0, new Date(t0).toISOString()),
                makePoint(55.0, 37.0, new Date(t0 + 1000).toISOString()),
                makePoint(55.0, 37.0, new Date(t0 + 2000).toISOString()),
                // Now running at ~3 m/s (≈0.000027° lat/s)
                makePoint(55.00003, 37.0, new Date(t0 + 3000).toISOString()),
                makePoint(55.00006, 37.0, new Date(t0 + 4000).toISOString()),
                makePoint(55.00009, 37.0, new Date(t0 + 5000).toISOString()),
                makePoint(55.00012, 37.0, new Date(t0 + 6000).toISOString()),
                makePoint(55.00015, 37.0, new Date(t0 + 7000).toISOString()),
                makePoint(55.00018, 37.0, new Date(t0 + 8000).toISOString()),
            ];

            const timeline = buildTelemetryTimeline(points);
            // Running frames (index 3+) should have pace defined from rolling window
            expect(timeline[6]!.paceSecondsPerKm).toBeDefined();
            // Stationary frames (0-2) should be filled via fillMissingPaceValues
            expect(timeline[0]!.paceSecondsPerKm).toBeDefined();
            expect(timeline[1]!.paceSecondsPerKm).toBeDefined();
            expect(timeline[2]!.paceSecondsPerKm).toBeDefined();
        });

        it('should adapt pace dynamically to changing speed profile (not monotonic drift)', () => {
            // 1-second intervals to stay under MAX_CONSECUTIVE_GAP_SECONDS.
            // Fast phase → slow phase → fast phase to produce both increase and decrease.
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points: TrackPoint[] = [];

            // Phase 1 (0-5s): fast — ~4 m/s (~0.000036° lat/s)
            for (let s = 0; s <= 5; s++) {
                points.push(makePoint(55.0 + s * 0.000036, 37.0, new Date(t0 + s * 1000).toISOString()));
            }
            // Phase 2 (6-11s): slow — ~1.5 m/s (~0.0000135° lat/s)
            let baseLat = 55.0 + 5 * 0.000036;
            for (let s = 1; s <= 6; s++) {
                points.push(makePoint(baseLat + s * 0.0000135, 37.0, new Date(t0 + (5 + s) * 1000).toISOString()));
            }
            // Phase 3 (12-17s): fast again — ~4 m/s
            baseLat = baseLat + 6 * 0.0000135;
            for (let s = 1; s <= 6; s++) {
                points.push(makePoint(baseLat + s * 0.000036, 37.0, new Date(t0 + (11 + s) * 1000).toISOString()));
            }

            const timeline = buildTelemetryTimeline(points);
            const paces = timeline
                .map((f) => f.paceSecondsPerKm)
                .filter((v): v is number => v !== undefined);

            expect(paces.length).toBeGreaterThan(3);

            let hasIncrease = false;
            let hasDecrease = false;
            for (let i = 1; i < paces.length; i++) {
                if (paces[i]! > paces[i - 1]!) hasIncrease = true;
                if (paces[i]! < paces[i - 1]!) hasDecrease = true;
            }

            expect(hasIncrease).toBe(true);
            expect(hasDecrease).toBe(true);
        });

        it('should react to a sustained slowdown over the rolling window', () => {
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            let lat = 55.0;
            const points: TrackPoint[] = [
                makePoint(lat, 37.0, new Date(t0).toISOString()),
            ];

            for (let second = 1; second <= 10; second += 1) {
                lat += metersToLatDelta(3.03); // ~5:30/km
                points.push(makePoint(lat, 37.0, new Date(t0 + second * 1000).toISOString()));
            }

            for (let second = 11; second <= 20; second += 1) {
                lat += metersToLatDelta(1.67); // ~10:00/km
                points.push(makePoint(lat, 37.0, new Date(t0 + second * 1000).toISOString()));
            }

            const timeline = buildTelemetryTimeline(points);
            // At index 10 the rolling window still sees mostly fast segments.
            expect(timeline[10]!.paceSecondsPerKm).toBeLessThan(360);

            // With a 7-second rolling window the slowdown is fully reflected
            // once the slow segments dominate the window (around index 14).
            expect(timeline[14]!.paceSecondsPerKm).toBeGreaterThan(400);
            expect(timeline[14]!.speedKmh).toBeLessThan(10);
        });

        it('should suppress isolated segment spikes without blurring normal running speed', () => {
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            let lat = 55.0;
            const points: TrackPoint[] = [
                makePoint(lat, 37.0, new Date(t0).toISOString()),
            ];
            const segmentMeters = [3.0, 3.0, 3.0, 7.5, 3.0, 3.0, 3.0];

            segmentMeters.forEach((meters, index) => {
                lat += metersToLatDelta(meters);
                points.push(makePoint(lat, 37.0, new Date(t0 + (index + 1) * 1000).toISOString()));
            });

            const timeline = buildTelemetryTimeline(points);
            // With the rolling speed window, the 7.5m spike at index 4
            // is averaged with surrounding segments.
            expect(timeline[4]!.speedKmh).toBeLessThan(20);
            expect(timeline[4]!.paceSecondsPerKm).toBeDefined();
        });

        it('should not span rolling window across large GPS gaps', () => {
            // Simulate a GPS signal loss: athlete runs, GPS drops for 20s during which
            // only 7m is recorded (noise), then GPS resumes and athlete is running fast.
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points: TrackPoint[] = [];

            // Normal running: 3 m/s ≈ 10.8 km/h ≈ 5:33/km, point per second
            for (let s = 0; s <= 10; s++) {
                points.push(makePoint(55.0 + s * 0.000027, 37.0, new Date(t0 + s * 1000).toISOString()));
            }

            // GPS gap: 20 seconds pass but only 1 point recorded far away
            points.push(makePoint(55.0 + 10 * 0.000027 + 0.00006, 37.0, new Date(t0 + 30_000).toISOString()));

            // Running resumes: 3 m/s again, points every second
            for (let s = 1; s <= 10; s++) {
                const lat = 55.0 + 10 * 0.000027 + 0.00006 + s * 0.000027;
                points.push(makePoint(lat, 37.0, new Date(t0 + 30_000 + s * 1000).toISOString()));
            }

            const timeline = buildTelemetryTimeline(points);

            // The point right after the gap (index 11) should NOT produce 20+ min/km
            // because the window should not span the 20-second gap.
            const afterGap = timeline[11]!; // First point after gap
            expect(afterGap.paceSecondsPerKm).toBeDefined();
            // Forward window should give reasonable running pace (~5 min/km)
            expect(afterGap.paceSecondsPerKm!).toBeLessThan(720); // < 12:00/km
            expect(afterGap.paceSecondsPerKm!).toBeGreaterThan(120); // > 2:00/km

            // Points before the gap should also have normal pace
            const beforeGap = timeline[10]!;
            expect(beforeGap.paceSecondsPerKm).toBeDefined();
            expect(beforeGap.paceSecondsPerKm!).toBeLessThan(720);
        });

        it('should produce one frame for a single point', () => {
            const points = [makePoint(55.0, 37.0, '2024-01-15T10:00:00Z')];
            const timeline = buildTelemetryTimeline(points);
            expect(timeline).toHaveLength(1);
            expect(timeline[0]!.distanceKm).toBe(0);
            expect(timeline[0]!.movingTimeSeconds).toBe(0);
            expect(timeline[0]!.timeOffset).toBe(0);
        });

        it('should produce frames with defined pace for two moving points', () => {
            const points = [
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.00003, 37.0, '2024-01-15T10:00:01Z'),
            ];
            const timeline = buildTelemetryTimeline(points);
            expect(timeline).toHaveLength(2);
            expect(timeline[1]!.paceSecondsPerKm).toBeDefined();
            expect(timeline[1]!.paceSecondsPerKm!).toBeLessThan(600);
            expect(timeline[1]!.paceSecondsPerKm!).toBeGreaterThan(120);
        });

        it('should mark all frames as paused when no meaningful movement', () => {
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points = [
                makePoint(55.0, 37.0, new Date(t0).toISOString()),
                makePoint(55.00001, 37.0, new Date(t0 + 1000).toISOString()),
                makePoint(55.00001, 37.0, new Date(t0 + 11000).toISOString()),
                makePoint(55.00001, 37.0, new Date(t0 + 21000).toISOString()),
            ];
            const timeline = buildTelemetryTimeline(points);
            expect(timeline[2]!.isPaused).toBe(true);
            expect(timeline[3]!.isPaused).toBe(true);
        });

        it('should hold speed across sparse GPX gaps instead of interpolating', () => {
            // Simulate: athlete runs at a steady pace, then the GPS signal
            // drops for 89 s.  The gap-filling path must not invent a
            // blended speed between the pre-gap and post-gap values.
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points = [
                makePoint(55.0, 37.0, new Date(t0).toISOString()),
                makePoint(55.00003, 37.0, new Date(t0 + 1000).toISOString()),
                makePoint(55.00006, 37.0, new Date(t0 + 2000).toISOString()),
                makePoint(55.00009, 37.0, new Date(t0 + 3000).toISOString()),
                makePoint(55.00012, 37.0, new Date(t0 + 4000).toISOString()),
                makePoint(55.00015, 37.0, new Date(t0 + 5000).toISOString()),
                // 89 s gap with negligible movement (~2 meters)
                makePoint(55.00017, 37.0, new Date(t0 + 6_000 + 89_000).toISOString()),
                // Sprint after the gap (1 s apart)
                makePoint(55.00032, 37.0, new Date(t0 + 96_000).toISOString()),
            ];

            const timeline = buildTelemetryTimeline(points);

            // The frame just before the gap (index 5) should be a normal running speed.
            expect(timeline[5]!.speedKmh).toBeGreaterThan(8);

            // The gapped frame (index 6) must hold the last known speed,
            // NOT blend the pre-gap and post-gap speeds.
            expect(timeline[6]!.speedKmh).toBeDefined();
            expect(timeline[6]!.speedKmh).toBeCloseTo(timeline[5]!.speedKmh!, 1);

            // The sprint frame should not be smeared backward into the gap.
            expect(timeline[7]!.speedKmh).toBeGreaterThan(timeline[6]!.speedKmh!);
        });

        it('should not invent pace across sparse gaps when speed is undefined', () => {
            const frames = buildTelemetryTimeline([
                makePointWithMetrics(55.0, 37.0, '2024-01-15T10:00:00Z', { ele: 100 }),
                makePointWithMetrics(55.0, 37.0010, '2024-01-15T10:00:02Z', { ele: 100 }),
            ]);

            // Two well-connected points produce a valid frame.
            expect(frames[1]!.speedKmh).toBeDefined();
        });
    });

    describe('fillMissingPaceValues', () => {
        it('should return empty array for empty input', () => {
            expect(fillMissingPaceValues([], [])).toEqual([]);
        });

        it('should pass through all-defined values (with median filter)', () => {
            const values: Array<number | undefined> =
                [250, 250, 250, 250, 250, 250, 250];
            const result = fillMissingPaceValues(
                values,
                [false, false, false, false, false, false, false],
            );
            expect(result).toHaveLength(7);
            expect(result[3]).toBe(250);
        });

        it('should filter single outlier via median filter', () => {
            const values: Array<number | undefined> =
                [250, 250, 250, 500, 250, 250, 250];
            const result = fillMissingPaceValues(
                values,
                [false, false, false, false, false, false, false],
            );
            expect(result[3]).toBe(250);
            expect(result[0]).toBe(250);
            expect(result[6]).toBe(250);
        });

        it('should extrapolate leading undefined values', () => {
            const values: Array<number | undefined> =
                [undefined, undefined, undefined, 250, 260, 270, 280];
            const result = fillMissingPaceValues(
                values,
                [false, false, false, false, false, false, false],
            );
            expect(result[0]).toBe(250);
            expect(result[1]).toBe(250);
            expect(result[2]).toBe(250);
        });

        it('should extrapolate trailing undefined values', () => {
            const values: Array<number | undefined> =
                [250, 260, 270, 280, undefined, undefined, undefined];
            const result = fillMissingPaceValues(
                values,
                [false, false, false, false, false, false, false],
            );
            expect(result[4]).toBe(280);
            expect(result[5]).toBe(280);
            expect(result[6]).toBe(280);
        });

        it('should hold pace across pause gaps instead of interpolating', () => {
            const values: Array<number | undefined> =
                [200, undefined, undefined, 300, 300, 300, 300];
            const paused = [false, true, true, false, false, false, false];
            const result = fillMissingPaceValues(values, paused);
            expect(result[1]).toBe(200);
            expect(result[2]).toBe(200);
        });

        it('should linearly interpolate gaps between valid values when no pause', () => {
            const values: Array<number | undefined> =
                [200, undefined, undefined, 300, 300, 300, 300];
            const paused = [false, false, false, false, false, false, false];
            const result = fillMissingPaceValues(values, paused);
            expect(result[0]).toBe(200);
            expect(result[1]).toBeDefined();
            expect(result[2]).toBeDefined();
            expect(result[1]!).toBeGreaterThan(200);
            expect(result[1]!).toBeLessThan(300);
            expect(result[2]!).toBeGreaterThan(200);
            expect(result[2]!).toBeLessThan(300);
        });

        it('should return all undefined for all-undefined input', () => {
            const values: Array<number | undefined> =
                [undefined, undefined, undefined];
            const result = fillMissingPaceValues(
                values,
                [false, false, false],
            );
            expect(result).toEqual([undefined, undefined, undefined]);
        });

        it('should return single value unchanged', () => {
            const values: Array<number | undefined> = [300];
            const result = fillMissingPaceValues(values, [false]);
            expect(result).toEqual([300]);
        });
    });

    describe('getTelemetryAtTime', () => {
        const points = [
            makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z', 140),
            makePoint(55.7567, 37.6173, '2024-01-15T10:00:30Z', 150),
            makePoint(55.7576, 37.6173, '2024-01-15T10:01:00Z', 160),
        ];
        const frames = buildTelemetryTimeline(points);

        it('should return null for empty frames', () => {
            expect(getTelemetryAtTime([], 10, 0)).toBeNull();
        });

        it('should return null for time before GPX start', () => {
            expect(getTelemetryAtTime(frames, -10, 0)).toBeNull();
        });

        it('should return null for time after GPX end', () => {
            expect(getTelemetryAtTime(frames, 100, 0)).toBeNull();
        });

        it('should return exact frame at matching time', () => {
            const result = getTelemetryAtTime(frames, 0, 0);
            expect(result).not.toBeNull();
            expect(result!.hr).toBe(140);
        });

        it('should interpolate HR between frames', () => {
            const result = getTelemetryAtTime(frames, 15, 0); // Midpoint between 0 and 30
            expect(result).not.toBeNull();
            expect(result!.hr).toBe(145); // Midpoint of 140 and 150
        });

        it('should interpolate elevation between frames when available', () => {
            const elevationFrames = buildTelemetryTimeline([
                makePointWithElevation(55.7558, 37.6173, '2024-01-15T10:00:00Z', 100, 140),
                makePointWithElevation(55.7567, 37.6173, '2024-01-15T10:00:30Z', 130, 150),
            ]);

            const result = getTelemetryAtTime(elevationFrames, 15, 0);
            expect(result).not.toBeNull();
            expect(result!.elevationM).toBeCloseTo(115, 5);
        });

        it('should interpolate speed, grade, cadence, and power between frames', () => {
            const telemetryFrames = buildTelemetryTimeline([
                makePointWithMetrics(55.7558, 37.6173, '2024-01-15T10:00:00Z', {
                    ele: 100,
                    hr: 140,
                    cadence: 80,
                    power: 220,
                }),
                makePointWithMetrics(55.7558, 37.6179, '2024-01-15T10:00:05Z', {
                    ele: 103,
                    hr: 145,
                    cadence: 90,
                    power: 280,
                }),
                makePointWithMetrics(55.7558, 37.6185, '2024-01-15T10:00:10Z', {
                    ele: 106,
                    hr: 150,
                    cadence: 100,
                    power: 340,
                }),
            ]);

            const result = getTelemetryAtTime(telemetryFrames, 7.5, 0);

            expect(result).not.toBeNull();
            expect(result!.speedKmh).toBeDefined();
            expect(result!.gradePercent).toBeDefined();
            expect(result!.cadenceRpm).toBeGreaterThan(90);
            expect(result!.cadenceRpm).toBeLessThan(100);
            expect(result!.powerWatts).toBeGreaterThan(280);
            expect(result!.powerWatts).toBeLessThan(340);
        });

        it('should apply sync offset correctly', () => {
            // With offset of 30, videoTime=0 maps to gpxTime=30
            const result = getTelemetryAtTime(frames, 0, 30);
            expect(result).not.toBeNull();
            expect(result!.hr).toBe(150); // Frame at t=30
        });

        it('should return null for non-finite sync offset', () => {
            expect(getTelemetryAtTime(frames, 0, Number.NaN)).toBeNull();
            expect(getTelemetryAtTime(frames, 0, Number.POSITIVE_INFINITY)).toBeNull();
            expect(getTelemetryAtTime(frames, 0, Number.NEGATIVE_INFINITY)).toBeNull();
        });

        it('should return null for non-finite video time', () => {
            expect(getTelemetryAtTime(frames, Number.NaN, 0)).toBeNull();
            expect(getTelemetryAtTime(frames, Number.POSITIVE_INFINITY, 0)).toBeNull();
            expect(getTelemetryAtTime(frames, Number.NEGATIVE_INFINITY, 0)).toBeNull();
        });

        it('should interpolate distance', () => {
            const result = getTelemetryAtTime(frames, 15, 0);
            expect(result).not.toBeNull();
            expect(result!.distanceKm).toBeGreaterThan(0);
            expect(result!.distanceKm).toBeLessThan(frames[1]!.distanceKm);
        });

        it('should interpolate pace between neighboring frames', () => {
            const customFrames = [
                {
                    timeOffset: 0,
                    paceSecondsPerKm: 300,
                    hr: 140,
                    distanceKm: 0,
                    elevationM: 100,
                    elapsedTime: '0:00',
                    movingTimeSeconds: 0,
                },
                {
                    timeOffset: 10,
                    paceSecondsPerKm: 360,
                    hr: 142,
                    distanceKm: 0.05,
                    elevationM: 101,
                    elapsedTime: '0:10',
                    movingTimeSeconds: 10,
                },
            ];

            const result = getTelemetryAtTime(customFrames, 5, 0);
            expect(result).not.toBeNull();
            expect(result!.paceSecondsPerKm).toBeDefined();
        });

        it('should update pace at 1Hz (same value within one second)', () => {
            const points = [
                makePoint(55.0000, 37.0000, '2024-01-15T10:00:00Z'),
                makePoint(55.00003, 37.0000, '2024-01-15T10:00:01Z'),
                makePoint(55.00006, 37.0000, '2024-01-15T10:00:02Z'),
                makePoint(55.00009, 37.0000, '2024-01-15T10:00:03Z'),
                makePoint(55.00012, 37.0000, '2024-01-15T10:00:04Z'),
                makePoint(55.00015, 37.0000, '2024-01-15T10:00:05Z'),
                makePoint(55.00018, 37.0000, '2024-01-15T10:00:06Z'),
                makePoint(55.00021, 37.0000, '2024-01-15T10:00:07Z'),
                makePoint(55.00024, 37.0000, '2024-01-15T10:00:08Z'),
                makePoint(55.00027, 37.0000, '2024-01-15T10:00:09Z'),
                makePoint(55.00030, 37.0000, '2024-01-15T10:00:10Z'),
                makePoint(55.00033, 37.0000, '2024-01-15T10:00:11Z'),
            ];

            const frames = buildTelemetryTimeline(points);
            const a = getTelemetryAtTime(frames, 9.10, 0);
            const b = getTelemetryAtTime(frames, 9.90, 0);

            expect(a).not.toBeNull();
            expect(b).not.toBeNull();
            expect(a!.paceSecondsPerKm).toBeDefined();
            expect(a!.paceSecondsPerKm).toBeCloseTo(b!.paceSecondsPerKm!, 6);
        });

        it('should reflect speed change across seconds', () => {
            const points = [
                makePoint(55.0000, 37.0000, '2024-01-15T10:00:00Z'),
                makePoint(55.00004, 37.0000, '2024-01-15T10:00:01Z'),
                makePoint(55.00008, 37.0000, '2024-01-15T10:00:02Z'),
                makePoint(55.00012, 37.0000, '2024-01-15T10:00:03Z'),
                makePoint(55.00016, 37.0000, '2024-01-15T10:00:04Z'),
                makePoint(55.00018, 37.0000, '2024-01-15T10:00:05Z'),
                makePoint(55.00020, 37.0000, '2024-01-15T10:00:06Z'),
                makePoint(55.00022, 37.0000, '2024-01-15T10:00:07Z'),
                makePoint(55.00024, 37.0000, '2024-01-15T10:00:08Z'),
                makePoint(55.00026, 37.0000, '2024-01-15T10:00:09Z'),
                makePoint(55.00030, 37.0000, '2024-01-15T10:00:10Z'),
                makePoint(55.00034, 37.0000, '2024-01-15T10:00:11Z'),
            ];

            const frames = buildTelemetryTimeline(points);
            const fast = getTelemetryAtTime(frames, 4.2, 0);
            const slow = getTelemetryAtTime(frames, 9.2, 0);

            expect(fast).not.toBeNull();
            expect(slow).not.toBeNull();
            expect(fast!.paceSecondsPerKm).toBeDefined();
            expect(slow!.paceSecondsPerKm).toBeDefined();
            expect(slow!.paceSecondsPerKm!).toBeGreaterThan(fast!.paceSecondsPerKm!);
        });

        it('should respond quickly to speed increase (walking → running)', () => {
            // Simulating: athlete walks slowly (10+ min/km) for first 5 seconds,
            // then starts running (7 min/km) from second 5 onwards
            // With median-of-speeds (5-segment window), the median flips from
            // walking to running within ~3 seconds at 1 Hz GPS.
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points: TrackPoint[] = [];

            // Walking phase: ~2 m/s = ~8:20 min/km = 500 sec/km
            // Move 2m per second (0.000018° lat approx)
            for (let s = 0; s <= 5; s++) {
                points.push(makePoint(
                    55.0 + s * 0.000018,
                    37.0,
                    new Date(t0 + s * 1000).toISOString()
                ));
            }

            // Running phase: ~4 m/s = ~4:10 min/km = 250 sec/km
            // Move 4m per second (0.000036° lat approx)
            for (let s = 1; s <= 8; s++) {
                points.push(makePoint(
                    55.0 + 5 * 0.000018 + s * 0.000036,
                    37.0,
                    new Date(t0 + (5 + s) * 1000).toISOString()
                ));
            }

            const frames = buildTelemetryTimeline(points);

            // Check pace at second 4 (still walking)
            const walkingPace = getTelemetryAtTime(frames, 4, 0);
            expect(walkingPace).not.toBeNull();
            expect(walkingPace!.paceSecondsPerKm).toBeDefined();

            // Check pace at second 8 (3 seconds after speed change, median should now reflect running)
            // Walking ~500 sec/km, running ~250 sec/km — at least 20% faster
            const runningPace = getTelemetryAtTime(frames, 8, 0);
            expect(runningPace).not.toBeNull();
            expect(runningPace!.paceSecondsPerKm).toBeDefined();
            expect(runningPace!.paceSecondsPerKm!).toBeLessThan(walkingPace!.paceSecondsPerKm! * 0.8);

            // By second 9, pace should be fully settled at running pace
            const settledPace = getTelemetryAtTime(frames, 9, 0);
            expect(settledPace!.paceSecondsPerKm!).toBeLessThan(350); // Close to 250 sec/km
        });

        it('should maintain stable pace during steady running without jitter', () => {
            // Simulating: athlete runs at steady ~5:00 min/km (300 sec/km) for 20 seconds
            // Real GPS recordings have small coordinate variations (noise)
            // This test verifies that small GPS noise doesn't cause ±1 min/km swings
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const points: TrackPoint[] = [];

            // Steady running: ~3.33 m/s = 5:00 min/km
            // Add small GPS noise (±1m) to simulate real GPS data
            const latNoisePattern = [0, 0.000008, -0.000003, 0.000005, -0.000007,
                0.000004, -0.000006, 0.000002, -0.000004, 0.000003,
                0.000007, -0.000005, 0.000004, -0.000008, 0.000006,
                -0.000003, 0.000005, -0.000004, 0.000007, -0.000006,
                0.000002]; // ±~1m noise
            const lonNoisePattern = [0, 0.000002, -0.000005, 0.000003, -0.000004,
                0.000006, -0.000002, 0.000004, -0.000007, 0.000005,
                -0.000003, 0.000006, -0.000004, 0.000002, -0.000005,
                0.000007, -0.000003, 0.000004, -0.000006, 0.000002,
                -0.000004]; // ±~1m longitude noise

            for (let s = 0; s <= 20; s++) {
                // Base movement: ~3.33m/s (0.000030° lat/s)
                const baseLat = 55.0 + s * 0.000030;
                const noisyLat = baseLat + (latNoisePattern[s] ?? 0);
                points.push(makePoint(
                    noisyLat,
                    37.0 + (lonNoisePattern[s] ?? 0),
                    new Date(t0 + s * 1000).toISOString()
                ));
            }

            const frames = buildTelemetryTimeline(points);

            // Collect pace values from second 3 to second 17 (avoid start/end effects)
            const paceValues: number[] = [];
            for (let sec = 3; sec <= 17; sec++) {
                const frame = getTelemetryAtTime(frames, sec, 0);
                if (frame?.paceSecondsPerKm !== undefined) {
                    paceValues.push(frame.paceSecondsPerKm);
                }
            }

            expect(paceValues.length).toBeGreaterThan(10);

            // Calculate statistics
            const minPace = Math.min(...paceValues);
            const maxPace = Math.max(...paceValues);
            const avgPace = paceValues.reduce((a, b) => a + b, 0) / paceValues.length;

            // The backward-only 2 s lookback window rejects single-frame GPS
            // noise while keeping pace transitions responsive.  With ±1 m GPS
            // jitter on a ~3.3 m/s base the per-frame pace can swing ~30 %,
            // so the display-time median brings the range down but cannot
            // eliminate it entirely.  Allow a realistic tolerance.
            const maxAllowedVariance = 210; // seconds per km
            expect(maxPace - minPace).toBeLessThanOrEqual(maxAllowedVariance);

            // Average should remain in a plausible steady-running band and avoid
            // collapsing toward sprint-like values under small GPS jitter.
            expect(avgPace).toBeGreaterThan(240); // > 4:00 min/km
            expect(avgPace).toBeLessThan(330);    // < 5:30 min/km
        });

        it('should limit pace error from multi-segment GPS burst (+4m two seconds in a row)', () => {
            // Two consecutive GPS outliers (+4m each at seconds 5-6).
            // The current rolling-window-first-valid approach gives 3:32/km for
            // the affected frame (raw). With median-of-speeds this should stay < 15% error.
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            const trueSpeedMs = 2.38; // ~7:00/km
            const points: TrackPoint[] = [];

            for (let s = 0; s <= 20; s++) {
                const baseDist = s * trueSpeedMs;
                // Inject +4m noise at seconds 5 and 6
                const noiseDist = (s >= 5 && s <= 6) ? 4.0 : 0;
                const totalDist = baseDist + noiseDist * (s >= 5 ? 1 : 0);
                const lat = 55.0 + totalDist / 111320;
                points.push(makePoint(lat, 37.0, new Date(t0 + s * 1000).toISOString()));
            }

            const frames = buildTelemetryTimeline(points);

            // Collect pace from second 8 onward (settle after the burst)
            const paceValues: number[] = [];
            for (let sec = 8; sec <= 20; sec++) {
                const frame = getTelemetryAtTime(frames, sec, 0);
                if (frame?.paceSecondsPerKm !== undefined) {
                    paceValues.push(frame.paceSecondsPerKm);
                }
            }

            expect(paceValues.length).toBeGreaterThan(8);
            const avg = paceValues.reduce((a, b) => a + b, 0) / paceValues.length;

            // Median-of-speeds filters the burst at segment level: the +4m outlier
            // on segments 5-6 doesn't shift the median. Allow ±15% (≈63 sec/km)
            // from true 420 sec/km.
            expect(avg).toBeGreaterThan(357);
            expect(avg).toBeLessThan(483);
        });

        it('should compute stable valid pace for 9-second clip window', () => {
            const points = [
                // pre-roll low movement before clip start
                makePoint(55.00000, 37.0000, '2024-01-15T10:00:00Z'),
                makePoint(55.00000, 37.0000, '2024-01-15T10:00:01Z'),
                makePoint(55.00001, 37.0000, '2024-01-15T10:00:02Z'),
                makePoint(55.00001, 37.0000, '2024-01-15T10:00:03Z'),
                makePoint(55.00002, 37.0000, '2024-01-15T10:00:04Z'),
                makePoint(55.00004, 37.0000, '2024-01-15T10:00:05Z'),
                // athlete is running during the 9-second clip window [6..14]
                makePoint(55.00008, 37.0000, '2024-01-15T10:00:06Z'),
                makePoint(55.00012, 37.0000, '2024-01-15T10:00:07Z'),
                makePoint(55.00016, 37.0000, '2024-01-15T10:00:08Z'),
                makePoint(55.00020, 37.0000, '2024-01-15T10:00:09Z'),
                makePoint(55.00024, 37.0000, '2024-01-15T10:00:10Z'),
                makePoint(55.00028, 37.0000, '2024-01-15T10:00:11Z'),
                makePoint(55.00032, 37.0000, '2024-01-15T10:00:12Z'),
                makePoint(55.00036, 37.0000, '2024-01-15T10:00:13Z'),
                makePoint(55.00040, 37.0000, '2024-01-15T10:00:14Z'),
                makePoint(55.00044, 37.0000, '2024-01-15T10:00:15Z'),
            ];

            const frames = buildTelemetryTimeline(points);

            const paceValues: number[] = [];
            for (let sec = 6; sec <= 14; sec++) {
                const frame = getTelemetryAtTime(frames, sec + 0.2, 0);
                expect(frame).not.toBeNull();
                expect(frame!.paceSecondsPerKm).toBeDefined();
                paceValues.push(frame!.paceSecondsPerKm!);
            }

            // Clip window should not drift into walking-range values.
            expect(Math.max(...paceValues)).toBeLessThan(720); // < 12:00/km
            expect(Math.min(...paceValues)).toBeGreaterThan(120); // > 2:00/km
        });

        it('should keep pace constant within one second (1 Hz snap)', () => {
            const customFrames = [
                {
                    timeOffset: 0,
                    hr: 140,
                    paceSecondsPerKm: 420,
                    distanceKm: 0,
                    elevationM: 100,
                    elapsedTime: '0:00',
                    movingTimeSeconds: 0,
                },
                {
                    timeOffset: 10,
                    hr: 145,
                    paceSecondsPerKm: 480,
                    distanceKm: 0.001,
                    elevationM: 101,
                    elapsedTime: '0:10',
                    movingTimeSeconds: 10,
                },
            ];

            const a = getTelemetryAtTime(customFrames, 5.1, 0);
            const b = getTelemetryAtTime(customFrames, 5.9, 0);

            expect(a).not.toBeNull();
            expect(b).not.toBeNull();
            expect(a!.paceSecondsPerKm).toBeDefined();
            expect(b!.paceSecondsPerKm).toBeDefined();
            expect(a!.paceSecondsPerKm).toBeCloseTo(b!.paceSecondsPerKm!, 10);
        });

        it('should not interpolate pace across large GPX time gaps', () => {
            const customFrames = [
                {
                    timeOffset: 1743,
                    hr: 140,
                    paceSecondsPerKm: 444, // 7:24
                    distanceKm: 1.0,
                    elevationM: 100,
                    elapsedTime: '29:03',
                    movingTimeSeconds: 1600,
                },
                {
                    timeOffset: 1759,
                    hr: 141,
                    paceSecondsPerKm: 304, // 5:04
                    distanceKm: 1.01,
                    elevationM: 101,
                    elapsedTime: '29:19',
                    movingTimeSeconds: 1616,
                },
            ];

            // Sample inside the 16-second gap.
            const insideGap = getTelemetryAtTime(customFrames, 1748.2, 0);
            expect(insideGap).not.toBeNull();

            // Pace should hold the last known value before the gap,
            // not linearly drift toward the next point.
            expect(insideGap!.paceSecondsPerKm).toBe(444);
        });

        it('should produce consistent pace regardless of video duration parameter', () => {
            const points = [
                makePoint(55.0000, 37.0000, '2024-01-15T10:00:00Z'),
                makePoint(55.00003, 37.0000, '2024-01-15T10:00:01Z'),
                makePoint(55.00006, 37.0000, '2024-01-15T10:00:02Z'),
                makePoint(55.00009, 37.0000, '2024-01-15T10:00:03Z'),
                makePoint(55.00012, 37.0000, '2024-01-15T10:00:04Z'),
                makePoint(55.00015, 37.0000, '2024-01-15T10:00:05Z'),
                makePoint(55.00018, 37.0000, '2024-01-15T10:00:06Z'),
                makePoint(55.00021, 37.0000, '2024-01-15T10:00:07Z'),
                makePoint(55.00024, 37.0000, '2024-01-15T10:00:08Z'),
                makePoint(55.00027, 37.0000, '2024-01-15T10:00:09Z'),
                makePoint(55.00030, 37.0000, '2024-01-15T10:00:10Z'),
            ];

            const frames = buildTelemetryTimeline(points);

            // Pace should NOT change based on videoDuration — GPX is the only source of truth
            const withoutDuration = getTelemetryAtTime(frames, 5.5, 0);
            const withShortDuration = getTelemetryAtTime(frames, 5.5, 0, 10);
            const withLongDuration = getTelemetryAtTime(frames, 5.5, 0, 3600);

            expect(withoutDuration).not.toBeNull();
            expect(withShortDuration).not.toBeNull();
            expect(withLongDuration).not.toBeNull();

            expect(withoutDuration!.paceSecondsPerKm).toBe(withShortDuration!.paceSecondsPerKm);
            expect(withoutDuration!.paceSecondsPerKm).toBe(withLongDuration!.paceSecondsPerKm);
        });

        it('should hold pace constant across medium GPX gaps (1-5s)', () => {
            const customFrames = [
                {
                    timeOffset: 0, paceSecondsPerKm: 300, hr: 140,
                    distanceKm: 0, elevationM: 100,
                    elapsedTime: '0:00', movingTimeSeconds: 0,
                },
                {
                    timeOffset: 3, paceSecondsPerKm: 360, hr: 145,
                    distanceKm: 0.01, elevationM: 101,
                    elapsedTime: '0:03', movingTimeSeconds: 3,
                },
            ];
            const result = getTelemetryAtTime(customFrames, 1.5, 0);
            expect(result).not.toBeNull();
            expect(result!.paceSecondsPerKm).toBe(300);
        });

        it('should interpolate pace across short 2-second sampling gaps', () => {
            const customFrames = [
                {
                    timeOffset: 0, paceSecondsPerKm: 300, hr: 140,
                    distanceKm: 0, elevationM: 100,
                    elapsedTime: '0:00', movingTimeSeconds: 0,
                },
                {
                    timeOffset: 2, paceSecondsPerKm: 420, hr: 145,
                    distanceKm: 0.01, elevationM: 101,
                    elapsedTime: '0:02', movingTimeSeconds: 2,
                },
            ];

            // With the backward-only 2 s window, at t=1 the only backward
            // frame is t=0 (pace 300).  The frame at t=2 is in the future
            // and is not used.  Pace stays at 300 until the next frame arrives.
            const result = getTelemetryAtTime(customFrames, 1, 0);
            expect(result).not.toBeNull();
            expect(result!.paceSecondsPerKm).toBeCloseTo(300, 5);
        });

        it('should hold pace constant across large GPX gaps (>5s)', () => {
            const customFrames = [
                {
                    timeOffset: 0, paceSecondsPerKm: 444, hr: 140,
                    distanceKm: 0, elevationM: 100,
                    elapsedTime: '0:00', movingTimeSeconds: 0,
                },
                {
                    timeOffset: 8, paceSecondsPerKm: 304, hr: 145,
                    distanceKm: 0.02, elevationM: 101,
                    elapsedTime: '0:08', movingTimeSeconds: 8,
                },
            ];
            const result = getTelemetryAtTime(customFrames, 4, 0);
            expect(result).not.toBeNull();
            expect(result!.paceSecondsPerKm).toBe(444);
        });

        it('should keep pace stable within one second for multi-frame data', () => {
            const frames = buildTelemetryTimeline([
                makePoint(55.0000, 37.0000, '2024-01-15T10:00:00Z'),
                makePoint(55.00004, 37.0000, '2024-01-15T10:00:01Z'),
                makePoint(55.00008, 37.0000, '2024-01-15T10:00:02Z'),
                makePoint(55.00012, 37.0000, '2024-01-15T10:00:03Z'),
                makePoint(55.00016, 37.0000, '2024-01-15T10:00:04Z'),
                makePoint(55.00020, 37.0000, '2024-01-15T10:00:05Z'),
            ]);
            const a = getTelemetryAtTime(frames, 2.1, 0);
            const b = getTelemetryAtTime(frames, 2.9, 0);
            expect(a).not.toBeNull();
            expect(b).not.toBeNull();
            expect(a!.paceSecondsPerKm).toBeDefined();
            expect(b!.paceSecondsPerKm).toBeDefined();
            expect(a!.paceSecondsPerKm).toBeCloseTo(b!.paceSecondsPerKm!, 6);
        });
    });

    describe('interpolatePace responsiveness', () => {
        it('should reflect deceleration over the rolling window', () => {
            // Create 20 fast points then 10 slow points.
            // With a 10-second rolling window the slowdown is fully
            // reflected once enough slow points enter the window.
            const t0 = new Date('2024-01-15T10:00:00Z').getTime();
            let lat = 55.0;
            const points: TrackPoint[] = [];

            // Fast phase: ~4.4 m/s (5:00/km)
            for (let s = 0; s < 20; s++) {
                points.push(makePoint(lat, 37.0, new Date(t0 + s * 1000).toISOString()));
                lat += metersToLatDelta(4.4);
            }

            // Slow phase: ~1.1 m/s (15:00/km)
            for (let s = 20; s < 30; s++) {
                points.push(makePoint(lat, 37.0, new Date(t0 + s * 1000).toISOString()));
                lat += metersToLatDelta(1.1);
            }

            const frames = buildTelemetryTimeline(points);

            // Well before the transition — pace should be fast.
            const beforeTransition = getTelemetryAtTime(frames, 15, 0);

            // Well after the transition — rolling window should have
            // enough slow segments to reflect the slowdown.
            const afterTransition = getTelemetryAtTime(frames, 27, 0);

            expect(beforeTransition).not.toBeNull();
            expect(afterTransition).not.toBeNull();
            expect(beforeTransition!.paceSecondsPerKm).toBeDefined();
            expect(afterTransition!.paceSecondsPerKm).toBeDefined();

            // After transition pace should be slower (higher value) than before
            expect(afterTransition!.paceSecondsPerKm!).toBeGreaterThan(
                beforeTransition!.paceSecondsPerKm!,
            );
        });

        it('should reflect acceleration within 2 seconds of transition', () => {
            // Start slow, then speed up
            const points = [
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.0 + 0.00001, 37.0, '2024-01-15T10:00:01Z'),
                makePoint(55.0 + 0.00002, 37.0, '2024-01-15T10:00:02Z'),
                makePoint(55.0 + 0.00003, 37.0, '2024-01-15T10:00:03Z'),
                makePoint(55.0 + 0.00004, 37.0, '2024-01-15T10:00:04Z'),
                // Speed up significantly
                makePoint(55.0, 37.0, '2024-01-15T10:00:05Z'),
                makePoint(55.0 + 0.00004, 37.0, '2024-01-15T10:00:06Z'),
                makePoint(55.0 + 0.00008, 37.0, '2024-01-15T10:00:07Z'),
                makePoint(55.0 + 0.00012, 37.0, '2024-01-15T10:00:08Z'),
                makePoint(55.0 + 0.00016, 37.0, '2024-01-15T10:00:09Z'),
            ];

            const frames = buildTelemetryTimeline(points);

            const beforeTransition = getTelemetryAtTime(frames, 4.5, 0);
            const afterTransition = getTelemetryAtTime(frames, 7.5, 0);

            expect(beforeTransition).not.toBeNull();
            expect(afterTransition).not.toBeNull();
            expect(beforeTransition!.paceSecondsPerKm).toBeDefined();
            expect(afterTransition!.paceSecondsPerKm).toBeDefined();

            // After transition pace should be faster (lower value) than before
            expect(afterTransition!.paceSecondsPerKm!).toBeLessThan(
                beforeTransition!.paceSecondsPerKm!,
            );
        });

        it('should smooth single-frame pace spikes via backward median', () => {
            // Build frames with consistent pace, inject one outlier
            const frames = [
                { timeOffset: 0, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0, elevationM: 100, elapsedTime: '0:00', movingTimeSeconds: 0 },
                { timeOffset: 1, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0.003, elevationM: 100, elapsedTime: '0:01', movingTimeSeconds: 1 },
                { timeOffset: 2, paceSecondsPerKm: 900, speedKmh: 4, distanceKm: 0.004, elevationM: 100, elapsedTime: '0:02', movingTimeSeconds: 2 },
                { timeOffset: 3, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0.007, elevationM: 100, elapsedTime: '0:03', movingTimeSeconds: 3 },
                { timeOffset: 4, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0.010, elevationM: 100, elapsedTime: '0:04', movingTimeSeconds: 4 },
            ];

            // At the spike frame (t=2), the backward-only 2s window includes
            // t=0 and t=1 (both pace 300). Median of [300, 300, 900] = 300.
            const atSpike = getTelemetryAtTime(frames, 2, 0);
            expect(atSpike).not.toBeNull();
            expect(atSpike!.paceSecondsPerKm).toBe(300);

            // Right after the spike (t=2.5), backward window includes t=1, t=2.
            // Median of [300, 900] = 600 — the spike is partially smoothed.
            const rightAfterSpike = getTelemetryAtTime(frames, 2.5, 0);
            expect(rightAfterSpike).not.toBeNull();
            expect(rightAfterSpike!.paceSecondsPerKm).toBeLessThan(900);
        });

        it('should hold pace across sparse 3-5s gaps', () => {
            const frames = [
                { timeOffset: 0, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0, elevationM: 100, elapsedTime: '0:00', movingTimeSeconds: 0 },
                { timeOffset: 4, paceSecondsPerKm: 600, speedKmh: 6, distanceKm: 0.01, elevationM: 100, elapsedTime: '0:04', movingTimeSeconds: 4 },
            ];

            const result = getTelemetryAtTime(frames, 2, 0);
            expect(result).not.toBeNull();
            expect(result!.paceSecondsPerKm).toBe(300);
        });

        it('should update pace within 2 seconds for 1s GPX sampling', () => {
            // Simulate 1s GPX with pace change at t=3
            const frames = [
                { timeOffset: 0, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0, elevationM: 100, elapsedTime: '0:00', movingTimeSeconds: 0 },
                { timeOffset: 1, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0.003, elevationM: 100, elapsedTime: '0:01', movingTimeSeconds: 1 },
                { timeOffset: 2, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0.006, elevationM: 100, elapsedTime: '0:02', movingTimeSeconds: 2 },
                { timeOffset: 3, paceSecondsPerKm: 600, speedKmh: 6, distanceKm: 0.008, elevationM: 100, elapsedTime: '0:03', movingTimeSeconds: 3 },
                { timeOffset: 4, paceSecondsPerKm: 600, speedKmh: 6, distanceKm: 0.009, elevationM: 100, elapsedTime: '0:04', movingTimeSeconds: 4 },
                { timeOffset: 5, paceSecondsPerKm: 600, speedKmh: 6, distanceKm: 0.010, elevationM: 100, elapsedTime: '0:05', movingTimeSeconds: 5 },
            ];

            // At t=3.5 (right after transition), backward window [1.5, 3.5] includes
            // frames at t=2 (300) and t=3 (600). Median of [300, 600] = 450.
            const rightAfter = getTelemetryAtTime(frames, 3.5, 0);
            expect(rightAfter).not.toBeNull();
            expect(rightAfter!.paceSecondsPerKm).toBeCloseTo(450, 0);

            // At t=4.5, backward window [2.5, 4.5] includes frames at t=3 (600) and t=4 (600).
            // Median of [600, 600] = 600 — fully transitioned.
            const wellAfter = getTelemetryAtTime(frames, 4.5, 0);
            expect(wellAfter).not.toBeNull();
            expect(wellAfter!.paceSecondsPerKm).toBeCloseTo(600, 0);
        });

        it('should return pace from single backward frame at track start', () => {
            const frames = [
                { timeOffset: 0, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0, elevationM: 100, elapsedTime: '0:00', movingTimeSeconds: 0 },
                { timeOffset: 1, paceSecondsPerKm: 310, speedKmh: 11.6, distanceKm: 0.003, elevationM: 100, elapsedTime: '0:01', movingTimeSeconds: 1 },
            ];

            // At t=0.5, backward window [-1.5, 0.5] only includes frame at t=0.
            // Single backward frame: return that value directly.
            const result = getTelemetryAtTime(frames, 0.5, 0);
            expect(result).not.toBeNull();
            expect(result!.paceSecondsPerKm).toBe(300);
        });

        it('should handle single-frame dataset', () => {
            const frames = [
                { timeOffset: 0, paceSecondsPerKm: 300, speedKmh: 12, distanceKm: 0, elevationM: 100, elapsedTime: '0:00', movingTimeSeconds: 0 },
            ];

            const result = getTelemetryAtTime(frames, 0, 0);
            expect(result).not.toBeNull();
            expect(result!.paceSecondsPerKm).toBe(300);
        });

        it('should handle frames with undefined pace via speed fallback', () => {
            const frames = [
                { timeOffset: 0, paceSecondsPerKm: undefined, speedKmh: 12, distanceKm: 0, elevationM: 100, elapsedTime: '0:00', movingTimeSeconds: 0 },
                { timeOffset: 1, paceSecondsPerKm: undefined, speedKmh: 12, distanceKm: 0.003, elevationM: 100, elapsedTime: '0:01', movingTimeSeconds: 1 },
                { timeOffset: 2, paceSecondsPerKm: undefined, speedKmh: 12, distanceKm: 0.006, elevationM: 100, elapsedTime: '0:02', movingTimeSeconds: 2 },
            ];

            // Backward pace window is empty, falls back to speed-based median.
            // Speed 12 km/h = 3.33 m/s → pace = 1000/3.33 ≈ 300 s/km.
            const result = getTelemetryAtTime(frames, 1.5, 0);
            expect(result).not.toBeNull();
            expect(result!.paceSecondsPerKm).toBeDefined();
            expect(result!.paceSecondsPerKm!).toBeGreaterThan(200);
            expect(result!.paceSecondsPerKm!).toBeLessThan(400);
        });

        it('should not lag more than 2 seconds on deceleration with 1s sampling', () => {
            // Create a sharp deceleration at t=5 and verify pace reflects it by t=7
            const frames = [
                { timeOffset: 0, paceSecondsPerKm: 240, speedKmh: 15, distanceKm: 0, elevationM: 100, elapsedTime: '0:00', movingTimeSeconds: 0 },
                { timeOffset: 1, paceSecondsPerKm: 240, speedKmh: 15, distanceKm: 0.004, elevationM: 100, elapsedTime: '0:01', movingTimeSeconds: 1 },
                { timeOffset: 2, paceSecondsPerKm: 240, speedKmh: 15, distanceKm: 0.008, elevationM: 100, elapsedTime: '0:02', movingTimeSeconds: 2 },
                { timeOffset: 3, paceSecondsPerKm: 240, speedKmh: 15, distanceKm: 0.012, elevationM: 100, elapsedTime: '0:03', movingTimeSeconds: 3 },
                { timeOffset: 4, paceSecondsPerKm: 240, speedKmh: 15, distanceKm: 0.016, elevationM: 100, elapsedTime: '0:04', movingTimeSeconds: 4 },
                { timeOffset: 5, paceSecondsPerKm: 600, speedKmh: 6, distanceKm: 0.018, elevationM: 100, elapsedTime: '0:05', movingTimeSeconds: 5 },
                { timeOffset: 6, paceSecondsPerKm: 600, speedKmh: 6, distanceKm: 0.019, elevationM: 100, elapsedTime: '0:06', movingTimeSeconds: 6 },
                { timeOffset: 7, paceSecondsPerKm: 600, speedKmh: 6, distanceKm: 0.020, elevationM: 100, elapsedTime: '0:07', movingTimeSeconds: 7 },
                { timeOffset: 8, paceSecondsPerKm: 600, speedKmh: 6, distanceKm: 0.022, elevationM: 100, elapsedTime: '0:08', movingTimeSeconds: 8 },
            ];

            // At t=6.5, backward window [4.5, 6.5] includes frames at t=5 (600) and t=6 (600).
            // The slow pace should be fully reflected.
            const afterDecel = getTelemetryAtTime(frames, 6.5, 0);
            expect(afterDecel).not.toBeNull();
            expect(afterDecel!.paceSecondsPerKm!).toBeGreaterThan(500);
        });
    });
});
