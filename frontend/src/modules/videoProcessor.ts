import type { TelemetryFrame, ExtendedOverlayConfig, ProcessingProgress, VideoMeta, VideoProcessingProfile } from '../core/types';
import { ProcessingError } from '../core/errors';
import { DEFAULT_OVERLAY_CONFIG } from './overlayRenderer';
import { transcodeWithForcedKeyframes, remuxWithFfmpeg } from './ffmpegUtils';
import { createKeyframeDetector, detectSourceGopSize } from './keyframeDetector';
import { createDemuxer } from './demuxer';
import { createMuxer } from './muxer';
import { createVideoCodecManager } from './videoCodecManager';
import {
    createProcessingProgressReporter,
    createMuxProgressReporter,
} from './progressUtils';
import { isCodecQueuePressureHigh, waitForCodecQueues } from './videoProcessingTypes';
import type { DemuxedMedia, StreamingMuxSession } from './videoProcessingTypes';
import { renderAndEncodeFrame, createVideoChunk, closeCodec } from './videoProcessing';
import { createVideoProcessingProfiler } from './videoProcessingProfiler';
import { getVideoProcessingDeviceProfile } from './browserCapabilities';

export interface VideoProcessorOptions {
    videoFile: File;
    videoMeta: VideoMeta;
    telemetryFrames: TelemetryFrame[];
    syncOffsetSeconds: number;
    overlayConfig?: ExtendedOverlayConfig;
    onProgress?: (progress: ProcessingProgress) => void;
    onProfile?: (profile: VideoProcessingProfile) => void;
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
    private activeProfiler = createVideoProcessingProfiler();
    private paused = false;
    private pauseResumeResolve: (() => void) | null = null;

    constructor(options: VideoProcessorOptions) {
        this.options = options;
        this.abortController = new AbortController();
    }

    /**
     * Start processing the video.
     */
    async process(): Promise<Blob> {
        this.activeProfiler = createVideoProcessingProfiler();

        if (typeof VideoDecoder === 'undefined' || typeof VideoEncoder === 'undefined') {
            throw new ProcessingError('WebCodecs API is not available in the current browser');
        }

        const { videoFile, videoMeta, telemetryFrames, syncOffsetSeconds, overlayConfig, onProgress } = this.options;
        const config = overlayConfig ?? DEFAULT_OVERLAY_CONFIG;
        const safeSyncOffsetSeconds = Number.isFinite(syncOffsetSeconds) ? syncOffsetSeconds : 0;

        onProgress?.({ phase: 'demuxing', percent: 0, framesProcessed: 0, totalFrames: 0 });

        const sourceFile = videoFile;
        let demuxed = await this.activeProfiler.measure('demuxing', async () => {
            return await this.demuxer.demuxWithFallback(sourceFile, onProgress);
        });

        demuxed = await this.ensureDecodableTrack(demuxed, sourceFile, videoMeta, onProgress);
        demuxed = await this.ensureKeyframes(demuxed, sourceFile, videoMeta, onProgress);

        // prepare processing helpers (extracted so we can retry on decoder failure)
        const makeProcessingParams = (demux: typeof demuxed) => {
            const videoSamplesLocal = this.sliceFromFirstKeyframe(demux.videoSamples);
            const totalFramesLocal = videoSamplesLocal.length;
            const gopFramesLocal = detectSourceGopSize(videoSamplesLocal, videoMeta.fps);

            return {
                demuxed: demux,
                videoSamples: videoSamplesLocal,
                totalFrames: totalFramesLocal,
                gopFrames: gopFramesLocal,
                videoMeta,
                telemetryFrames,
                safeSyncOffsetSeconds,
                config,
                reportProcessingProgress: createProcessingProgressReporter(onProgress, totalFramesLocal),
                reportMuxProgress: createMuxProgressReporter(onProgress, totalFramesLocal),
            } as ProcessFramesParams;
        };

        onProgress?.({ phase: 'processing', percent: 0, framesProcessed: 0, totalFrames: makeProcessingParams(demuxed).totalFrames });

        // Try processing once; on a runtime decoder failure attempt an automatic transcode + retry.
        const runProcessing = async (paramsForRun: ProcessFramesParams) => {
            return await this.processFrames(paramsForRun);
        };

        try {
            return await runProcessing(makeProcessingParams(demuxed));
        } catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            const isDecoderFailure = /decoder failure|video decoding error/i.test(text);

            if (isDecoderFailure) {
                console.warn('[VideoProcessor] Decoder failure detected — attempting FFmpeg fallback and retry', error);

                // show encoding progress to the user while we transcode
                onProgress?.({ phase: 'encoding', percent: 0, framesProcessed: 0, totalFrames: 0 });

                // transcode with forced keyframes (same params as other recovery paths)
                this.activeProfiler.incrementFallbackTranscodes();
                const transcodedFile = await this.activeProfiler.measure('encoding', async () => {
                    return await transcodeWithForcedKeyframes(
                        sourceFile,
                        { fps: videoMeta.fps, duration: videoMeta.duration },
                        {
                            gopSize: Math.max(1, Math.round(videoMeta.fps)),
                            onProgress: (percent) => onProgress?.({ phase: 'encoding', percent, framesProcessed: 0, totalFrames: 0 }),
                        },
                    );
                });

                // Reset abort controller so retry can run (previous run aborted on error)
                this.abortController = new AbortController();

                // demux the newly transcoded file and re-run the standard validations
                let recoveredDemux = await this.activeProfiler.measure('demuxing', async () => {
                    return await this.demuxer.demuxWithFallback(transcodedFile, onProgress);
                });
                recoveredDemux = await this.ensureDecodableTrack(recoveredDemux, transcodedFile, videoMeta, onProgress);
                recoveredDemux = await this.ensureKeyframes(recoveredDemux, transcodedFile, videoMeta, onProgress);

                // retry processing once with the recovered file
                return await runProcessing(makeProcessingParams(recoveredDemux));
            }

            throw error;
        }

        finally {
            this.activeProfiler = createVideoProcessingProfiler();
        }
    }

    /**
     * Cancel the video processing.
     */
    cancel(): void {
        this.abortController.abort();
    }

    /**
     * Pause processing. Decode loop waits without spinning.
     * Call resume() to continue.
     */
    pause(): void {
        this.paused = true;
    }

    /**
     * Resume processing after pause.
     */
    resume(): void {
        this.paused = false;
        this.pauseResumeResolve?.();
        this.pauseResumeResolve = null;
    }

    /**
     * Wait while paused. Resolves immediately if not paused.
     */
    private async waitForResume(): Promise<void> {
        if (!this.paused) return;
        return new Promise<void>((resolve) => {
            this.pauseResumeResolve = resolve;
        });
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
        this.activeProfiler.incrementFallbackTranscodes();
        const transcodedFile = await this.activeProfiler.measure('encoding', async () => {
            return await transcodeWithForcedKeyframes(
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
        });

        const result = await this.activeProfiler.measure('demuxing', async () => {
            return await this.demuxer.demuxWithFallback(transcodedFile, onProgress);
        });
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
        this.activeProfiler.incrementFallbackTranscodes();
        const transcodedFile = await this.activeProfiler.measure('encoding', async () => {
            return await transcodeWithForcedKeyframes(
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
        });

        const result = await this.activeProfiler.measure('demuxing', async () => {
            return await this.demuxer.demuxWithFallback(transcodedFile, onProgress);
        });
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
        const processingProfile = getVideoProcessingDeviceProfile();
        const processingState = this.initializeProcessingState(params, processingProfile);

        await this.tryInitializeWebGPU();

        const { encoder, encodeMeta } = await this.setupEncoder(params, processingState);
        const { decoder, inFlightTasks } = this.setupDecoder(params, processingState, encoder, encodeMeta, canvas);

        await this.activeProfiler.measure('processing', async () => {
            await this.decodeAllFrames(params, decoder, processingState, inFlightTasks, encoder, processingProfile);
        });

        if (processingState.error) throw processingState.error;
        if (this.abortController.signal.aborted) {
            throw new ProcessingError('Processing was cancelled by the user');
        }

        const blob = await this.activeProfiler.measure('muxing', async () => {
            return await this.muxAndFinalize(params, processingState, encodeMeta, processingProfile);
        });
        this.emitProfile(processingState.framesProcessed, processingState.useStreamingMux);
        return blob;
    }

    private emitProfile(processedFrames: number, usedStreamingMux: boolean): void {
        if (!this.options.onProfile) return;

        const profile = this.activeProfiler.finish({
            processedFrames,
            usedStreamingMux,
        });

        this.options.onProfile(profile);
    }

    private createProcessingCanvas(videoMeta: VideoMeta): OffscreenCanvas {
        return new OffscreenCanvas(videoMeta.width, videoMeta.height);
    }

    private initializeProcessingState(
        params: ProcessFramesParams,
        processingProfile: ReturnType<typeof getVideoProcessingDeviceProfile>,
    ): ProcessingState {
        const useStreamingMux = this.options.videoFile.size >= processingProfile.streamingMuxFileSizeBytes
            || params.totalFrames >= processingProfile.streamingMuxMinFrameCount;

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
            const { WebGPUAdapter } = await import('./webgpu/webgpuAdapter');
            if (WebGPUAdapter.isSupported()) {
                const adapter = WebGPUAdapter.getInstance();
                await adapter.ensureInitialized();
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
            try {
                state.streamingMuxSession = await this.muxer.startStreamingMuxSession(params.demuxed, encodeMeta, this.abortController.signal);

                if (!state.streamingMuxSession.opfsAvailable) {
                    this.options.onProgress?.({
                        phase: 'processing',
                        percent: 0,
                        framesProcessed: 0,
                        totalFrames: 0,
                        warning: 'Streaming mux is using in-memory buffer — your device does not support OPFS. Long videos may fail on memory-limited devices.',
                    });
                }
            } catch {
                state.useStreamingMux = false;
            }
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

                renderAndEncodeFrame({
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
        processingProfile: { maxInFlightFrameTasks: number; codecQueueHighWatermark: number },
    ): Promise<void> {
        let framesProcessed = 0;

        try {
            for (const sample of params.videoSamples) {
                if (this.abortController.signal.aborted) break;

                if (this.paused) {
                    await this.waitForResume();
                    if (this.abortController.signal.aborted) break;
                }

                if (inFlightTasks.count >= processingProfile.maxInFlightFrameTasks) {
                    await state.frameProcessingQueue;
                }

                const chunk = createVideoChunk(sample);
                decoder.decode(chunk);
                framesProcessed++;
                params.reportProcessingProgress.report(framesProcessed);

                if (isCodecQueuePressureHigh(decoder, encoder, processingProfile.codecQueueHighWatermark)) {
                    await waitForCodecQueues(decoder, encoder, this.abortController.signal, processingProfile.codecQueueHighWatermark);
                }
            }

            params.reportProcessingProgress.report(framesProcessed, true);

            if (!this.abortController.signal.aborted && !state.error) {
                await decoder.flush();
                await state.frameProcessingQueue;
                await encoder.flush();
            }
        } finally {
            closeCodec(decoder, 'VideoDecoder');
            closeCodec(encoder, 'VideoEncoder');
        }

        state.framesProcessed = framesProcessed;
    }

    private async muxAndFinalize(
        params: ProcessFramesParams,
        state: ProcessingState,
        encodeMeta: VideoMeta,
        processingProfile: ReturnType<typeof getVideoProcessingDeviceProfile>,
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

        if (this.options.useFfmpegMux && processingProfile.allowFfmpegMuxRemux) {
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
