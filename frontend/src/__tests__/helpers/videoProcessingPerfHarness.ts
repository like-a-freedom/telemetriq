/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import type { VideoProcessingProfile } from '../../core/types';

export interface VideoProcessingFixture {
    label: 'baseline-mp4' | 'dji-hevc' | 'iphone-mov' | string;
    filePath: string;
    fileName: string;
    exists: boolean;
    fileSizeBytes: number;
}

export interface PhaseMeasurement<T = unknown> {
    phase: string;
    durationMs: number;
    result: T;
}

export interface BenchmarkSummary {
    name: string;
    measurements: Array<PhaseMeasurement<unknown>>;
    profiles: Array<{ fixture: string; profile: VideoProcessingProfile }>;
    output: string;
}

const TEST_DATA_ROOT = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../../../test_data',
);

function createFixture(label: VideoProcessingFixture['label'], relativePath: string): VideoProcessingFixture {
    const filePath = path.join(TEST_DATA_ROOT, relativePath);
    const exists = fs.existsSync(filePath);
    const stats = exists ? fs.statSync(filePath) : undefined;

    return {
        label,
        filePath,
        fileName: path.basename(filePath),
        exists,
        fileSizeBytes: stats?.size ?? 0,
    };
}

export function discoverVideoProcessingFixtures(): VideoProcessingFixture[] {
    return [
        createFixture('baseline-mp4', 'test.mp4'),
        createFixture('dji-hevc', 'dji/dji-osmo-pocket-3.MP4'),
        createFixture('iphone-mov', 'iphone/example_01/iphone-16-pro-max.MOV'),
    ].filter((fixture) => fixture.exists);
}

export async function runMeasuredPhase<T>(phase: string, action: () => Promise<T> | T): Promise<PhaseMeasurement<T>> {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const result = await action();
    const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
        phase,
        durationMs: Math.max(0, endedAt - startedAt),
        result,
    };
}

export function createVideoProcessingBenchmarkReporter(name: string): {
    addMeasurement: (measurement: PhaseMeasurement<unknown>) => void;
    addProfile: (fixture: string, profile: VideoProcessingProfile) => void;
    buildSummary: () => BenchmarkSummary;
} {
    const measurements: Array<PhaseMeasurement<unknown>> = [];
    const profiles: Array<{ fixture: string; profile: VideoProcessingProfile }> = [];

    return {
        addMeasurement(measurement) {
            measurements.push(measurement);
        },
        addProfile(fixture, profile) {
            profiles.push({ fixture, profile });
        },
        buildSummary() {
            const lines = measurements.map((measurement) => {
                return `${measurement.phase}: ${measurement.durationMs.toFixed(3)}ms`;
            });
            const profileLines = profiles.map(({ fixture, profile }) => {
                const phaseSummary = Object.entries(profile.phases)
                    .flatMap(([phase, metrics]) => {
                        if (!metrics) return [];
                        return [`${phase}=${metrics.durationMs.toFixed(3)}ms`];
                    })
                    .join(', ');
                return `${fixture}: ${phaseSummary}`;
            });

            return {
                name,
                measurements: [...measurements],
                profiles: [...profiles],
                output: [name, ...lines, ...profileLines].join('\n'),
            };
        },
    };
}
