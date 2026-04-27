/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import {
    createVideoProcessingBenchmarkReporter,
    discoverVideoProcessingFixtures,
    runMeasuredPhase,
} from './helpers/videoProcessingPerfHarness';
import {
    createVideoProcessingProfiler,
    type VideoProcessingProfile,
} from '../modules/videoProcessingProfiler';
import { createDemuxer } from '../modules/demuxer';
import { renderOverlay, DEFAULT_OVERLAY_CONFIG } from '../modules/overlayRenderer';
import type { TelemetryFrame } from '../core/types';

type StubContext = {
    canvas: unknown;
    font: string;
    fillStyle: string | CanvasGradient;
    strokeStyle: string;
    textBaseline: CanvasTextBaseline;
    textAlign: string;
    lineWidth: number;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    measureText: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    roundRect: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    arc: ReturnType<typeof vi.fn>;
    createLinearGradient: ReturnType<typeof vi.fn>;
    translate: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    clearRect: ReturnType<typeof vi.fn>;
};

const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

const fakeGradient = {
    addColorStop: vi.fn(),
};

function createStubContext(canvasRef: unknown): StubContext {
    return {
        canvas: canvasRef,
        font: '',
        fillStyle: '',
        strokeStyle: '',
        textBaseline: 'top',
        textAlign: 'left',
        lineWidth: 1,
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        createLinearGradient: vi.fn(() => fakeGradient),
        translate: vi.fn(),
        rotate: vi.fn(),
        clearRect: vi.fn(),
    };
}

class FakeOffscreenCanvas {
    width = 0;
    height = 0;
    private readonly ctx: StubContext;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.ctx = createStubContext(this);
    }

    getContext(type: '2d'): StubContext | null {
        if (type !== '2d') return null;
        return this.ctx;
    }
}

function createBenchmarkFrame(index: number): TelemetryFrame {
    return {
        timeOffset: index,
        hr: 145 + (index % 5),
        paceSecondsPerKm: 300 + (index % 7),
        distanceKm: 2 + index * 0.1,
        elapsedTime: `00:00:${String(index % 60).padStart(2, '0')}`,
        movingTimeSeconds: index,
    };
}

describe('video processing performance harness', () => {
    beforeEach(() => {
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => { });
        (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = FakeOffscreenCanvas;
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas;
    });

    it('discovers representative video fixtures from test_data', () => {
        const fixtures = discoverVideoProcessingFixtures();
        if (fixtures.length === 0) {
            console.warn('[perf] no video fixtures found, skipping discovery assertions');
            return;
        }

        // when fixtures are present we expect the usual set
        expect(fixtures.length).toBeGreaterThanOrEqual(3);
        expect(fixtures.some((fixture) => fixture.label === 'baseline-mp4')).toBe(true);
        expect(fixtures.some((fixture) => fixture.label === 'dji-hevc')).toBe(true);
        expect(fixtures.some((fixture) => fixture.label === 'iphone-mov')).toBe(true);
    });

    it('measures phases and emits a structured benchmark summary', async () => {
        const reporter = createVideoProcessingBenchmarkReporter('unit-benchmark');

        const result = await runMeasuredPhase('synthetic-phase', async () => {
            await Promise.resolve();
            return 42;
        });

        reporter.addMeasurement(result);
        const summary = reporter.buildSummary();

        expect(result.result).toBe(42);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(summary.name).toBe('unit-benchmark');
        expect(summary.measurements).toHaveLength(1);
        expect(summary.measurements[0]).toMatchObject({ phase: 'synthetic-phase' });
        expect(summary.output).toContain('synthetic-phase');
    });

    it('collects phase timings and produces a stable processing profile summary', async () => {
        const profiler = createVideoProcessingProfiler();

        await profiler.measure('demuxing', async () => {
            await Promise.resolve();
        });
        profiler.incrementFallbackTranscodes();

        const profile = profiler.finish({
            processedFrames: 12,
            usedStreamingMux: true,
        });

        const demuxingPhase = profile.phases.demuxing;

        expect(demuxingPhase).toBeDefined();
        expect(demuxingPhase?.durationMs).toBeGreaterThanOrEqual(0);
        expect(profile.fallbackTranscodeCount).toBe(1);
        expect(profile.processedFrames).toBe(12);
        expect(profile.usedStreamingMux).toBe(true);
        expect(profile.totalDurationMs).toBeGreaterThanOrEqual(demuxingPhase?.durationMs ?? 0);
    });

    it('formats finished profiles into benchmark summaries', () => {
        const reporter = createVideoProcessingBenchmarkReporter('profile-summary');
        const profile: VideoProcessingProfile = {
            phases: {
                demuxing: { durationMs: 5, runs: 1 },
                processing: { durationMs: 10, runs: 1 },
            },
            fallbackTranscodeCount: 0,
            processedFrames: 20,
            usedStreamingMux: false,
            totalDurationMs: 15,
        };

        reporter.addProfile('fixture-a', profile);
        const summary = reporter.buildSummary();

        expect(summary.output).toContain('fixture-a');
        expect(summary.output).toContain('demuxing=5.000ms');
        expect(summary.output).toContain('processing=10.000ms');
    });

    it('benchmarks demuxing representative fixtures from test_data', async () => {
        const fixtures = discoverVideoProcessingFixtures();
        const demuxer = createDemuxer();
        const reporter = createVideoProcessingBenchmarkReporter('demux-fixtures');

        if (fixtures.length === 0) {
            console.warn('[perf] skipping demux benchmark; no fixtures available');
            return;
        }

        for (const fixture of fixtures) {
            const raw = fs.readFileSync(fixture.filePath);
            const fileBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
            const file = new File([fileBuffer], fixture.fileName, {
                type: fixture.fileName.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
            });

            const measurement = await runMeasuredPhase(`demux:${fixture.label}`, async () => {
                const demuxed = await demuxer.demux(file);
                return {
                    videoSamples: demuxed.videoSamples.length,
                    audioSamples: demuxed.audioSamples.length,
                };
            });

            reporter.addMeasurement(measurement);
            expect(measurement.result.videoSamples).toBeGreaterThan(0);
        }

        const summary = reporter.buildSummary();
        console.info(`\n${summary.output}\n`);

        expect(summary.measurements.length).toBe(fixtures.length);
    }, 120_000);

    it('shows a measurable win for repeated 1080p overlay renders with cache reuse', async () => {
        const reporter = createVideoProcessingBenchmarkReporter('overlay-cache-benchmark');

        const coldMeasurement = await runMeasuredPhase('overlay-cold-1080p-x120', async () => {
            const coldContext = createStubContext({ id: 'cold-destination' }) as unknown as CanvasRenderingContext2D;
            for (let i = 0; i < 120; i++) {
                await renderOverlay(coldContext, createBenchmarkFrame(i), 1920, 1080, DEFAULT_OVERLAY_CONFIG);
            }
            return 120;
        });

        const warmFrame = createBenchmarkFrame(999);
        const warmMeasurement = await runMeasuredPhase('overlay-warm-1080p-x120', async () => {
            for (let i = 0; i < 120; i++) {
                const warmContext = createStubContext({ id: `warm-destination-${i}` }) as unknown as CanvasRenderingContext2D;
                await renderOverlay(warmContext, warmFrame, 1920, 1080, DEFAULT_OVERLAY_CONFIG);
            }
            return 120;
        });

        reporter.addMeasurement(coldMeasurement);
        reporter.addMeasurement(warmMeasurement);
        const summary = reporter.buildSummary();
        console.info(`\n${summary.output}\n`);

        expect(warmMeasurement.durationMs).toBeLessThan(coldMeasurement.durationMs);
    });
});
