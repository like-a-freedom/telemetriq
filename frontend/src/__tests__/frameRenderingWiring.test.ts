/**
 * Export-path wiring: `renderAndEncodeFrame` must hand the same ghost route to
 * the overlay renderer as the preview does (preview/export parity), must skip
 * the overlay when telemetry cannot be resolved, and must follow the keyframe policy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TelemetryFrame, VideoMeta } from '../core/types';
import type { RenderFrameParams } from '../modules/videoProcessing/frameRendering';

const { renderOverlaySpy } = vi.hoisted(() => ({ renderOverlaySpy: vi.fn(async () => undefined) }));

vi.mock('../modules/overlayRenderer', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../modules/overlayRenderer')>();
    return { ...actual, renderOverlay: renderOverlaySpy };
});

vi.mock('../modules/videoProcessing/frameOrientation', () => ({
    drawVideoFrameWithRotation: vi.fn(),
}));

import { renderAndEncodeFrame } from '../modules/videoProcessing/frameRendering';
import { getTemplateConfig } from '../modules/templates';

class FakeVideoFrame {
    constructor(public source: unknown, public init: { timestamp?: number; duration?: number }) {}
    close(): void {
        /* released after encoding */
    }
}

const videoMeta: VideoMeta = {
    duration: 20,
    width: 640,
    height: 360,
    fps: 30,
    codec: 'avc1.640028',
    fileSize: 1,
    fileName: 'clip.mp4',
};

function telemetryFrames(): TelemetryFrame[] {
    return Array.from({ length: 11 }, (_, second) => ({
        timeOffset: second,
        distanceKm: second / 10,
        hr: 140 + second,
        elapsedTime: `00:00:${String(second).padStart(2, '0')}`,
        movingTimeSeconds: second,
        latitude: 45 + second / 10_000,
        longitude: 10 + second / 10_000,
        timestampMs: Date.UTC(2026, 9, 2, 8, 12) + second * 1000,
    }));
}

function makeParams(overrides: Partial<RenderFrameParams> = {}): RenderFrameParams {
    return {
        frame: { timestamp: 5_000_000, duration: 1_000_000, close: vi.fn() } as unknown as RenderFrameParams['frame'],
        canvas: {} as RenderFrameParams['canvas'],
        ctx: {} as RenderFrameParams['ctx'],
        videoMeta,
        telemetryFrames: telemetryFrames(),
        safeSyncOffsetSeconds: 0,
        config: getTemplateConfig('ghost-run'),
        encoder: { encode: vi.fn() } as unknown as RenderFrameParams['encoder'],
        gopFrames: 10,
        encodedFrameCount: 0,
        ...overrides,
    };
}

describe('renderAndEncodeFrame wiring', () => {
    beforeEach(() => {
        renderOverlaySpy.mockClear();
        vi.stubGlobal('VideoFrame', FakeVideoFrame);
    });

    it('passes the ghost route to the overlay renderer for the ghost-run template', async () => {
        const params = makeParams();

        await renderAndEncodeFrame(params);

        expect(renderOverlaySpy).toHaveBeenCalledTimes(1);
        const [, , width, height, config, renderContext] = renderOverlaySpy.mock.calls[0]!;
        expect(width).toBe(videoMeta.width);
        expect(height).toBe(videoMeta.height);
        expect(config).toBe(params.config);
        expect(renderContext).toEqual(expect.objectContaining({ destinationHasBaseFrame: true }));
        const ghostRoute = (renderContext as { ghostRoute?: { startTimestampMs?: number; points: unknown[] } }).ghostRoute;
        expect(ghostRoute).toBeDefined();
        expect(ghostRoute!.points.length).toBeGreaterThan(1);
        expect(ghostRoute!.startTimestampMs).toBe(Date.UTC(2026, 9, 2, 8, 12));
    });

    it('does not build a route for templates other than ghost-run', async () => {
        const params = makeParams({ config: getTemplateConfig('editorial') });

        await renderAndEncodeFrame(params);

        expect(renderOverlaySpy).toHaveBeenCalledTimes(1);
        const renderContext = renderOverlaySpy.mock.calls[0]![5] as { ghostRoute?: unknown };
        expect(renderContext.ghostRoute).toBeUndefined();
    });

    it('skips the overlay when the video time falls outside the track', async () => {
        const params = makeParams({
            frame: { timestamp: 60_000_000, duration: 1_000_000, close: vi.fn() } as unknown as RenderFrameParams['frame'],
        });

        await renderAndEncodeFrame(params);

        expect(renderOverlaySpy).not.toHaveBeenCalled();
        expect(params.frame.close).toHaveBeenCalled();
        expect(params.encoder.encode).toHaveBeenCalledTimes(1);
    });

    it('forces a keyframe on the first frame and on every GOP boundary', async () => {
        const first = makeParams({ encodedFrameCount: 0, gopFrames: 10 });
        await renderAndEncodeFrame(first);
        expect(first.encoder.encode).toHaveBeenNthCalledWith(1, expect.any(FakeVideoFrame), { keyFrame: true });

        const middle = makeParams({ encodedFrameCount: 5, gopFrames: 10 });
        await renderAndEncodeFrame(middle);
        expect(middle.encoder.encode).toHaveBeenNthCalledWith(1, expect.any(FakeVideoFrame));

        const boundary = makeParams({ encodedFrameCount: 10, gopFrames: 10 });
        await renderAndEncodeFrame(boundary);
        expect(boundary.encoder.encode).toHaveBeenNthCalledWith(1, expect.any(FakeVideoFrame), { keyFrame: true });

        const noGop = makeParams({ encodedFrameCount: 7, gopFrames: 0 });
        await renderAndEncodeFrame(noGop);
        expect(noGop.encoder.encode).toHaveBeenNthCalledWith(1, expect.any(FakeVideoFrame));
    });
});
