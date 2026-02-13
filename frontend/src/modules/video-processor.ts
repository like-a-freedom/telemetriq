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

export interface VideoProcessorOptions {
    videoFile: File;
    videoMeta: VideoMeta;
    telemetryFrames: TelemetryFrame[];
    syncOffsetSeconds: number;
    overlayConfig?: ExtendedOverlayConfig;
    onProgress?: (progress: ProcessingProgress) => void;
    useFfmpegMux?: boolean;
}

const STREAMING_MUX_FILE_SIZE_BYTES = 512 * 1024 * 1024; // 512 MB

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

        let sourceFile = videoFile;
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

    private async processFrames(params: {
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
    }): Promise<Blob> {
        const {
            demuxed, videoSamples, totalFrames, gopFrames,
            videoMeta, telemetryFrames, safeSyncOffsetSeconds,
            config, reportProcessingProgress, reportMuxProgress,
        } = params;

        const canvas = new OffscreenCanvas(videoMeta.width, videoMeta.height);
        const ctx = canvas.getContext('2d')!;

        const useStreamingMux = this.options.videoFile.size >= STREAMING_MUX_FILE_SIZE_BYTES;
        const encodedChunks: EncodedVideoChunk[] = [];
        let encodedFrameCount = 0;
        let encoderDecoderConfig: VideoDecoderConfig | undefined;
        let processingError: ProcessingError | undefined;
        let streamingMuxSession: StreamingMuxSession | undefined;

        const recordError = (message: string): void => {
            if (!processingError) {
                processingError = new ProcessingError(message);
                this.abortController.abort();
            }
        };

        const { encoder, encodeMeta } = await this.codecManager.createEncoder(
            videoMeta,
            demuxed.videoTrack.codec,
            (chunk, metadata) => {
                if (metadata?.decoderConfig) {
                    encoderDecoderConfig = metadata.decoderConfig;
                }
                if (useStreamingMux && streamingMuxSession) {
                    streamingMuxSession.enqueueVideoChunk(chunk, metadata?.decoderConfig ?? encoderDecoderConfig);
                } else {
                    encodedChunks.push(chunk);
                }
            },
            recordError,
        );

        if (useStreamingMux) {
            streamingMuxSession = this.muxer.startStreamingMuxSession(demuxed, encodeMeta, this.abortController.signal);
        }

        if (encodeMeta.width !== videoMeta.width || encodeMeta.height !== videoMeta.height) {
            canvas.width = encodeMeta.width;
            canvas.height = encodeMeta.height;
        }

        const decoder = this.codecManager.createDecoder(
            demuxed.videoTrack.codec,
            demuxed.videoTrack.description,
            (frame) => {
                if (this.abortController.signal.aborted) {
                    frame.close();
                    return;
                }

                this.renderAndEncodeFrame({
                    frame,
                    canvas,
                    ctx,
                    videoMeta: encodeMeta,
                    telemetryFrames,
                    safeSyncOffsetSeconds,
                    config,
                    encoder,
                    gopFrames,
                    encodedFrameCount,
                });
                encodedFrameCount += 1;
            },
            recordError,
        );

        let framesProcessed = 0;

        try {
            for (const sample of videoSamples) {
                if (this.abortController.signal.aborted) break;

                const chunk = this.createVideoChunk(sample);
                decoder.decode(chunk);
                framesProcessed++;
                reportProcessingProgress.report(framesProcessed);

                if (isCodecQueuePressureHigh(decoder, encoder)) {
                    await waitForCodecQueues(decoder, encoder, this.abortController.signal);
                }
            }

            reportProcessingProgress.report(framesProcessed, true);

            if (!this.abortController.signal.aborted && !processingError) {
                await decoder.flush();
                await encoder.flush();
            }
        } finally {
            this.closeCodec(decoder, 'VideoDecoder');
            this.closeCodec(encoder, 'VideoEncoder');
        }

        if (processingError) throw processingError;
        if (this.abortController.signal.aborted) {
            throw new ProcessingError('Processing was cancelled by the user');
        }

        reportMuxProgress.report(0, framesProcessed);

        let blob = await this.finalizeOutput({
            useStreamingMux,
            streamingMuxSession,
            demuxed,
            encodedChunks,
            encoderDecoderConfig,
            encodeMeta,
            reportMuxProgress,
            framesProcessed,
        });

        if (this.options.useFfmpegMux) {
            reportMuxProgress.report(99, framesProcessed);
            try {
                blob = await remuxWithFfmpeg(blob);
            } catch (error) {
                console.warn('[mux] FFmpeg remux failed, using Mediabunny output as-is', error);
            }
        }

        this.options.onProgress?.({ phase: 'complete', percent: 100, framesProcessed, totalFrames });

        return blob;
    }

    private renderAndEncodeFrame(params: {
        frame: VideoFrame;
        canvas: OffscreenCanvas;
        ctx: OffscreenCanvasRenderingContext2D;
        videoMeta: VideoMeta;
        telemetryFrames: TelemetryFrame[];
        safeSyncOffsetSeconds: number;
        config: ExtendedOverlayConfig;
        encoder: VideoEncoder;
        gopFrames: number;
        encodedFrameCount: number;
    }): void {
        const {
            frame, canvas, ctx, videoMeta, telemetryFrames,
            safeSyncOffsetSeconds, config, encoder, gopFrames, encodedFrameCount,
        } = params;

        const videoTimeSec = (frame.timestamp ?? 0) / 1_000_000;
        const telemetry = getTelemetryAtTime(telemetryFrames, videoTimeSec, safeSyncOffsetSeconds);

        ctx.drawImage(frame, 0, 0, videoMeta.width, videoMeta.height);
        if (telemetry) {
            renderOverlay(ctx, telemetry, videoMeta.width, videoMeta.height, config);
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

        return new EncodedVideoChunk({
            type: sample.is_rap ? 'key' : 'delta',
            timestamp: Math.round(timestampUs),
            duration: Math.round(durationUs),
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
