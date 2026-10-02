import { describe, expect, it } from 'vitest';
import type { TelemetryFrame, TrackPoint } from '../core/types';
import { getGhostRoutePosition, getGhostRunRoute } from '../modules/ghostRunRoute';
import { buildTelemetryTimeline, getTelemetryAtTime } from '../modules/telemetryCore';
import { getTemplateDefinition } from '../modules/templates';

function frame(timeOffset: number, distanceKm: number, latitude = 45, longitude = 10, elevationM?: number): TelemetryFrame {
    return { timeOffset, distanceKm, latitude, longitude, elevationM,
        timestampMs: Date.UTC(2026, 9, 2, 8, 12) + timeOffset * 1000,
        elapsedTime: '00:00:00', movingTimeSeconds: timeOffset };
}

describe('Ghost Run route', () => {
    it('registers a transparent HUD with only the metrics it renders', () => {
        const template = getTemplateDefinition('ghost-run')!;
        expect(template.metadata.name).toBe('Ghost Run');
        expect(template.config.layoutMode).toBe('ghost-run');
        expect(template.config.backgroundOpacity).toBe(0);
        expect(template.capabilities.supportedMetrics).toEqual(['pace', 'distance', 'time', 'hr', 'elevation', 'grade']);
        expect(template.capabilities.supportsBackgroundOpacity).toBe(false);
    });

    it('retains GPX positions and time through timeline creation and between-frame lookups', () => {
        const points: TrackPoint[] = [0, 1, 2].map((index) => ({
            lat: 45 + index * 0.0001, lon: 10 + index * 0.0001,
            ele: 100 + index * 2, time: new Date(Date.UTC(2026, 9, 2, 8, 12) + index * 1000),
        }));
        const frames = buildTelemetryTimeline(points);
        const current = getTelemetryAtTime(frames, 0.5, 0)!;
        expect(current.latitude).toBeCloseTo(45.00005, 7);
        expect(current.longitude).toBeCloseTo(10.00005, 7);
        expect(current.timestampMs).toBe(points[0]!.time.getTime() + 500);
        const route = getGhostRunRoute(frames);
        expect(route.startTimestampMs).toBe(points[0]!.time.getTime());
        expect(getGhostRoutePosition(route, current.timeOffset)!.y).toBeCloseTo(-0.00005, 7);
    });

    it('uses recording time to locate the athlete even on a loop or pause', () => {
        const frames = [frame(0, 0, 45, 10), frame(10, 1, 45.001, 10.001),
            frame(20, 1, 45.001, 10.001), frame(30, 2, 45, 10)];
        const route = getGhostRunRoute(frames);
        expect(getGhostRunRoute(frames)).toBe(route);
        expect(getGhostRoutePosition(route, 15)!.y).toBeCloseTo(-0.001);
        expect(getGhostRoutePosition(route, 25)!.y).toBeCloseTo(-0.0005);
        expect(getGhostRoutePosition(route, -1)).toBe(route.points[0]);
        expect(getGhostRoutePosition(route, 100)).toBe(route.points.at(-1));
    });

    it('keeps antimeridian tracks compact and interpolates longitude across the short arc', () => {
        const frames = [frame(0, 0, 0, 179.9), frame(10, 1, 0, -179.9)];
        const route = getGhostRunRoute(frames);
        expect(route.bounds.width).toBeCloseTo(0.2);
        expect(Math.abs(getTelemetryAtTime(frames, 5, 0)!.longitude!)).toBeCloseTo(180);
    });

    it('does not invent elevation or positions and does not bridge missing elevation samples', () => {
        const frames = [frame(0, 0, 45, 10, 100), frame(1, 0.1, 45, 10, 110),
            frame(2, 0.2), frame(3, 0.3, 45, 10, 300), frame(4, 0.4, 45, 10, 295)];
        const route = getGhostRunRoute(frames);
        expect(route.ascentM).toBe(10);
        expect(route.descentM).toBe(5);
        const empty = getGhostRunRoute([{ timeOffset: 0, distanceKm: 0, elapsedTime: '0:00', movingTimeSeconds: 0 }]);
        expect(empty.points).toEqual([]);
        expect(empty.profile).toEqual([]);
        expect(empty.ascentM).toBeUndefined();
        expect(empty.startTimestampMs).toBeUndefined();
    });

    it('bounds drawing cost while retaining endpoints and narrow elevation peaks', () => {
        const frames = Array.from({ length: 20_000 }, (_, i) => frame(i, i / 1000, 45 + i / 1e6, 10 + i / 1e6, i === 10001 ? 1000 : 100));
        const route = getGhostRunRoute(frames);
        expect(route.trace.length).toBeLessThanOrEqual(384);
        expect(route.profile.length).toBeLessThanOrEqual(384);
        expect(route.trace[0]).toBe(route.points[0]);
        expect(route.trace.at(-1)).toBe(route.points.at(-1));
        expect(Math.max(...route.profile.map((point) => point.elevationM))).toBe(1000);
        expect(route.totalDistanceKm).toBe(19.999);
    });

    it('returns no position for empty routes or unusable lookup times', () => {
        const route = getGhostRunRoute([frame(0, 0), frame(10, 1)]);
        const empty = getGhostRunRoute([{ timeOffset: 0, distanceKm: 0, elapsedTime: '0:00', movingTimeSeconds: 0 }]);

        expect(getGhostRoutePosition(empty, 5)).toBeUndefined();
        expect(getGhostRoutePosition(route, Number.NaN)).toBeUndefined();
        expect(getGhostRoutePosition(route, Number.POSITIVE_INFINITY)).toBeUndefined();
        expect(empty.bounds).toEqual({ minX: 0, minY: 0, width: 0, height: 0 });
    });

    it('ignores non-finite distances instead of poisoning the route total', () => {
        const frames = [
            frame(0, 0),
            frame(10, Number.NaN),
            frame(20, 2.5),
            { ...frame(30, 1), distanceKm: Number.POSITIVE_INFINITY },
            { ...frame(40, 1), distanceKm: undefined as unknown as number },
        ];

        expect(getGhostRunRoute(frames).totalDistanceKm).toBe(2.5);
    });

    it('keeps a sustained descent in the sampled elevation profile, not only peaks', () => {
        const frames = Array.from({ length: 500 }, (_, i) =>
            frame(i, i / 1000, 45 + i / 1e6, 10 + i / 1e6, 1000 - i * 2));
        const route = getGhostRunRoute(frames);
        const elevations = route.profile.map((point) => point.elevationM);

        expect(route.profile.length).toBeLessThanOrEqual(384);
        expect(elevations.at(-1)).toBe(1000 - 499 * 2);
        // Bucket minima survive sampling all the way down the hill.
        expect(elevations.every((value, index) => index === 0 || elevations[index - 1]! >= value)).toBe(true);
        expect(Math.min(...elevations)).toBe(1000 - 499 * 2);
    });
});
