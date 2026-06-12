import { describe, expect, it } from 'vitest';
import type { TelemetryFrame } from '../core/types';
import { getInterpolatedHeartRateHistory } from '../modules/telemetryCore';

describe('getInterpolatedHeartRateHistory', () => {
    it('builds dense sub-second samples for the Trail Run graph', () => {
        const frames: TelemetryFrame[] = [
            {
                timeOffset: 0,
                hr: 100,
                distanceKm: 0,
                elapsedTime: '0:00',
                movingTimeSeconds: 0,
            },
            {
                timeOffset: 1,
                hr: 101,
                distanceKm: 0.01,
                elapsedTime: '0:01',
                movingTimeSeconds: 1,
            },
        ];

        const history = getInterpolatedHeartRateHistory(frames, 1, 0, 1, 5);

        expect(history).toHaveLength(5);
        expect(history[0]).toBeCloseTo(100, 6);
        expect(history[1]).toBeCloseTo(100.25, 6);
        expect(history[2]).toBeCloseTo(100.5, 6);
        expect(history[3]).toBeCloseTo(100.75, 6);
        expect(history[4]).toBeCloseTo(101, 6);
    });

    it('changes smoothly between sub-second render times', () => {
        const frames: TelemetryFrame[] = [
            {
                timeOffset: 0,
                hr: 100,
                distanceKm: 0,
                elapsedTime: '0:00',
                movingTimeSeconds: 0,
            },
            {
                timeOffset: 2,
                hr: 120,
                distanceKm: 0.02,
                elapsedTime: '0:02',
                movingTimeSeconds: 2,
            },
        ];

        const early = getInterpolatedHeartRateHistory(frames, 1.25, 0, 1, 5);
        const later = getInterpolatedHeartRateHistory(frames, 1.5, 0, 1, 5);

        expect(early.at(-1)).toBeCloseTo(112.5, 6);
        expect(later.at(-1)).toBeCloseTo(115, 6);
        expect(later.at(-1)! - early.at(-1)!).toBeCloseTo(2.5, 6);
    });
});
