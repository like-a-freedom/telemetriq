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

        it('should sync by video time within GPX range without warning', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:10:00Z'),
            ];

            // Video started 2 minutes after GPX start — within range
            const videoTime = new Date('2024-01-15T10:02:00Z');
            const result = autoSync(points, videoTime);
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(120);
            expect(result.warning).toBeUndefined();
        });

        it('should warn when video time is outside GPX range', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
            ];

            // Video 10 minutes BEFORE GPX start → offset = -600 → outside [-300, 2100]
            const videoTime = new Date('2024-01-15T09:50:00Z');
            const result = autoSync(points, videoTime);
            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Video time is outside GPX range');
            expect(result.offsetSeconds).toBe(-600);
        });

        it('should format outside-range warning with human-readable time', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2026-02-11T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2026-02-11T10:01:00Z'),
            ];

            const videoTime = new Date('2026-02-11T10:29:04.600Z'); // 29m 4.6s → rounds to 29m 5s
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Video time is outside GPX range');
            expect(result.warning).toContain('29 min 5 sec');
        });

        // DJI video scenarios
        it('should sync DJI video time correctly — GPX starts after video', () => {
            // GPX: 05:55:25 to 05:55:26 (1-sec track)
            // DJI video: 09:24:25
            // offset = 3h29m = 12540s → outside range [−300, 1+300] → warning
            const points = [
                makePoint(56.026587, 37.85473, '2026-02-11T05:55:25Z'),
                makePoint(56.026577, 37.854697, '2026-02-11T05:55:26Z'),
            ];

            const djiVideoTime = new Date('2026-02-11T09:24:25Z');
            const result = autoSync(points, djiVideoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Video time is outside GPX range');
            expect(result.offsetSeconds).toBe(3 * 3600 + 29 * 60); // 12540 seconds
        });

        it('should sync DJI video time correctly — GPX starts before video', () => {
            // GPX: 09:24:00 to 09:25:00
            // DJI video: 05:55:00 → offset = −12540s → outside range
            const points = [
                makePoint(56.026587, 37.85473, '2026-02-11T09:24:00Z'),
                makePoint(56.026577, 37.854697, '2026-02-11T09:25:00Z'),
            ];

            const djiVideoTime = new Date('2026-02-11T05:55:00Z');
            const result = autoSync(points, djiVideoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Video time is outside GPX range');
            expect(result.offsetSeconds).toBe(-(3 * 3600 + 29 * 60)); // -12540 seconds
        });

        it('should not apply timezone shift twice for absolute video Date', () => {
            // GPX and video at the same UTC time → offset = 0
            const points = [
                makePoint(55.7558, 37.6173, '2026-02-11T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2026-02-11T10:01:00Z'),
            ];

            const videoTime = new Date('2026-02-11T10:00:00Z');
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(0);
        });

        it('should prefer GPS when GPS/time offsets are consistent', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:01:00Z'),
            ];

            const result = autoSync(points, new Date('2024-01-15T10:00:00Z'), 55.7558, 37.6173);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(0); // GPS matched to first point
        });

        it('should prefer time when GPS points to a different timeline segment', () => {
            const points = [
                makePoint(55.7559, 37.6174, '2024-01-15T10:00:00Z'),
                makePoint(55.7560, 37.6175, '2024-01-15T10:01:00Z'),
                // Same GPS position appears much later (loop)
                makePoint(55.7558, 37.6173, '2024-01-15T10:04:00Z'),
            ];

            const result = autoSync(points, new Date('2024-01-15T10:01:00Z'), 55.7558, 37.6173);

            // Time says +60s, GPS nearest in window would be offset 0 (first point)
            // or offset 240 (third point at 10:04, within 60±300 window)
            // Third point is exact GPS match → divergence = |240-60| = 180 > 30 → trust time
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(60);
            expect(result.warning).toContain('GPS location differs from video time');
            expect(result.warning).toContain('Time-based sync was applied');
        });

        it('should fall back to GPS when video time is outside GPX range', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:01:00Z'),
                makePoint(55.7576, 37.6173, '2024-01-15T10:02:00Z'),
            ];

            // 3+ hours away from GPX range → outside range → GPS fallback
            const result = autoSync(points, new Date('2024-01-15T13:20:00Z'), 55.7567, 37.6173);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(60); // GPS matched second point
            expect(result.warning).toContain('Video time is outside GPX range');
            expect(result.warning).toContain('GPS-based sync was applied');
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
            expect(result.warning).toBeUndefined();
        });

        it('should handle negative offset within buffer zone without warning', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:05:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:10:00Z'),
            ];

            // Video started 5 minutes before GPX → offset = −300
            // −300 >= −300 (buffer) → inside range → no warning
            const videoTime = new Date('2024-01-15T10:00:00Z');
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(-300);
            expect(result.warning).toBeUndefined();
        });

        it('should warn when offset is just outside buffer zone', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:05:01Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
            ];

            // Video 5m01s before GPX start → offset = −301 → outside range
            const videoTime = new Date('2024-01-15T10:00:00Z');
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.warning).toContain('Video time is outside GPX range');
            expect(result.offsetSeconds).toBeCloseTo(-301, 0);
        });

        it('should handle video starting mid-track without warning', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
                makePoint(55.7576, 37.6173, '2024-01-15T11:00:00Z'),
            ];

            // Video starts 30 minutes into a 60-minute GPX track → inside range
            const videoTime = new Date('2024-01-15T10:30:00Z');
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(1800);
            expect(result.warning).toBeUndefined();
        });

        it('should succeed for offset within 5 minutes of GPX start', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:05:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:30:00Z'),
                makePoint(55.7576, 37.6173, '2024-01-15T11:00:00Z'),
            ];

            // Video 4m59s before GPX start → offset = −299 → inside range
            const videoTime = new Date('2024-01-15T10:00:01Z');
            const result = autoSync(points, videoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBeCloseTo(-299, 0);
            expect(result.warning).toBeUndefined();
        });

        it('should sync DJI video mid-track on a long GPX without warning', () => {
            // Simulating the user's scenario: DJI video with creation_time 14:25:00Z
            // GPX track from 09:02:07Z to 15:00:00Z (≈6 hour track)
            // offset = 14:25:00 - 09:02:07 = 19373s → INSIDE the track range
            const points = [
                makePoint(54.758943, 35.604187, '2026-02-15T09:02:07Z'),
                makePoint(54.760000, 35.620000, '2026-02-15T12:00:00Z'),
                makePoint(54.761890, 35.630005, '2026-02-15T14:25:00Z'),
                makePoint(54.762000, 35.631000, '2026-02-15T15:00:00Z'),
            ];

            const djiVideoTime = new Date('2026-02-15T14:25:00Z');
            const result = autoSync(points, djiVideoTime);

            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(19373);
            expect(result.warning).toBeUndefined();
        });

        // Note: Tests using real GPX files require DOMParser which is only available in browsers
        // These integration tests are run in E2E test environment

        it.skip('should not snap to distant GPS loop segment on real iPhone track', () => {
            // Requires DOMParser - run in E2E tests
            // Tests GPS refinement logic with real iPhone GPX data
        });

        it.skip('should sync DJI creation_time to real iPhone GPX mid-track without warning', () => {
            // Requires DOMParser - run in E2E tests
            // Tests time-based sync with real iPhone GPX data
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

        it('should return correct start and end timestamps', () => {
            const start = new Date('2024-01-15T10:00:00Z').getTime();
            const end = new Date('2024-01-15T10:30:00Z').getTime();

            const points = [
                makePoint(55.0, 37.0, '2024-01-15T10:00:00Z'),
                makePoint(55.1, 37.1, '2024-01-15T10:30:00Z'),
            ];

            const range = getGpxTimeRange(points);
            expect(range!.startMs).toBe(start);
            expect(range!.endMs).toBe(end);
        });
    });

    describe('edge cases', () => {
        it('should handle GPS-only sync with single point track', () => {
            const points = [makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z')];

            const result = autoSync(points, undefined, 55.7558, 37.6173);
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(0);
        });

        it('should handle large track duration correctly', () => {
            // 24-hour track
            const points = [
                makePoint(55.0, 37.0, '2024-01-15T00:00:00Z'),
                makePoint(55.1, 37.1, '2024-01-16T00:00:00Z'),
            ];

            const range = getGpxTimeRange(points);
            expect(range!.durationMs).toBe(24 * 60 * 60 * 1000);
        });

        it('should handle millisecond precision in offset', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00.000Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:00:00.500Z'),
            ];

            const videoTime = new Date('2024-01-15T10:00:00.250Z');
            const result = autoSync(points, videoTime);

            expect(result.offsetSeconds).toBeCloseTo(0.25, 2);
        });

        it('should prefer GPS when time is not provided', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:00:30Z'),
                makePoint(55.7576, 37.6173, '2024-01-15T10:01:00Z'),
            ];

            // Closest to second point
            const result = autoSync(points, undefined, 55.7567, 37.6173);
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(30);
        });

        it('should handle exact offset at boundary of range', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:05:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:35:00Z'),
            ];

            // Video starts exactly at -300 seconds (5 minutes before)
            const videoTime = new Date('2024-01-15T10:00:00Z');
            const result = autoSync(points, videoTime);

            expect(result.offsetSeconds).toBe(-300);
            expect(result.warning).toBeUndefined();
        });

        it('should handle cross-meridian GPS coordinates', () => {
            const points = [
                makePoint(0, 179.999, '2024-01-15T10:00:00Z'),
                makePoint(0, -179.999, '2024-01-15T10:01:00Z'),
            ];

            const result = autoSync(points, new Date('2024-01-15T10:00:30Z'));
            expect(result.autoSynced).toBe(true);
        });

        it('should handle equatorial coordinates', () => {
            const points = [
                makePoint(0, 0, '2024-01-15T10:00:00Z'),
                makePoint(0.001, 0.001, '2024-01-15T10:01:00Z'),
            ];

            const result = autoSync(points, new Date('2024-01-15T10:00:00Z'), 0, 0);
            expect(result.autoSynced).toBe(true);
            expect(result.offsetSeconds).toBe(0);
        });

        it('should handle near-polar coordinates', () => {
            const points = [
                makePoint(89.9, 0, '2024-01-15T10:00:00Z'),
                makePoint(89.9, 180, '2024-01-15T10:01:00Z'),
            ];

            const result = autoSync(points, new Date('2024-01-15T10:00:30Z'));
            expect(result.autoSynced).toBe(true);
        });

        it('should handle very short tracks (< 5 minutes)', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:02:00Z'),
            ];

            const videoTime = new Date('2024-01-15T10:00:00Z');
            const result = autoSync(points, videoTime);

            expect(result.offsetSeconds).toBe(0);
            expect(result.warning).toBeUndefined();
        });

        it('should handle fractional seconds in time calculations', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:01:00Z'),
            ];

            // Video time with fractional seconds
            const videoTime = new Date('2024-01-15T10:00:30.123Z');
            const result = autoSync(points, videoTime);

            expect(result.offsetSeconds).toBeCloseTo(30.123, 0);
        });

        it('should format large time differences correctly', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:01:00Z'),
            ];

            // 2 hours difference
            const videoTime = new Date('2024-01-15T08:00:00Z');
            const result = autoSync(points, videoTime);

            expect(result.warning).toContain('2 h');
        });
    });

    describe('GPS refinement tolerance', () => {
        it('should accept GPS when it agrees with time (within 30s tolerance)', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:00:30Z'),
            ];

            // Time says +30s, GPS says 0s (at first point) - divergence = 30, within tolerance
            const result = autoSync(points, new Date('2024-01-15T10:00:30Z'), 55.7558, 37.6173);

            // Should use GPS offset (0) since it's within tolerance of time offset (30)
            expect(result.autoSynced).toBe(true);
        });

        it('should reject GPS when divergence exceeds tolerance', () => {
            const points = [
                makePoint(55.7558, 37.6173, '2024-01-15T10:00:00Z'),
                makePoint(55.7567, 37.6173, '2024-01-15T10:01:00Z'),
                makePoint(55.7576, 37.6173, '2024-01-15T10:02:00Z'),
            ];

            // Time says +30s, GPS says 120s (at third point) - divergence = 90 > 30
            const result = autoSync(points, new Date('2024-01-15T10:00:30Z'), 55.7576, 37.6173);

            expect(result.offsetSeconds).toBe(30); // Use time-based offset
            expect(result.warning).toContain('GPS location differs');
        });
    });
});
