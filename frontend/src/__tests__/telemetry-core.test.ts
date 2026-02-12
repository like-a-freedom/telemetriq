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
        it('should return undefined for negligible distance', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.0, 37.0, '2024-01-15T10:00:05Z');
            expect(calculatePace(p1, p2, 0, 0.0001)).toBeUndefined();
        });

        it('should return undefined for zero time diff', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.001, 37.001, '2024-01-15T10:00:00Z');
            expect(calculatePace(p1, p2, 0, 0.5)).toBeUndefined();
        });

        it('should calculate pace for reasonable running speed (~5:00/km)', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.001, 37.001, '2024-01-15T10:05:00Z');

            // 300 seconds, 1 km -> 300 sec/km = 5:00/km
            const pace = calculatePace(p1, p2, 0, 1.0);
            expect(pace).toBe(300);
        });

        it('should return undefined for unreasonably fast pace (<2:00/km)', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.001, 37.001, '2024-01-15T10:01:00Z');

            // 60 seconds for 1km = 1:00/km - too fast
            const pace = calculatePace(p1, p2, 0, 1.0);
            expect(pace).toBeUndefined();
        });

        it('should return undefined for unreasonably slow pace (>30:00/km)', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.001, 37.001, '2024-01-15T10:31:00Z');

            // 1860 seconds for 1km = 31:00/km - too slow
            const pace = calculatePace(p1, p2, 0, 1.0);
            expect(pace).toBeUndefined();
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

        it('should handle negative values', () => {
            expect(lerp(-10, 10, 0.5)).toBe(0);
        });
    });

    describe('interpolateHr', () => {
        it('should return undefined when both hr values are undefined', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.0, 37.0, '2024-01-15T10:00:10Z');
            expect(interpolateHr(p1, p2, new Date('2024-01-15T10:00:05Z'))).toBeUndefined();
        });

        it('should return after.hr when before.hr is undefined', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z');
            const p2 = makePoint(55.0, 37.0, '2024-01-15T10:00:10Z', 150);
            expect(interpolateHr(p1, p2, new Date('2024-01-15T10:00:05Z'))).toBe(150);
        });

        it('should return before.hr when after.hr is undefined', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z', 140);
            const p2 = makePoint(55.0, 37.0, '2024-01-15T10:00:10Z');
            expect(interpolateHr(p1, p2, new Date('2024-01-15T10:00:05Z'))).toBe(140);
        });

        it('should interpolate linearly between two HR values', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z', 140);
            const p2 = makePoint(55.0, 37.0, '2024-01-15T10:00:10Z', 160);
            const hr = interpolateHr(p1, p2, new Date('2024-01-15T10:00:05Z'));
            expect(hr).toBe(150); // Midpoint of 140 and 160
        });

        it('should clamp interpolation within bounds', () => {
            const p1 = makePoint(55.0, 37.0, '2024-01-15T10:00:00Z', 140);
            const p2 = makePoint(55.0, 37.0, '2024-01-15T10:00:10Z', 160);
            // Target time before first point
            const hr = interpolateHr(p1, p2, new Date('2024-01-15T09:59:50Z'));
            expect(hr).toBe(140); // Clamped to t=0
        });
    });

    describe('formatElapsedTime', () => {
        it('should format zero seconds', () => {
            expect(formatElapsedTime(0)).toBe('00:00:00');
        });

        it('should format seconds only', () => {
            expect(formatElapsedTime(45)).toBe('00:00:45');
        });

        it('should format minutes and seconds', () => {
            expect(formatElapsedTime(125)).toBe('00:02:05');
        });

        it('should format hours, minutes, and seconds', () => {
            expect(formatElapsedTime(3661)).toBe('01:01:01');
        });

        it('should handle large values', () => {
            expect(formatElapsedTime(7200)).toBe('02:00:00');
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
            expect(timeline[0]!.elapsedTime).toBe('00:00:00');

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

        it('should apply sync offset correctly', () => {
            // With offset of 30, videoTime=0 maps to gpxTime=30
            const result = getTelemetryAtTime(frames, 0, 30);
            expect(result).not.toBeNull();
            expect(result!.hr).toBe(150); // Frame at t=30
        });

        it('should interpolate distance', () => {
            const result = getTelemetryAtTime(frames, 15, 0);
            expect(result).not.toBeNull();
            expect(result!.distanceKm).toBeGreaterThan(0);
            expect(result!.distanceKm).toBeLessThan(frames[1]!.distanceKm);
        });
    });
});
