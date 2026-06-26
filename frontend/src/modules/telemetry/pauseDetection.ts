import type { TrackPoint } from '../../core/types';
import { haversineDistance } from './distance';

const PAUSE_WINDOW_POINTS = 4;
const PAUSE_CLUSTER_DIAMETER_KM = 0.006;
const PAUSE_NET_DISPLACEMENT_KM = 0.003;

export function detectPausedPoints(points: TrackPoint[]): boolean[] {
    const pausedPoints = new Array(points.length).fill(false);

    if (points.length < PAUSE_WINDOW_POINTS) {
        return pausedPoints;
    }

    for (let end = PAUSE_WINDOW_POINTS - 1; end < points.length; end++) {
        const start = end - (PAUSE_WINDOW_POINTS - 1);

        if (!_isStationaryWindow(points, start, end)) {
            continue;
        }

        for (let i = start + 1; i <= end; i++) {
            pausedPoints[i] = true;
        }
    }

    return pausedPoints;
}

function _isStationaryWindow(points: TrackPoint[], start: number, end: number): boolean {
    const startPoint = points[start]!;
    const endPoint = points[end]!;
    const netDisplacementKm = haversineDistance(
        startPoint.lat, startPoint.lon,
        endPoint.lat, endPoint.lon,
    );

    if (netDisplacementKm > PAUSE_NET_DISPLACEMENT_KM) {
        return false;
    }

    for (let i = start; i < end; i++) {
        const leftPoint = points[i]!;

        for (let j = i + 1; j <= end; j++) {
            const rightPoint = points[j]!;
            const displacementKm = haversineDistance(
                leftPoint.lat, leftPoint.lon,
                rightPoint.lat, rightPoint.lon,
            );

            if (displacementKm > PAUSE_CLUSTER_DIAMETER_KM) {
                return false;
            }
        }
    }

    return true;
}