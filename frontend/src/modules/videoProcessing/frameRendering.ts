import type { TelemetryFrame, ExtendedOverlayConfig, VideoMeta } from '../../core/types';
import {
    getInterpolatedHeartRateHistory,
    getInterpolatedElevationHistory,
    getTelemetryAtTime,
    TRAIL_RUN_GRAPH_LOOKBACK_SECONDS,
    TRAIL_RUN_GRAPH_SAMPLE_COUNT,
} from '../telemetryCore';
import { renderOverlay } from '../overlayRenderer';
import { drawVideoFrameWithRotation } from '../frameOrientation';

export interface RenderFrameParams {
    frame: VideoFrame;
    canvas: OffscreenCanvas;
    ctx: OffscreenCanvasRenderingContext2D;
    videoMeta: VideoMeta;
    videoRotation?: 0 | 90 | 180 | 270;
    telemetryFrames: TelemetryFrame[];
    safeSyncOffsetSeconds: number;
    config: ExtendedOverlayConfig;
    encoder: VideoEncoder;
    gopFrames: number;
    encodedFrameCount: number;
}

export function renderAndEncodeFrame(params: RenderFrameParams): void {
    const {
        frame, canvas, ctx, videoMeta, videoRotation, telemetryFrames,
        safeSyncOffsetSeconds, config, encoder, gopFrames, encodedFrameCount,
    } = params;

    const videoTimeSec = (frame.timestamp ?? 0) / 1_000_000;
    const telemetry = getTelemetryAtTime(
        telemetryFrames,
        videoTimeSec,
        safeSyncOffsetSeconds,
        videoMeta.duration,
    );

    const hrHistory = getInterpolatedHeartRateHistory(
        telemetryFrames,
        videoTimeSec,
        safeSyncOffsetSeconds,
        TRAIL_RUN_GRAPH_LOOKBACK_SECONDS,
        TRAIL_RUN_GRAPH_SAMPLE_COUNT,
    );

    const elevationHistory = getInterpolatedElevationHistory(
        telemetryFrames,
        videoTimeSec,
        safeSyncOffsetSeconds,
        TRAIL_RUN_GRAPH_LOOKBACK_SECONDS,
        TRAIL_RUN_GRAPH_SAMPLE_COUNT,
    );

    drawVideoFrameWithRotation(ctx, frame, videoMeta.width, videoMeta.height, videoRotation);
    if (telemetry) {
        renderOverlay(ctx, telemetry, videoMeta.width, videoMeta.height, config, {
            hrHistory,
            elevationHistory,
            destinationHasBaseFrame: true,
        });
    }

    const newFrame = new VideoFrame(canvas, {
        timestamp: frame.timestamp,
        duration: frame.duration ?? undefined,
    });
    frame.close();

    const forceKeyFrame = encodedFrameCount === 0 || (gopFrames > 0 && encodedFrameCount % gopFrames === 0);
    if (forceKeyFrame) {
        encoder.encode(newFrame, { keyFrame: true });
    } else {
        encoder.encode(newFrame);
    }
    newFrame.close();
}

export function createVideoChunk(sample: { cts: number; duration: number; timescale: number; is_rap: boolean; data: ArrayBuffer }): EncodedVideoChunk {
    const timestampUs = (sample.cts / sample.timescale) * 1_000_000;
    const durationUs = (sample.duration / sample.timescale) * 1_000_000;
    const sanitizedTimestampUs = Number.isFinite(timestampUs)
        ? Math.max(0, Math.round(timestampUs))
        : 0;
    const sanitizedDurationUs = Number.isFinite(durationUs)
        ? Math.max(1, Math.round(durationUs))
        : 1;

    return new EncodedVideoChunk({
        type: sample.is_rap ? 'key' : 'delta',
        timestamp: sanitizedTimestampUs,
        duration: sanitizedDurationUs,
        data: new Uint8Array(sample.data),
    });
}

export function closeCodec(codec: VideoDecoder | VideoEncoder, name: string): void {
    if (codec.state !== 'closed') {
        try {
            codec.close();
        } catch (error) {
            console.warn(`${name} close failed`, error);
        }
    }
}