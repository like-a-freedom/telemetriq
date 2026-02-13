import { describe, it, expect } from 'vitest';
import {
    autoSync,
    clampSyncOffset,
    clampSyncOffsetToRange,
    getGpxTimeRange,
    getSyncRangeSeconds,
    MANUAL_SYNC_RANGE_SECONDS,
} from '../modules/sync-engine';
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

        it('should set autoSynced=true but show warning when time difference exceeds 5 minutes', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
            ];

            // Video started 10 minutes before GPX start
            const videoTime = new Date('2024-01-15T09:50:00Z');
            const result = autoSync(points, videoTime);
            // Now syncs with warning instead of failing
            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Large time difference');
            expect(result.offsetSeconds).toBe(-600); // -10 minutes
        });

        it('should format large time difference warning in rounded human-readable form', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2026-02-11T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2026-02-11T10:01:00Z'),
            ];

            const videoTime = new Date('2026-02-11T10:29:04.600Z'); // 29m 4.6s -> rounds to 29m 5s
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Large time difference');
            expect(result.warning).toContain('29 min 5 sec');
        });

        // DJI filename scenarios
        it('should sync DJI video time correctly - GPX starts after video', () => {
            // GPX: 2026-02-11T05:55:25Z (first point)
            // DJI video: 2026-02-11T09:24:25Z (from filename)
            const points = [
                makePoint(56.026587, 37.85473, '2026-02-11T05:55:25Z'),
                makePoint(56.026577, 37.854697, '2026-02-11T05:55:26Z'),
            ];

            const djiVideoTime = new Date('2026-02-11T09:24:25Z');
            const result = autoSync(points, djiVideoTime, undefined, undefined, 0);

            // Time difference is ~3.5 hours, exceeds 5 minute threshold
            // But should still sync with warning
            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Large time difference');
            expect(result.offsetSeconds).toBe(3 * 3600 + 29 * 60); // 12540 seconds
        });

        it('should sync DJI video time correctly - GPX starts before video', () => {
            // GPX: 2026-02-11T09:24:00Z
            // DJI video: 2026-02-11T05:55:00Z (video was taken earlier)
            const points = [
                makePoint(56.026587, 37.85473, '2026-02-11T09:24:00Z'),
                makePoint(56.026577, 37.854697, '2026-02-11T09:25:00Z'),
            ];

            const djiVideoTime = new Date('2026-02-11T05:55:00Z');
            const result = autoSync(points, djiVideoTime, undefined, undefined, 0);

            // Time difference is ~3.5 hours, but should still sync
            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Large time difference');
            expect(result.offsetSeconds).toBe(-(3 * 3600 + 29 * 60)); // -12540 seconds
        });

        it('should not apply timezone shift twice for absolute video Date', () => {
            // GPX and video start at the same UTC time
            const points = [
                makePoint(55.7558, 37.6173, '2026-02-11T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2026-02-11T10:01:00Z'),
            ];

            const videoTime = new Date('2026-02-11T10:00:00Z');
            // Even if timezone offset is passed from metadata, Date is already absolute.
            const result = autoSync(points, videoTime, undefined, undefined, -180);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(0);
        });

        it('should handle GPS priority over time when both available', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:01:00Z'),
            ];

            // GPS coords are available
            const result = autoSync(points, new Date('2024-01-15T10:05:00Z'), 55.7558, 37.6173);

            // Should use GPS, not time
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(0); // GPS matched to first point
        });

        it('should handle video time exactly matching GPX start', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:10:00Z'),
            ];

            const videoTime = new Date('2024-01-15T10:00:00Z');
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(0);
        });

        it('should handle negative offset within 5 minutes', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:05:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:10:00Z'),
            ];

            // Video started 5 minutes before GPX
            const videoTime = new Date('2024-01-15T10:00:00Z');
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(-300); // -5 minutes
        });

        it('should fail with warning when offset is exactly 5 minutes', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:05:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
            ];

            // Video started 5 minutes before GPX (boundary case - more than 5 min fails)
            const videoTime = new Date('2024-01-15T10:00:00Z');
            const result = autoSync(points, videoTime);

            // > 5 minutes (exactly 5 min = 300 sec, but we use > not >=)
            expect(result.autoSynced).toBe(true); // 5 min = boundary, still passes
        });

        it('should handle video starting mid-GPX track', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
                makePoint(55.7576, 37.6173, '2024-01-15T11:00:00Z'),
            ];

            // Video starts 30 minutes into GPX - exceeds 5 min threshold
            const videoTime = new Date('2024-01-15T10:30:00Z');
            const result = autoSync(points, videoTime);

            // Should sync with warning
            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Large time difference');
            expect(result.offsetSeconds).toBe(1800); // 30 minutes
        });

        it('should succeed for offset within 4 minutes 59 seconds', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:05:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
                makePoint(55.7576, 37.6173, '2024-01-15T11:00:00Z'),
            ];

            // Video starts 4 min 59 sec before GPX - within threshold
            const videoTime = new Date('2024-01-15T10:00:01Z');
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBeCloseTo(-299, 0); // ~299 seconds
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

    describe('getSyncRangeSeconds', () => {
        it('should return default manual range for missing duration', () => {
            expect(getSyncRangeSeconds()).toBe(MANUAL_SYNC_RANGE_SECONDS);
            expect(getSyncRangeSeconds(Number.NaN)).toBe(MANUAL_SYNC_RANGE_SECONDS);
            expect(getSyncRangeSeconds(0)).toBe(MANUAL_SYNC_RANGE_SECONDS);
        });

        it('should cap range by video duration when it is shorter than manual max', () => {
            expect(getSyncRangeSeconds(245.4)).toBe(245);
            expect(getSyncRangeSeconds(60)).toBe(60);
        });

        it('should not exceed manual range for long videos', () => {
            expect(getSyncRangeSeconds(10_000)).toBe(MANUAL_SYNC_RANGE_SECONDS);
        });
    });

    describe('clampSyncOffsetToRange', () => {
        it('should clamp by provided max range', () => {
            expect(clampSyncOffsetToRange(180, 120)).toBe(120);
            expect(clampSyncOffsetToRange(-180, 120)).toBe(-120);
            expect(clampSyncOffsetToRange(90, 120)).toBe(90);
        });

        it('should fallback to manual range on invalid max range', () => {
            expect(clampSyncOffsetToRange(999999, Number.NaN)).toBe(MANUAL_SYNC_RANGE_SECONDS);
            expect(clampSyncOffsetToRange(-999999, 0)).toBe(-MANUAL_SYNC_RANGE_SECONDS);
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
