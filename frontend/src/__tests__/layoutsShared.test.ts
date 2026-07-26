/**
 * Unit tests for the canonical overlay layout helper API.
 *
 * The `toStandardMetricItems` / `MetricItemSpec` helper in `layouts/shared.ts`
 * is the single source for how layouts build their display items: 21 layout
 * modules depend on it directly. These tests pin down the helper's contract so
 * future refactors can't silently change ordering, drop rules, or emphasis
 * semantics in a way that breaks the rendered overlay.
 */
import { describe, it, expect } from 'vitest';
import type { MetricItem } from '../core/types';
import {
    toStandardMetricItems,
    toMetricMap,
    parsePace,
    getOrientation,
    condensedStripStableValue,
    type MetricItemSpec,
} from '../modules/layouts/shared';

const FULL_MAP = {
    pace: '5:30',
    heartRate: '142',
    distance: '3.4',
    time: '00:18:42',
};

describe('toStandardMetricItems', () => {
    const labelUnitMapping = {
        pace: { label: 'Pace', unit: 'min/km' },
        heartRate: { label: 'Heart Rate', unit: 'bpm' },
        distance: { label: 'Distance', unit: 'km' },
        time: { label: 'Time', unit: '' },
    };

    it('uses the canonical default order pace → heartRate → distance → time', () => {
        const items = toStandardMetricItems(FULL_MAP, labelUnitMapping);
        expect(items.map((i) => i.key)).toEqual([
            'pace',
            'heartRate',
            'distance',
            'time',
        ]);
    });

    it('copies label, value, and unit from mapping + data', () => {
        const items = toStandardMetricItems(FULL_MAP, labelUnitMapping);
        expect(items[0]).toEqual({
            key: 'pace',
            label: 'Pace',
            value: '5:30',
            unit: 'min/km',
            emphasis: undefined,
        });
        expect(items[1]).toMatchObject({
            key: 'heartRate',
            label: 'Heart Rate',
            value: '142',
            unit: 'bpm',
        });
        expect(items[3]).toMatchObject({
            key: 'time',
            label: 'Time',
            value: '00:18:42',
        });
    });

    it('drops a metric when its value is missing from data', () => {
        const items = toStandardMetricItems(
            { pace: '5:30', heartRate: '142' },
            labelUnitMapping,
        );
        expect(items.map((i) => i.key)).toEqual(['pace', 'heartRate']);
        expect(items.find((i) => i.key === 'distance')).toBeUndefined();
        expect(items.find((i) => i.key === 'time')).toBeUndefined();
    });

    it('drops a metric when no mapping entry is provided for it', () => {
        const items = toStandardMetricItems(FULL_MAP, {
            pace: { label: 'Pace', unit: 'min/km' },
        });
        expect(items.map((i) => i.key)).toEqual(['pace']);
    });

    it('preserves caller-supplied order, including unconventional sequences', () => {
        const items = toStandardMetricItems(FULL_MAP, labelUnitMapping, [
            'time',
            'distance',
            'heartRate',
            'pace',
        ]);
        expect(items.map((i) => i.key)).toEqual([
            'time',
            'distance',
            'heartRate',
            'pace',
        ]);
    });

    it('filters the supplied order against the data values', () => {
        const items = toStandardMetricItems(
            { pace: '5:30', time: '00:18:42' },
            labelUnitMapping,
            ['pace', 'heartRate', 'distance', 'time'],
        );
        expect(items.map((i) => i.key)).toEqual(['pace', 'time']);
    });

    it('round-trips emphasis from the mapping into the produced spec', () => {
        const items = toStandardMetricItems(FULL_MAP, {
            pace: { label: 'Pace', unit: 'min/km', emphasis: 'big' },
            heartRate: { label: 'Heart Rate', unit: 'bpm', emphasis: 'minor' },
            distance: { label: 'Distance', unit: 'km' },
            time: { label: 'Time', unit: '' },
        });
        const byKey = new Map(items.map((i) => [i.key, i]));
        expect(byKey.get('pace')?.emphasis).toBe('big');
        expect(byKey.get('heartRate')?.emphasis).toBe('minor');
        expect(byKey.get('distance')?.emphasis).toBeUndefined();
        expect(byKey.get('time')?.emphasis).toBeUndefined();
    });

    it('produces an empty array when no values are present', () => {
        const items = toStandardMetricItems({}, labelUnitMapping);
        expect(items).toEqual([]);
    });

    it('returns MetricItemSpec objects with the documented shape', () => {
        const [item] = toStandardMetricItems(
            { pace: '5:30' },
            { pace: { label: 'Pace', unit: 'min/km' } },
        );
        expect(item).toBeDefined();
        const k: MetricItemSpec['key'] = item.key;
        expect(['pace', 'heartRate', 'distance', 'time']).toContain(k);
        expect(typeof item.label).toBe('string');
        expect(typeof item.value).toBe('string');
    });
});

describe('toMetricMap', () => {
    it('extracts values by their canonical labels', () => {
        const metrics: MetricItem[] = [
            { label: 'Pace', value: '5:30', unit: 'min/km' },
            { label: 'Heart Rate', value: '142', unit: 'bpm' },
            { label: 'Distance', value: '3.4', unit: 'km' },
            { label: 'Time', value: '00:18:42', unit: '' },
        ];
        const map = toMetricMap(metrics);
        expect(map).toEqual({
            pace: '5:30',
            heartRate: '142',
            distance: '3.4',
            time: '00:18:42',
        });
    });

    it('returns undefined for metrics that are not present', () => {
        const map = toMetricMap([{ label: 'Pace', value: '5:30', unit: 'min/km' }]);
        expect(map.pace).toBe('5:30');
        expect(map.heartRate).toBeUndefined();
        expect(map.distance).toBeUndefined();
        expect(map.time).toBeUndefined();
    });

    it('matches labels case-insensitively so layouts can resolve upper/lower-cased labels', () => {
        const map = toMetricMap([
            { label: 'pace', value: '5:30', unit: 'min/km' },
            { label: 'HEART RATE', value: '142', unit: 'bpm' },
        ]);
        expect(map.pace).toBe('5:30');
        expect(map.heartRate).toBe('142');
    });
});

describe('parsePace', () => {
    it('parses a pace string into total minutes', () => {
        expect(parsePace('5:30')).toBeCloseTo(5.5, 5);
        expect(parsePace('6:00')).toBe(6);
        expect(parsePace('4:45')).toBeCloseTo(4.75, 5);
    });

    it('falls back to a default of 6 minutes per km on malformed input', () => {
        expect(parsePace(undefined)).toBe(6);
        expect(parsePace('')).toBe(6);
        expect(parsePace('not-a-pace')).toBe(6);
    });
});

describe('getOrientation', () => {
    it('detects portrait orientation with appropriate safe paddings', () => {
        const o = getOrientation(1080, 1920);
        expect(o.isPortrait).toBe(true);
        expect(o.shortSide).toBe(1080);
        expect(o.longSide).toBe(1920);
        expect(o.safePad).toBeGreaterThan(o.compactPad);
    });

    it('detects landscape and uses landscape-sized safe pad', () => {
        const o = getOrientation(1920, 1080);
        expect(o.isPortrait).toBe(false);
        expect(o.shortSide).toBe(1080);
        expect(o.longSide).toBe(1920);
    });
});

describe('condensedStripStableValue', () => {
    it('formats known labels into stable human-readable strings', () => {
        expect(condensedStripStableValue('Pace')).toMatch(/min\/km$/);
        expect(condensedStripStableValue('HR')).toMatch(/bpm$/);
        expect(condensedStripStableValue('DIST')).toMatch(/km$/);
        expect(condensedStripStableValue('TIME')).toBeTruthy();
    });

    it('passes arbitrary labels through to the stable-formatting fallback', () => {
        const stripped = condensedStripStableValue('CUSTOM').replace(/[^a-zA-Z ]+/g, '').trim();
        expect(stripped).toContain('CUSTOM');
    });
});
