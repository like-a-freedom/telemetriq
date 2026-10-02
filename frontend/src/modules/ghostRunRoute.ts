import type { TelemetryFrame } from '../core/types';

export interface GhostRoutePoint {
    x: number;
    y: number;
    timeOffset: number;
}

export interface GhostElevationPoint {
    distanceKm: number;
    elevationM: number;
}

export interface GhostRunRoute {
    /** Coordinates in local projected degrees; the renderer preserves aspect. */
    points: readonly GhostRoutePoint[];
    trace: readonly GhostRoutePoint[];
    profile: readonly GhostElevationPoint[];
    totalDistanceKm: number;
    ascentM?: number;
    descentM?: number;
    startTimestampMs?: number;
    bounds: { minX: number; minY: number; width: number; height: number };
}

const routeCache = new WeakMap<readonly TelemetryFrame[], GhostRunRoute>();
const MAX_TRACE_POINTS = 384;

/** Build once per immutable telemetry timeline, shared by preview and export. */
export function getGhostRunRoute(frames: readonly TelemetryFrame[]): GhostRunRoute {
    const cached = routeCache.get(frames);
    if (cached) return cached;

    const positions = frames.filter((frame) => Number.isFinite(frame.latitude)
        && Number.isFinite(frame.longitude) && Math.abs(frame.latitude!) <= 90
        && Math.abs(frame.longitude!) <= 180 && Number.isFinite(frame.timeOffset));
    const origin = positions[0];
    const longitudeScale = origin ? Math.max(0.001, Math.cos(origin.latitude! * Math.PI / 180)) : 1;
    let unwrappedLongitude = 0;
    let previousLongitude = origin?.longitude ?? 0;
    const points = positions.map((frame) => {
        const delta = ((frame.longitude! - previousLongitude + 540) % 360) - 180;
        unwrappedLongitude += delta;
        previousLongitude = frame.longitude!;
        return {
            x: unwrappedLongitude * longitudeScale,
            y: origin!.latitude! - frame.latitude!,
            timeOffset: frame.timeOffset,
        };
    });

    let ascentM = 0;
    let descentM = 0;
    let hasElevationSegment = false;
    const elevation: GhostElevationPoint[] = [];
    let previous: TelemetryFrame | undefined;
    for (const frame of frames) {
        if (Number.isFinite(frame.elevationM) && Number.isFinite(frame.distanceKm)) {
            elevation.push({ distanceKm: frame.distanceKm, elevationM: frame.elevationM! });
            // A missing sample breaks the segment; do not invent gain across gaps.
            if (previous && Number.isFinite(previous.elevationM) && frame.distanceKm > previous.distanceKm) {
                const difference = frame.elevationM! - previous.elevationM!;
                ascentM += Math.max(0, difference);
                descentM += Math.max(0, -difference);
                hasElevationSegment = true;
            }
        }
        previous = frame;
    }

    const first = frames[0];
    const bounds = points.reduce((box, point) => ({
        minX: Math.min(box.minX, point.x), minY: Math.min(box.minY, point.y),
        maxX: Math.max(box.maxX, point.x), maxY: Math.max(box.maxY, point.y),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const route: GhostRunRoute = {
        points,
        trace: sampleTrace(points),
        profile: sampleProfile(elevation),
        totalDistanceKm: frames.reduce((total, frame) => Number.isFinite(frame.distanceKm) ? Math.max(total, frame.distanceKm) : total, 0),
        ascentM: hasElevationSegment ? ascentM : undefined,
        descentM: hasElevationSegment ? descentM : undefined,
        startTimestampMs: first && Number.isFinite(first.timestampMs)
            ? first.timestampMs! - first.timeOffset * 1000 : undefined,
        bounds: points.length ? { minX: bounds.minX, minY: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY }
            : { minX: 0, minY: 0, width: 0, height: 0 },
    };
    routeCache.set(frames, route);
    return route;
}

function sampleTrace<T>(points: readonly T[]): readonly T[] {
    if (points.length <= MAX_TRACE_POINTS) return points;
    return Array.from({ length: MAX_TRACE_POINTS }, (_, index) =>
        points[Math.round(index * (points.length - 1) / (MAX_TRACE_POINTS - 1))]!);
}

/** Keep the local extrema instead of smoothing hills out of a long activity. */
function sampleProfile(points: readonly GhostElevationPoint[]): readonly GhostElevationPoint[] {
    if (points.length <= MAX_TRACE_POINTS) return points;
    const result = [points[0]!];
    const bucketCount = MAX_TRACE_POINTS / 2 - 1;
    for (let bucket = 0; bucket < bucketCount; bucket++) {
        const start = 1 + Math.floor(bucket * (points.length - 2) / bucketCount);
        const end = 1 + Math.floor((bucket + 1) * (points.length - 2) / bucketCount);
        let low = start;
        let high = start;
        for (let index = start + 1; index < end; index++) {
            if (points[index]!.elevationM < points[low]!.elevationM) low = index;
            if (points[index]!.elevationM > points[high]!.elevationM) high = index;
        }
        for (const index of [...new Set([low, high])].sort((a, b) => a - b)) result.push(points[index]!);
    }
    result.push(points[points.length - 1]!);
    return result;
}

/** Interpolate by recording time so loops and stationary points remain unambiguous. */
export function getGhostRoutePosition(route: GhostRunRoute, timeOffset: number): GhostRoutePoint | undefined {
    const points = route.points;
    if (!points.length || !Number.isFinite(timeOffset)) return undefined;
    if (timeOffset <= points[0]!.timeOffset) return points[0];
    if (timeOffset >= points[points.length - 1]!.timeOffset) return points[points.length - 1];
    let low = 0;
    let high = points.length - 1;
    while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (points[middle]!.timeOffset <= timeOffset) low = middle;
        else high = middle;
    }
    const before = points[low]!;
    const after = points[high]!;
    const factor = (timeOffset - before.timeOffset) / (after.timeOffset - before.timeOffset || 1);
    return { x: before.x + (after.x - before.x) * factor, y: before.y + (after.y - before.y) * factor, timeOffset };
}
