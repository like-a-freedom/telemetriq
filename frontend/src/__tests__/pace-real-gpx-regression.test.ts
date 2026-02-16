/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseGpx } from '../modules/gpx-parser';
import { buildTelemetryTimeline, getTelemetryAtTime } from '../modules/telemetry-core';

const DJI_GPX_PATH = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../../test_data/dji/dji-track.gpx',
);

const IPHONE_GPX_PATH = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../../test_data/iphone/iphone-track.gpx',
);

describe('pace real GPX regression', () => {
    it('dji track should not produce running pace in walking range (20+ min/km) within active segment', () => {
        const xml = fs.readFileSync(DJI_GPX_PATH, 'utf-8');
        const gpx = parseGpx(xml);
        const frames = buildTelemetryTimeline(gpx.points);

        // Analyze first 120s assuming clip starts near track start for this regression check.
        const values: number[] = [];
        for (let sec = 5; sec <= 120; sec++) {
            const frame = getTelemetryAtTime(frames, sec + 0.2, 0, 120);
            if (frame?.paceSecondsPerKm !== undefined) {
                values.push(frame.paceSecondsPerKm);
            }
        }

        expect(values.length).toBeGreaterThan(30);

        // Running should not settle in ultra-slow zone like 20:00+/km.
        const p95 = quantile(values, 0.95);
        expect(p95).toBeLessThan(1100);
    });

    it('iphone track pace fallback should stay stable within one second', () => {
        const xml = fs.readFileSync(IPHONE_GPX_PATH, 'utf-8');
        const gpx = parseGpx(xml);
        const frames = buildTelemetryTimeline(gpx.points);

        const a = getTelemetryAtTime(frames, 12.10, 0, 18);
        const b = getTelemetryAtTime(frames, 12.90, 0, 18);

        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        expect(a!.paceSecondsPerKm).toBeDefined();
        expect(b!.paceSecondsPerKm).toBeDefined();

        // Should update at ~1Hz, not continuously inside the same second.
        expect(a!.paceSecondsPerKm).toBeCloseTo(b!.paceSecondsPerKm!, 10);
    });
});

function quantile(values: number[], q: number): number {
    const sorted = [...values].sort((x, y) => x - y);
    if (sorted.length === 0) return Number.NaN;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q)));
    return sorted[idx]!;
}
