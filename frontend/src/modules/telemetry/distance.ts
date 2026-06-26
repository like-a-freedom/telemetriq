import type { TrackPoint } from '../../core/types';

export const EARTH_RADIUS_KM = 6371;

export const MOVING_SPEED_THRESHOLD_KMH = 1.0;
export const MIN_DISTANCE_FOR_PROGRESS_KM = 0.00001;

export function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

export function calculateCumulativeDistances(
    points: TrackPoint[],
    isStationary?: (index: number) => boolean,
): number[] {
    if (points.length === 0) return [];

    const distances: number[] = [0];

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]!;
        const curr = points[i]!;
        let segmentDist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);

        if (isStationary && isStationary(i)) {
            segmentDist = 0;
        } else if (segmentDist < MIN_DISTANCE_FOR_PROGRESS_KM) {
            segmentDist = 0;
        }

        distances.push(distances[i - 1]! + segmentDist);
    }

    return distances;
}

export function calculatePace(
    prevPoint: TrackPoint,
    currPoint: TrackPoint,
    prevDistance: number,
    currDistance: number,
): number | undefined {
    const distKm = currDistance - prevDistance;
    if (distKm < 0.001) return undefined;

    const timeDiffSec = (currPoint.time.getTime() - prevPoint.time.getTime()) / 1000;
    if (timeDiffSec <= 0) return undefined;

    const paceSecPerKm = timeDiffSec / distKm;

    if (paceSecPerKm < 120 || paceSecPerKm > 1800) return undefined;

    return paceSecPerKm;
}