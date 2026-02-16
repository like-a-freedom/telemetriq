import type { TelemetryFrame, ExtendedOverlayConfig, ProcessingProgress, VideoMeta } from '../core/types';
import { ProcessingError } from '../core/errors';
import { getTelemetryAtTime } from './telemetry-core';
import { renderOverlay, DEFAULT_OVERLAY_CONFIG } from './overlay-renderer';
import { transcodeWithForcedKeyframes, remuxWithFfmpeg } from './ffmpeg-utils';
import { createKeyframeDetector, detectSourceGopSize } from './keyframe-detector';
import { createDemuxer } from './demuxer';
import { createMuxer } from './muxer';
import { createVideoCodecManager } from './video-codec-manager';
import {
    createProcessingProgressReporter,
    createMuxProgressReporter,
} from './progress-utils';
import { isCodecQueuePressureHigh, waitForCodecQueues } from './video-processing-types';
import type { DemuxedMedia, StreamingMuxSession } from './video-processing-types';
import { drawVideoFrameWithRotation } from './frame-orientation';

export interface VideoProcessorOptions {
    videoFile: File;
    videoMeta: VideoMeta;
    telemetryFrames: TelemetryFrame[];
    syncOffsetSeconds: number;
    overlayConfig?: ExtendedOverlayConfig;
    onProgress?: (progress: ProcessingProgress) => void;
    useFfmpegMux?: boolean;
}

interface ProcessFramesParams {
    demuxed: DemuxedMedia;
    videoSamples: DemuxedMedia['videoSamples'];
    totalFrames: number;
    gopFrames: number;
    videoMeta: VideoMeta;
    telemetryFrames: TelemetryFrame[];
    safeSyncOffsetSeconds: number;
    config: ExtendedOverlayConfig;
    reportProcessingProgress: { report: (frames: number, force?: boolean) => void };
    reportMuxProgress: { report: (percent: number, frames: number) => void };
}

interface ProcessingState {
    useStreamingMux: boolean;
    encodedChunks: EncodedVideoChunk[];
    encodedFrameCount: number;
    encoderDecoderConfig: VideoDecoderConfig | undefined;
    error: ProcessingError | undefined;
    streamingMuxSession: StreamingMuxSession | undefined;
    recordError: (message: string) => void;
    frameProcessingQueue: Promise<void>;
    framesProcessed: number;
}

const STREAMING_MUX_FILE_SIZE_BYTES = 512 * 1024 * 1024; // 512 MB
const MAX_IN_FLIGHT_FRAME_TASKS = 3;

/**
 * Process a video file by decoding each frame, overlaying telemetry data,
 * and encoding back to an MP4 container.
 *
 * Uses Mediabunny for demux/mux and WebCodecs for decode/encode.
 */
export class VideoProcessor {
    private abortController: AbortController;
    private options: VideoProcessorOptions;
    private demuxer = createDemuxer();
    private muxer = createMuxer();
    private codecManager = createVideoCodecManager();

    constructor(options: VideoProcessorOptions) {
        this.options = options;
        this.abortController = new AbortController();
    }

    /**
     * Start processing the video.
     */
    async process(): Promise<Blob> {
        if (typeof VideoDecoder === 'undefined' || typeof VideoEncoder === 'undefined') {
            throw new ProcessingError('WebCodecs API is not available in the current browser');
        }

        const { videoFile, videoMeta, telemetryFrames, syncOffsetSeconds, overlayConfig, onProgress } = this.options;
        const config = overlayConfig ?? DEFAULT_OVERLAY_CONFIG;
        const safeSyncOffsetSeconds = Number.isFinite(syncOffsetSeconds) ? syncOffsetSeconds : 0;

        onProgress?.({ phase: 'demuxing', percent: 0, framesProcessed: 0, totalFrames: 0 });

        const sourceFile = videoFile;
        let demuxed = await this.demuxer.demuxWithFallback(sourceFile, onProgress);

        demuxed = await this.ensureDecodableTrack(demuxed, sourceFile, videoMeta, onProgress);
        demuxed = await this.ensureKeyframes(demuxed, sourceFile, videoMeta, onProgress);

        const videoSamples = this.sliceFromFirstKeyframe(demuxed.videoSamples);
        const totalFrames = videoSamples.length;
        const gopFrames = detectSourceGopSize(videoSamples, videoMeta.fps);

        const reportProcessingProgress = createProcessingProgressReporter(onProgress, totalFrames);
        const reportMuxProgress = createMuxProgressReporter(onProgress, totalFrames);

        onProgress?.({ phase: 'processing', percent: 0, framesProcessed: 0, totalFrames });

        return await this.processFrames({
            demuxed,
            videoSamples,
            totalFrames,
            gopFrames,
            videoMeta,
            telemetryFrames,
            safeSyncOffsetSeconds,
            config,
            reportProcessingProgress,
            reportMuxProgress,
        });
    }

    /**
     * Cancel the video processing.
     */
    cancel(): void {
        this.abortController.abort();
    }

    private async ensureDecodableTrack(
        demuxed: DemuxedMedia,
        sourceFile: File,
        videoMeta: VideoMeta,
        onProgress?: (progress: ProcessingProgress) => void,
    ): Promise<DemuxedMedia> {
        const canDecode = await this.codecManager.isVideoTrackDecodable(
            demuxed.videoTrack.codec,
            demuxed.videoTrack.description,
        );

        if (canDecode) return demuxed;

        onProgress?.({ phase: 'encoding', percent: 0, framesProcessed: 0, totalFrames: 0 });
        const transcodedFile = await transcodeWithForcedKeyframes(
            sourceFile,
            { fps: videoMeta.fps, duration: videoMeta.duration },
            {
                gopSize: Math.max(1, Math.round(videoMeta.fps)),
                onProgress: (percent) => {
                    onProgress?.({
                        phase: 'encoding',
                        percent,
                        framesProcessed: 0,
                        totalFrames: 0,
                    });
                },
            },
        );

        const result = await this.demuxer.demuxWithFallback(transcodedFile, onProgress);
        const canDecodeTranscoded = await this.codecManager.isVideoTrackDecodable(
            result.videoTrack.codec,
            result.videoTrack.description,
        );

        if (!canDecodeTranscoded) {
            throw new ProcessingError(
                `Browser does not support decoding codec ${result.videoTrack.codec} and automatic transcoding failed.`,
            );
        }

        return result;
    }

    private async ensureKeyframes(
        demuxed: DemuxedMedia,
        sourceFile: File,
        videoMeta: VideoMeta,
        onProgress?: (progress: ProcessingProgress) => void,
    ): Promise<DemuxedMedia> {
        const keyframeDetector = createKeyframeDetector(
            demuxed.videoTrack.codec,
            demuxed.videoTrack.description,
        );

        let firstKeyframeIndex = demuxed.videoSamples.findIndex((sample) => sample.is_rap);
        if (firstKeyframeIndex === -1) {
            firstKeyframeIndex = demuxed.videoSamples.findIndex((sample) => keyframeDetector(sample));
        }

        if (firstKeyframeIndex !== -1) return demuxed;

        onProgress?.({ phase: 'encoding', percent: 0, framesProcessed: 0, totalFrames: 0 });
        const transcodedFile = await transcodeWithForcedKeyframes(
            sourceFile,
            { fps: videoMeta.fps, duration: videoMeta.duration },
            {
                gopSize: Math.max(1, Math.round(videoMeta.fps)),
                onProgress: (percent) => {
                    onProgress?.({
                        phase: 'encoding',
                        percent,
                        framesProcessed: 0,
                        totalFrames: 0,
                    });
                },
            },
        );

        const result = await this.demuxer.demuxWithFallback(transcodedFile, onProgress);
        const newDetector = createKeyframeDetector(result.videoTrack.codec, result.videoTrack.description);
        const newFirstKeyframe = result.videoSamples.findIndex((sample) => newDetector(sample));

        if (newFirstKeyframe === -1) {
            throw new ProcessingError(
                'No IDR keyframes found in the video track. Automatic recovery failed and the file cannot be decoded.',
            );
        }

        return result;
    }

    private sliceFromFirstKeyframe(samples: DemuxedMedia['videoSamples']): DemuxedMedia['videoSamples'] {
        const keyframeDetector = createKeyframeDetector('unknown');
        let firstIndex = samples.findIndex((sample) => sample.is_rap);
        if (firstIndex === -1) {
            firstIndex = samples.findIndex((sample) => keyframeDetector(sample));
        }
        return firstIndex > 0 ? samples.slice(firstIndex) : samples;
    }

    private async processFrames(params: ProcessFramesParams): Promise<Blob> {
        const canvas = this.createProcessingCanvas(params.videoMeta);
        const processingState = this.initializeProcessingState(params);

        await this.tryInitializeWebGPU();

        const { encoder, encodeMeta } = await this.setupEncoder(params, processingState);
        const { decoder, inFlightTasks } = this.setupDecoder(params, processingState, encoder, encodeMeta, canvas);

        await this.decodeAllFrames(params, decoder, processingState, inFlightTasks, encoder);

        if (processingState.error) throw processingState.error;
        if (this.abortController.signal.aborted) {
            throw new ProcessingError('Processing was cancelled by the user');
        }

        return await this.muxAndFinalize(params, processingState, encodeMeta);
    }

    private createProcessingCanvas(videoMeta: VideoMeta): OffscreenCanvas {
        return new OffscreenCanvas(videoMeta.width, videoMeta.height);
    }

    private initializeProcessingState(_params: ProcessFramesParams): ProcessingState {
        const useStreamingMux = this.options.videoFile.size >= STREAMING_MUX_FILE_SIZE_BYTES;

        const state: ProcessingState = {
            useStreamingMux,
            encodedChunks: [],
            encodedFrameCount: 0,
            encoderDecoderConfig: undefined,
            error: undefined,
            streamingMuxSession: undefined,
            recordError: () => { },
            frameProcessingQueue: Promise.resolve(),
            framesProcessed: 0,
        };

        state.recordError = (message: string): void => {
            if (!state.error) {
                state.error = new ProcessingError(message);
                this.abortController.abort();
            }
        };

        return state;
    }

    private async tryInitializeWebGPU(): Promise<void> {
        if (typeof navigator === 'undefined' || !('gpu' in navigator)) return;

        try {
            const { WebGPUAdapter } = await import('./webgpu/webgpu-adapter');
            if (WebGPUAdapter.isSupported()) {
                WebGPUAdapter.getInstance().isEnabled();
            }
        } catch (error) {
            console.warn('[VideoProcessor] Failed to load WebGPU adapter:', error);
        }
    }

    private async setupEncoder(
        params: ProcessFramesParams,
        state: ProcessingState,
    ): Promise<{ encoder: VideoEncoder; encodeMeta: VideoMeta }> {
        const { encoder, encodeMeta } = await this.codecManager.createEncoder(
            params.videoMeta,
            params.demuxed.videoTrack.codec,
            (chunk, metadata) => {
                if (metadata?.decoderConfig) {
                    state.encoderDecoderConfig = metadata.decoderConfig;
                }
                if (state.useStreamingMux && state.streamingMuxSession) {
                    state.streamingMuxSession.enqueueVideoChunk(chunk, metadata?.decoderConfig ?? state.encoderDecoderConfig);
                } else {
                    state.encodedChunks.push(chunk);
                }
            },
            state.recordError,
        );

        if (state.useStreamingMux) {
            state.streamingMuxSession = this.muxer.startStreamingMuxSession(params.demuxed, encodeMeta, this.abortController.signal);
        }

        return { encoder, encodeMeta };
    }

    private setupDecoder(
        params: ProcessFramesParams,
        state: ProcessingState,
        encoder: VideoEncoder,
        encodeMeta: VideoMeta,
        canvas: OffscreenCanvas,
    ): { decoder: VideoDecoder; inFlightTasks: { count: number } } {
        const ctx = canvas.getContext('2d')!;
        if (encodeMeta.width !== params.videoMeta.width || encodeMeta.height !== params.videoMeta.height) {
            canvas.width = encodeMeta.width;
            canvas.height = encodeMeta.height;
        }

        const inFlightTasks = { count: 0 };

        const decoder = this.codecManager.createDecoder(
            params.demuxed.videoTrack.codec,
            params.demuxed.videoTrack.description,
            (frame) => this.processDecodedFrame(frame, params, state, encoder, encodeMeta, canvas, ctx, inFlightTasks),
            state.recordError,
        );

        return { decoder, inFlightTasks };
    }

    private processDecodedFrame(
        frame: VideoFrame,
        params: ProcessFramesParams,
        state: ProcessingState,
        encoder: VideoEncoder,
        encodeMeta: VideoMeta,
        canvas: OffscreenCanvas,
        ctx: OffscreenCanvasRenderingContext2D,
        inFlightTasks: { count: number },
    ): void {
        inFlightTasks.count += 1;
        state.frameProcessingQueue = state.frameProcessingQueue
            .then(async () => {
                if (this.abortController.signal.aborted) {
                    frame.close();
                    return;
                }

                await this.renderAndEncodeFrame({
                    frame,
                    canvas,
                    ctx,
                    videoMeta: encodeMeta,
                    videoRotation: params.demuxed.videoTrack.rotation,
                    telemetryFrames: params.telemetryFrames,
                    safeSyncOffsetSeconds: params.safeSyncOffsetSeconds,
                    config: params.config,
                    encoder,
                    gopFrames: params.gopFrames,
                    encodedFrameCount: state.encodedFrameCount,
                });
                state.encodedFrameCount += 1;
            })
            .finally(() => {
                inFlightTasks.count = Math.max(0, inFlightTasks.count - 1);
            })
            .catch((error) => {
                frame.close();
                state.recordError(error instanceof Error ? error.message : 'Frame processing failed');
            });
    }

    private async decodeAllFrames(
        params: ProcessFramesParams,
        decoder: VideoDecoder,
        state: ProcessingState,
        inFlightTasks: { count: number },
        encoder: VideoEncoder,
    ): Promise<void> {
        let framesProcessed = 0;

        try {
            for (const sample of params.videoSamples) {
                if (this.abortController.signal.aborted) break;

                if (inFlightTasks.count >= MAX_IN_FLIGHT_FRAME_TASKS) {
                    await state.frameProcessingQueue;
                }

                const chunk = this.createVideoChunk(sample);
                decoder.decode(chunk);
                framesProcessed++;
                params.reportProcessingProgress.report(framesProcessed);

                if (isCodecQueuePressureHigh(decoder, encoder)) {
                    await waitForCodecQueues(decoder, encoder, this.abortController.signal);
                }
            }

            params.reportProcessingProgress.report(framesProcessed, true);

            if (!this.abortController.signal.aborted && !state.error) {
                await decoder.flush();
                await state.frameProcessingQueue;
                await encoder.flush();
            }
        } finally {
            this.closeCodec(decoder, 'VideoDecoder');
            this.closeCodec(encoder, 'VideoEncoder');
        }

        state.framesProcessed = framesProcessed;
    }

    private async muxAndFinalize(
        params: ProcessFramesParams,
        state: ProcessingState,
        encodeMeta: VideoMeta,
    ): Promise<Blob> {
        params.reportMuxProgress.report(0, state.framesProcessed);

        let blob = await this.finalizeOutput({
            useStreamingMux: state.useStreamingMux,
            streamingMuxSession: state.streamingMuxSession,
            demuxed: params.demuxed,
            encodedChunks: state.encodedChunks,
            encoderDecoderConfig: state.encoderDecoderConfig,
            encodeMeta,
            reportMuxProgress: params.reportMuxProgress,
            framesProcessed: state.framesProcessed,
        });

        if (this.options.useFfmpegMux) {
            params.reportMuxProgress.report(99, state.framesProcessed);
            try {
                blob = await remuxWithFfmpeg(blob);
            } catch (error) {
                console.warn('[mux] FFmpeg remux failed, using Mediabunny output as-is', error);
            }
        }

        this.options.onProgress?.({ phase: 'complete', percent: 100, framesProcessed: state.framesProcessed, totalFrames: params.totalFrames });

        return blob;
    }

    private async renderAndEncodeFrame(params: {
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
    }): Promise<void> {
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

        drawVideoFrameWithRotation(ctx, frame, videoMeta.width, videoMeta.height, videoRotation);
        if (telemetry) {
            await renderOverlay(ctx, telemetry, videoMeta.width, videoMeta.height, config);
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

    private createVideoChunk(sample: DemuxedMedia['videoSamples'][number]): EncodedVideoChunk {
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

    private closeCodec(codec: VideoDecoder | VideoEncoder, name: string): void {
        if (codec.state !== 'closed') {
            try {
                codec.close();
            } catch (error) {
                console.warn(`${name} close failed`, error);
            }
        }
    }

    private async finalizeOutput(params: {
        useStreamingMux: boolean;
        streamingMuxSession: StreamingMuxSession | undefined;
        demuxed: DemuxedMedia;
        encodedChunks: EncodedVideoChunk[];
        encoderDecoderConfig: VideoDecoderConfig | undefined;
        encodeMeta: VideoMeta;
        reportMuxProgress: { report: (percent: number, frames: number) => void };
        framesProcessed: number;
    }): Promise<Blob> {
        const {
            useStreamingMux, streamingMuxSession, demuxed, encodedChunks,
            encoderDecoderConfig, encodeMeta, reportMuxProgress, framesProcessed,
        } = params;

        if (useStreamingMux && streamingMuxSession) {
            await streamingMuxSession.flushVideoQueue();
            return streamingMuxSession.finalize(
                demuxed.audioSamples,
                demuxed.audioTrack?.decoderConfig ?? (encoderDecoderConfig as AudioDecoderConfig | undefined),
                (percent) => reportMuxProgress.report(percent, framesProcessed),
            );
        }

        return this.muxer.muxMp4(
            demuxed,
            encodedChunks,
            encoderDecoderConfig,
            encodeMeta,
            (percent) => reportMuxProgress.report(percent, framesProcessed),
        );
    }
}
