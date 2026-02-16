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
} from '../modules/telemetry-core';
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

        it('should propagate elevation from GPX points into telemetry frames', () => {
            const points = [
                makePointWithElevation(55.7558, 37.6173, '2024-01-15T10:00:00Z', 120, 140),
                makePointWithElevation(55.7567, 37.6173, '2024-01-15T10:00:30Z', 125, 145),
            ];

            const timeline = buildTelemetryTimeline(points);
            expect(timeline[0]!.elevationM).toBe(120);
            expect(timeline[1]!.elevationM).toBe(125);
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
            expect(a!.paceSecondsPerKm).toBeCloseTo(b!.paceSecondsPerKm!, 10);
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
            // With 2-second window, pace should update within 2-3 seconds after speed change
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

            // Check pace at second 7 (3 seconds after speed change, should reflect running)
            // With 2-second minimum window, we should see significant speedup by now
            const runningPace = getTelemetryAtTime(frames, 7, 0);
            expect(runningPace).not.toBeNull();
            expect(runningPace!.paceSecondsPerKm).toBeDefined();

            // Running should be significantly faster than walking
            // Walking ~500 sec/km, running ~250 sec/km
            // With 2s window and transition, running pace should be at least 20% faster
            expect(runningPace!.paceSecondsPerKm!).toBeLessThan(walkingPace!.paceSecondsPerKm! * 0.8);

            // By second 8, pace should be very close to true running pace
            const settledPace = getTelemetryAtTime(frames, 8, 0);
            expect(settledPace!.paceSecondsPerKm!).toBeLessThan(350); // Close to 250 sec/km
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
    });
});
