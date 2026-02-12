import { describe, it, expect } from 'vitest';
import { buildTelemetryTimeline } from '../modules/telemetry-core';
import { autoSync } from '../modules/sync-engine';
import type { TrackPoint } from '../core/types';

function generatePoints(start: Date, minutes: number): TrackPoint[] {
    const points: TrackPoint[] = [];
    const totalSeconds = minutes * 60;
    const step = 10;
    for (let t = 0; t <= totalSeconds; t += step) {
        points.push({
            lat: 55 + t * 0.0001,
            lon: 37 + t * 0.0001,
            time: new Date(start.getTime() + t * 1000),
            hr: 140 + (t % 20),
        });
    }
    return points;
}

describe('Integration flow', () => {
    it('should build timeline for 1-minute track', () => {
        const points = generatePoints(new Date('2024-01-01T10:00:00Z'), 1);
        const frames = buildTelemetryTimeline(points);
        expect(frames.length).toBe(points.length);
    });

    it('should build timeline for 10-minute track', () => {
        const points = generatePoints(new Date('2024-01-01T10:00:00Z'), 10);
        const frames = buildTelemetryTimeline(points);
        expect(frames.length).toBe(points.length);
    });

    it('should build timeline for 30-minute track', () => {
        const points = generatePoints(new Date('2024-01-01T10:00:00Z'), 30);
        const frames = buildTelemetryTimeline(points);
        expect(frames.length).toBe(points.length);
    });

    it('should compute auto sync offset for matching start time', () => {
        const points = generatePoints(new Date('2024-01-01T10:00:00Z'), 10);
        const videoStart = new Date('2024-01-01T10:02:00Z');
        const sync = autoSync(points, videoStart);
        expect(sync.offsetSeconds).toBe(120);
    });
});
