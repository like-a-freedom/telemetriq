import { describe, it, expect } from 'vitest';
import { autoSync, clampSyncOffset, getGpxTimeRange, MANUAL_SYNC_RANGE_SECONDS } from '../modules/sync-engine';
import type { TrackPoint } from '../core/types';
import { SyncError } from '../core/errors';

function makePoint(lat: number, lon: number, timeStr: string): TrackPoint {
    return {
        lat,
        lon,
        time: new Date(timeStr),
    };
}

describe('Sync Engine', () => {
    describe('autoSync', () => {
        it('should throw SyncError for empty points', () => {
            expect(() => autoSync([])).toThrow(SyncError);
        });

        it('should return offset=0 and autoSynced=false when no GPS or time provided', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:01:00Z'),
            ];

            const result = autoSync(points);
            expect(result.offsetSeconds).toBe(0);
            expect(result.autoSynced).toBe(false);
            expect(result.warning).toBeTruthy();
        });

        it('should sync by GPS coordinates to nearest point', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:00:30Z'),
                makePoint(55.7576, 37.6173, '2024-01-15T10:01:00Z'),
            ];

            // Coordinates closest to the third point
            const result = autoSync(points, undefined, 55.7576, 37.6173);
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(60); // 60 seconds from start to third point
        });

        it('should sync by GPS coordinates to first point when coordinates match', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:00:30Z'),
            ];

            const result = autoSync(points, undefined, 55.7558, 37.6173);
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(0);
        });

        it('should sync by video time when within 5 minutes', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:10:00Z'),
            ];

            // Video started 2 minutes after GPX start
            const videoTime = new Date('2024-01-15T10:02:00Z');
            const result = autoSync(points, videoTime);
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(120);
        });

        it('should set autoSynced=false when time difference exceeds 5 minutes', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
            ];

            // Video started 10 minutes before GPX start
            const videoTime = new Date('2024-01-15T09:50:00Z');
            const result = autoSync(points, videoTime);
            expect(result.autoSynced).toBe(false);
            expect(result.warning).toBeTruthy();
        });
    });

    describe('clampSyncOffset', () => {
        it('should keep offset within range', () => {
            expect(clampSyncOffset(100)).toBe(100);
        });

        it('should normalize NaN to zero', () => {
            expect(clampSyncOffset(Number.NaN)).toBe(0);
        });

        it('should normalize Infinity to zero', () => {
            expect(clampSyncOffset(Number.POSITIVE_INFINITY)).toBe(0);
            expect(clampSyncOffset(Number.NEGATIVE_INFINITY)).toBe(0);
        });

        it('should clamp to positive max', () => {
            expect(clampSyncOffset(MANUAL_SYNC_RANGE_SECONDS + 100)).toBe(MANUAL_SYNC_RANGE_SECONDS);
        });

        it('should clamp to negative max', () => {
            expect(clampSyncOffset(-MANUAL_SYNC_RANGE_SECONDS - 100)).toBe(-MANUAL_SYNC_RANGE_SECONDS);
        });

        it('should handle zero', () => {
            expect(clampSyncOffset(0)).toBe(0);
        });
    });

    describe('getGpxTimeRange', () => {
        it('should return null for empty or single point', () => {
            expect(getGpxTimeRange([])).toBeNull();
            expect(getGpxTimeRange([makePoint(55.0, 37.0, '2024-01-15T10:00:00Z')])).toBeNull();
        });

        it('should return correct time range', () => {
            const points = [
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.1, 37.1, '2024-01-15T10:30:00Z'),
            ];

            const range = getGpxTimeRange(points);
            expect(range).not.toBeNull();
            expect(range!.durationMs).toBe(30 * 60 * 1000); // 30 minutes in ms
        });
    });
});
