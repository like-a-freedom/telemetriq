import type { TrackPoint } from '../../core/types';

export function lerp(v0: number, v1: number, t: number): number {
    return v0 + t * (v1 - v0);
}

export function interpolateOptionalValue(
    before: number | undefined,
    after: number | undefined,
    t: number,
): number | undefined {
    if (before !== undefined && after !== undefined) {
        return lerp(before, after, t);
    }
    return before ?? after;
}

export function interpolateHr(
    before: TrackPoint,
    after: TrackPoint,
    targetTime: Date,
): number | undefined {
    if (before.hr === undefined && after.hr === undefined) return undefined;
    if (before.hr === undefined) return after.hr;
    if (after.hr === undefined) return before.hr;

    const totalMs = after.time.getTime() - before.time.getTime();
    if (totalMs <= 0) return before.hr;

    const t = (targetTime.getTime() - before.time.getTime()) / totalMs;
    return Math.round(lerp(before.hr, after.hr, Math.max(0, Math.min(1, t))));
}

export function formatElapsedTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
}

export function formatPace(secondsPerKm: number | undefined): string | undefined {
    if (secondsPerKm === undefined) return undefined;
    const roundedSeconds = Math.round(secondsPerKm);
    const minutes = Math.floor(roundedSeconds / 60);
    const seconds = roundedSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}