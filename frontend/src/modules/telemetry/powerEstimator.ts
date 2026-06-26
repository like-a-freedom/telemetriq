import type { TrackPoint } from '../../core/types';

const G = 9.80665;
const RHO = 1.225;
const CDA = 0.45;
const BASELINE_W = 75;
const SMOOTHING_WINDOW = 5;

function haversineMeters(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function medianFilter(values: (number | undefined)[], window: number): (number | undefined)[] {
    const result: (number | undefined)[] = new Array(values.length);
    const half = Math.floor(window / 2);
    for (let i = 0; i < values.length; i++) {
        const slice: number[] = [];
        for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
            if (values[j] !== undefined) {
                slice.push(values[j]!);
            }
        }
        if (slice.length === 0) {
            result[i] = undefined;
            continue;
        }
        slice.sort((a, b) => a - b);
        result[i] = slice[Math.floor(slice.length / 2)];
    }
    return result;
}

/**
 * Estimate running power from GPX track points using a physics-based model.
 *
 * Decomposes total power into:
 * - Gravity:    m × g × sin(atan(grade)) × v
 * - Air drag:   0.5 × CdA × ρ × v³
 * - Kinetic:    m × Δ(v²) / (2 × Δt)  (acceleration/deceleration)
 * - Baseline:   constant leg-turnover cost
 *
 * @param points  GPX track points (must have lat, lon, time; ele recommended)
 * @param weightKg  Runner body weight in kg
 * @returns Array of power values in watts (one per point; first/last may be undefined)
 */
export function estimateRunningPower(
    points: TrackPoint[],
    weightKg: number,
): (number | undefined)[] {
    if (points.length < 2 || weightKg <= 0) {
        return points.map(() => undefined);
    }

    const raw: (number | undefined)[] = [undefined];

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        const dt = (curr.time.getTime() - prev.time.getTime()) / 1000;
        if (dt <= 0 || dt > 300) {
            raw.push(undefined);
            continue;
        }

        const dist = haversineMeters(prev.lat, prev.lon, curr.lat, curr.lon);
        const v = dist / dt;

        if (v < 0.1) {
            raw.push(undefined);
            continue;
        }

        let pGravity = 0;
        if (prev.ele !== undefined && curr.ele !== undefined) {
            const dEle = curr.ele - prev.ele;
            const horiz = Math.sqrt(Math.max(0, dist * dist - dEle * dEle));
            const grade = horiz > 0 ? dEle / horiz : 0;
            pGravity = weightKg * G * Math.sin(Math.atan(grade)) * v;
        }

        const pAir = 0.5 * CDA * RHO * v * v * v;

        let pKinetic = 0;
        if (i >= 2) {
            const prevPrev = points[i - 2];
            const dt0 = (prev.time.getTime() - prevPrev.time.getTime()) / 1000;
            if (dt0 > 0 && dt0 < 300) {
                const dist0 = haversineMeters(prevPrev.lat, prevPrev.lon, prev.lat, prev.lon);
                const v0 = dist0 / dt0;
                pKinetic = (weightKg * (v * v - v0 * v0)) / (2 * dt);
            }
        }

        const pTotal = pGravity + pAir + Math.max(0, pKinetic) + BASELINE_W;
        raw.push(Math.max(0, pTotal));
    }

    const smoothed = medianFilter(raw, SMOOTHING_WINDOW);
    return smoothed.map((v) => (v !== undefined ? Math.round(v) : undefined));
}

/**
 * Check whether a point array already contains native power data from the GPX file.
 */
export function hasNativePowerData(points: TrackPoint[]): boolean {
    return points.some((p) => p.power !== undefined);
}

/**
 * Return a copy of `points` with estimated power injected when the GPX file
 * has no native power data and a runner weight is available.
 *
 * Returns the original array reference unchanged when native power exists
 * or when weight is not provided.
 */
export function preparePointsWithPower(
    points: TrackPoint[],
    weightKg: number | null,
): TrackPoint[] {
    if (hasNativePowerData(points) || !weightKg || weightKg <= 0) {
        return points;
    }

    const powers = estimateRunningPower(points, weightKg);
    return points.map((pt, i) => {
        const pw = powers[i];
        return pw !== undefined ? { ...pt, power: pw } : pt;
    });
}
