import type { TelemetryFrame, ExtendedOverlayConfig, ProcessingProgress, VideoMeta } from '../core/types';
import { ProcessingError } from '../core/errors';
import { getTelemetryAtTime } from './telemetry-core';
import { renderOverlay, DEFAULT_OVERLAY_CONFIG } from './overlay-renderer';
import {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    EncodedAudioPacketSource,
    EncodedPacket,
    EncodedPacketSink,
    EncodedVideoPacketSource,
    Input,
    Mp4OutputFormat,
    Output,
} from 'mediabunny';
import {
    getCodecCandidates,
    scaleToMaxArea,
    estimateTargetBitrate,
    toMediabunnyVideoCodec,
    toMediabunnyAudioCodec,
} from './codec-utils';
import {
    remuxWithFfmpeg,
    transcodeWithForcedKeyframes,
} from './ffmpeg-utils';
import {
    createKeyframeDetector,
    detectSourceGopSize,
    type Mp4Sample,
} from './keyframe-detector';

export interface VideoProcessorOptions {
    videoFile: File;
    videoMeta: VideoMeta;
    telemetryFrames: TelemetryFrame[];
    syncOffsetSeconds: number;
    overlayConfig?: ExtendedOverlayConfig;
    onProgress?: (progress: ProcessingProgress) => void;
    useFfmpegMux?: boolean;
}

type DemuxedMedia = {
    videoTrack: {
        id: number;
        codec: string;
        codecName: string;
        description?: AllowSharedBufferSource;
        timescale: number;
        decoderConfig?: VideoDecoderConfig;
    };
    audioTrack?: {
        id: number;
        codec: string;
        codecName: string;
        timescale: number;
        audio?: { channel_count?: number; sample_rate?: number };
        decoderConfig?: AudioDecoderConfig;
    };
    videoSamples: Mp4Sample[];
    audioSamples: Mp4Sample[];
};

type StreamingMuxSession = {
    enqueueVideoChunk: (chunk: EncodedVideoChunk, decoderConfig?: VideoDecoderConfig) => void;
    flushVideoQueue: () => Promise<void>;
    finalize: (
        audioSamples: Mp4Sample[],
        audioDecoderConfig?: AudioDecoderConfig,
        onProgress?: (percent: number) => void,
    ) => Promise<Blob>;
};

/**
 * FFmpeg.wasm fallback reads the whole file into memory.
 * For very large files this can freeze/crash the tab, so skip fallback.
 */
const FFMPEG_FALLBACK_MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB
const STREAMING_MUX_FILE_SIZE_BYTES = 512 * 1024 * 1024; // 512 MB
const PROGRESS_UPDATE_MIN_INTERVAL_MS = 120;
const CODEC_QUEUE_HIGH_WATERMARK = 24;

/**
 * Process a video file by decoding each frame, overlaying telemetry data,
 * and encoding back to an MP4 container.
 *
 * Uses Mediabunny for demux/mux and WebCodecs for decode/encode.
 */
export class VideoProcessor {
    private abortController: AbortController;
    private options: VideoProcessorOptions;

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
        let demuxed = await this.demuxSamplesWithFallback(sourceFile, onProgress);

        const canDecodeSourceTrack = await this.isVideoTrackDecodable(
            demuxed.videoTrack.codec,
            demuxed.videoTrack.description,
        );

        if (!canDecodeSourceTrack) {
            onProgress?.({ phase: 'encoding', percent: 0, framesProcessed: 0, totalFrames: 0 });
            const transcodedForCompatibility = await transcodeWithForcedKeyframes(
                sourceFile,
                { fps: videoMeta.fps, duration: videoMeta.duration },
                {
                    gopSize: Math.max(1, Math.round(videoMeta.fps)),
                    onProgress: (percent, _time) => {
                        onProgress?.({
                            phase: 'encoding',
                            percent,
                            framesProcessed: 0,
                            totalFrames: 0,
                        });
                    },
                },
            );
            sourceFile = transcodedForCompatibility;
            demuxed = await this.demuxSamplesWithFallback(sourceFile, onProgress);

            const canDecodeTranscodedTrack = await this.isVideoTrackDecodable(
                demuxed.videoTrack.codec,
                demuxed.videoTrack.description,
            );
            if (!canDecodeTranscodedTrack) {
                throw new ProcessingError(
                    `Browser does not support decoding codec ${demuxed.videoTrack.codec} and automatic transcoding failed.`,
                );
            }
        }

        let keyframeDetector = createKeyframeDetector(
            demuxed.videoTrack.codec,
            demuxed.videoTrack.description,
        );
        let firstKeyframeIndex = demuxed.videoSamples.findIndex((sample) => sample.is_rap);
        if (firstKeyframeIndex === -1) {
            firstKeyframeIndex = demuxed.videoSamples.findIndex((sample) => keyframeDetector(sample));
        }

        if (firstKeyframeIndex === -1) {
            onProgress?.({ phase: 'encoding', percent: 0, framesProcessed: 0, totalFrames: 0 });
            const transcodedFile = await transcodeWithForcedKeyframes(
                sourceFile,
                { fps: videoMeta.fps, duration: videoMeta.duration },
                {
                    gopSize: Math.max(1, Math.round(videoMeta.fps)),
                    onProgress: (percent, _time) => {
                        onProgress?.({
                            phase: 'encoding',
                            percent,
                            framesProcessed: 0,
                            totalFrames: 0,
                        });
                    },
                },
            );
            demuxed = await this.demuxSamplesWithFallback(transcodedFile, onProgress);
            keyframeDetector = createKeyframeDetector(
                demuxed.videoTrack.codec,
                demuxed.videoTrack.description,
            );
            firstKeyframeIndex = demuxed.videoSamples.findIndex((sample) => keyframeDetector(sample));
        }

        if (firstKeyframeIndex === -1) {
            throw new ProcessingError(
                'No IDR keyframes found in the video track. Automatic recovery failed and the file cannot be decoded.',
            );
        }

        const videoSamples = demuxed.videoSamples.slice(firstKeyframeIndex);
        const totalFrames = videoSamples.length;
        const gopFrames = detectSourceGopSize(videoSamples, videoMeta.fps);
        const reportProcessingProgress = createProcessingProgressReporter(onProgress, totalFrames);
        const reportMuxProgress = createMuxProgressReporter(onProgress, totalFrames);

        onProgress?.({ phase: 'processing', percent: 0, framesProcessed: 0, totalFrames });

        const canvas = new OffscreenCanvas(videoMeta.width, videoMeta.height);
        const ctx = canvas.getContext('2d')!;

        const useStreamingMux = sourceFile.size >= STREAMING_MUX_FILE_SIZE_BYTES;
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

        const { encoder, encodeMeta } = await this.createEncoder(
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
            streamingMuxSession = await this.startStreamingMuxSession(demuxed, encodeMeta);
        }

        if (encodeMeta.width !== videoMeta.width || encodeMeta.height !== videoMeta.height) {
            canvas.width = encodeMeta.width;
            canvas.height = encodeMeta.height;
        }

        const decoder = this.createDecoder(
            demuxed.videoTrack.codec,
            demuxed.videoTrack.description,
            (frame) => {
                if (this.abortController.signal.aborted) {
                    frame.close();
                    return;
                }

                const videoTimeSec = (frame.timestamp ?? 0) / 1_000_000;
                const telemetry = getTelemetryAtTime(telemetryFrames, videoTimeSec, safeSyncOffsetSeconds);

                ctx.drawImage(frame, 0, 0, encodeMeta.width, encodeMeta.height);
                if (telemetry) {
                    renderOverlay(ctx, telemetry, encodeMeta.width, encodeMeta.height, config);
                }

                const newFrame = new VideoFrame(canvas, {
                    timestamp: frame.timestamp,
                    duration: frame.duration ?? undefined,
                });
                frame.close();

                const forceKeyFrame = encodedFrameCount === 0
                    || (gopFrames > 0 && encodedFrameCount % gopFrames === 0);
                if (forceKeyFrame) {
                    encoder.encode(newFrame, { keyFrame: true });
                } else {
                    encoder.encode(newFrame);
                }
                encodedFrameCount += 1;
                newFrame.close();
            },
            recordError,
        );

        let framesProcessed = 0;

        try {
            for (const sample of videoSamples) {
                if (this.abortController.signal.aborted) break;

                const timestampUs = (sample.cts / sample.timescale) * 1_000_000;
                const durationUs = (sample.duration / sample.timescale) * 1_000_000;

                const isChunkKeyframe = sample.is_rap || framesProcessed === 0;
                const chunk = new EncodedVideoChunk({
                    type: isChunkKeyframe ? 'key' : 'delta',
                    timestamp: Math.round(timestampUs),
                    duration: Math.round(durationUs),
                    data: new Uint8Array(sample.data),
                });

                decoder.decode(chunk);
                framesProcessed++;

                reportProcessingProgress(framesProcessed);

                if (isCodecQueuePressureHigh(decoder, encoder)) {
                    await waitForCodecQueues(decoder, encoder, this.abortController.signal);
                }
            }

            reportProcessingProgress(framesProcessed, true);

            if (!this.abortController.signal.aborted && !processingError) {
                await decoder.flush();
                await encoder.flush();
            }
        } finally {
            if (decoder.state !== 'closed') {
                try {
                    decoder.close();
                } catch (error) {
                    console.warn('VideoDecoder close failed', error);
                }
            }
            if (encoder.state !== 'closed') {
                try {
                    encoder.close();
                } catch (error) {
                    console.warn('VideoEncoder close failed', error);
                }
            }
        }

        if (processingError) {
            throw processingError;
        }

        if (this.abortController.signal.aborted) {
            throw new ProcessingError('Processing was cancelled by the user');
        }

        reportMuxProgress(0, framesProcessed);

        let blob: Blob;
        if (useStreamingMux && streamingMuxSession) {
            blob = await this.finalizeStreamingMux(
                streamingMuxSession,
                demuxed,
                encoderDecoderConfig,
                reportMuxProgress,
                framesProcessed,
            );
        } else {
            blob = await this.muxMp4(
                demuxed,
                encodedChunks,
                encoderDecoderConfig,
                encodeMeta,
                (percent) => reportMuxProgress(percent, framesProcessed),
            );
        }

        if (this.options.useFfmpegMux) {
            reportMuxProgress(99, framesProcessed);
            try {
                blob = await remuxWithFfmpeg(blob);
            } catch (error) {
                console.warn('[mux] FFmpeg remux failed, using Mediabunny output as-is', error);
            }
        }

        onProgress?.({ phase: 'complete', percent: 100, framesProcessed, totalFrames });

        return blob;
    }

    /**
     * Cancel the video processing.
     */
    cancel(): void {
        this.abortController.abort();
    }

    private async demuxSamplesWithFallback(
        file: File,
        onProgress?: (progress: ProcessingProgress) => void,
    ): Promise<DemuxedMedia> {
        // First attempt: direct parse
        try {
            const result = await this.demuxSamples(file);
            if (result.videoSamples.length > 0) return result;
            throw new ProcessingError('Parser returned zero video samples');
        } catch (firstError) {
            console.warn('[demux] Direct parse failed, trying FFmpeg remux', firstError);
        }

        if (file.size >= FFMPEG_FALLBACK_MAX_FILE_SIZE_BYTES) {
            throw new ProcessingError(
                'Failed to parse the source container. Automatic FFmpeg repair is disabled for files larger than 1 GB to avoid browser freezes.',
            );
        }

        // Second attempt: remux through FFmpeg (strips problematic metadata)
        try {
            onProgress?.({ phase: 'demuxing', percent: 0, framesProcessed: 0, totalFrames: 0 });
            const remuxedBlob = await remuxWithFfmpeg(file);
            const fileName = file.name.replace(/\.[^/.]+$/, '') + '.mp4';
            const remuxedFile = new File([remuxedBlob], fileName, { type: 'video/mp4' });
            return await this.demuxSamples(remuxedFile);
        } catch (secondError) {
            throw new ProcessingError(
                'Failed to parse the video file. The file may contain unsupported metadata '
                + 'or be corrupted. Automatic repair did not succeed.',
            );
        }
    }

    private async demuxSamples(file: File): Promise<DemuxedMedia> {
        const input = new Input({
            formats: ALL_FORMATS,
            source: new BlobSource(file),
        });

        try {
            const videoTrack = await input.getPrimaryVideoTrack();
            const audioTrack = await input.getPrimaryAudioTrack();

            if (!videoTrack) {
                throw new ProcessingError('No video track found in the file');
            }

            const videoCodecString =
                (await videoTrack.getCodecParameterString())
                ?? (await videoTrack.getDecoderConfig())?.codec
                ?? 'unknown';
            let videoDecoderConfig: VideoDecoderConfig | undefined;
            try {
                videoDecoderConfig = await videoTrack.getDecoderConfig() ?? undefined;
            } catch {
                // Some test/runtime environments may not support decoder config extraction.
                videoDecoderConfig = undefined;
            }
            const videoCodecName = String(videoTrack.codec ?? '').toLowerCase();

            const videoSink = new EncodedPacketSink(videoTrack);
            const videoSamples: Mp4Sample[] = [];
            for await (const packet of videoSink.packets()) {
                const timestampUs = Math.round(packet.timestamp * 1_000_000);
                const durationUs = Math.max(1, Math.round(packet.duration * 1_000_000));
                const data = toTightArrayBuffer(packet.data);
                videoSamples.push({
                    data,
                    duration: durationUs,
                    dts: timestampUs,
                    cts: timestampUs,
                    timescale: 1_000_000,
                    is_rap: packet.type === 'key',
                });
            }
            const videoSinkClosable = videoSink as unknown as { close?: () => void };
            videoSinkClosable.close?.();

            let parsedAudioTrack: DemuxedMedia['audioTrack'];
            const audioSamples: Mp4Sample[] = [];

            if (audioTrack) {
                const audioCodecString =
                    (await audioTrack.getCodecParameterString())
                    ?? (await audioTrack.getDecoderConfig())?.codec
                    ?? 'unknown';
                let audioDecoderConfig: AudioDecoderConfig | undefined;
                try {
                    audioDecoderConfig = await audioTrack.getDecoderConfig() ?? undefined;
                } catch {
                    audioDecoderConfig = undefined;
                }

                const audioSink = new EncodedPacketSink(audioTrack);
                for await (const packet of audioSink.packets()) {
                    const timestampUs = Math.round(packet.timestamp * 1_000_000);
                    const durationUs = Math.max(1, Math.round(packet.duration * 1_000_000));
                    const data = toTightArrayBuffer(packet.data);
                    audioSamples.push({
                        data,
                        duration: durationUs,
                        dts: timestampUs,
                        cts: timestampUs,
                        timescale: 1_000_000,
                        is_rap: packet.type === 'key',
                    });
                }
                const audioSinkClosable = audioSink as unknown as { close?: () => void };
                audioSinkClosable.close?.();

                parsedAudioTrack = {
                    id: 2,
                    codec: audioCodecString,
                    codecName: String(audioTrack.codec ?? '').toLowerCase(),
                    timescale: 1_000_000,
                    decoderConfig: audioDecoderConfig,
                    audio: {
                        channel_count: audioTrack.numberOfChannels,
                        sample_rate: audioTrack.sampleRate,
                    },
                };
            }

            return {
                videoTrack: {
                    id: 1,
                    codec: videoCodecString,
                    codecName: videoCodecName,
                    description: videoDecoderConfig?.description,
                    timescale: 1_000_000,
                    decoderConfig: videoDecoderConfig,
                },
                audioTrack: parsedAudioTrack,
                videoSamples,
                audioSamples,
            };
        } catch (error) {
            const details = error instanceof Error
                ? { cause: error.message }
                : { cause: String(error) };
            throw error instanceof ProcessingError
                ? error
                : new ProcessingError('Failed to parse media tracks with Mediabunny', details);
        } finally {
            const disposable = input as unknown as { [Symbol.dispose]?: () => void };
            try {
                disposable[Symbol.dispose]?.();
            } catch {
                // no-op
            }
        }
    }

    private createDecoder(
        codec: string,
        description: AllowSharedBufferSource | undefined,
        onFrame: (frame: VideoFrame) => void,
        onError: (message: string) => void,
    ): VideoDecoder {
        const decoder = new VideoDecoder({
            output: onFrame,
            error: (e: DOMException) => {
                onError(`Video decoding error: ${e.message}`);
            },
        });

        const decoderConfig: VideoDecoderConfig = { codec };
        if (description) decoderConfig.description = description;
        decoder.configure(decoderConfig);
        return decoder;
    }

    private async isVideoTrackDecodable(codec: string, description?: AllowSharedBufferSource): Promise<boolean> {
        try {
            const config: VideoDecoderConfig = { codec };
            if (description) config.description = description;

            const support = await VideoDecoder.isConfigSupported(config);
            return support.supported === true;
        } catch {
            return false;
        }
    }

    private async createEncoder(
        meta: VideoMeta,
        sourceCodec: string,
        onChunk: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void,
        onError: (message: string) => void,
    ): Promise<{ encoder: VideoEncoder; encodeMeta: VideoMeta }> {
        const encoder = new VideoEncoder({
            output: onChunk,
            error: (e: DOMException) => {
                onError(`Video encoding error: ${e.message}`);
            },
        });

        let encodeMeta: VideoMeta = { ...meta };

        const configureWithCandidates = async (
            codecCandidates: string[],
            targetMeta: VideoMeta,
        ): Promise<VideoEncoderConfig | undefined> => {
            const targetBitrate = estimateTargetBitrate(meta, targetMeta, this.options.videoFile.size);
            const baseConfig: VideoEncoderConfig = {
                codec: codecCandidates[0] ?? 'avc1.640028',
                width: targetMeta.width,
                height: targetMeta.height,
                bitrate: targetBitrate,
                framerate: targetMeta.fps,
                hardwareAcceleration: 'prefer-hardware',
            };

            for (const codec of codecCandidates) {
                const candidate: VideoEncoderConfig = { ...baseConfig, codec };
                const support = await VideoEncoder.isConfigSupported(candidate);
                if (support.supported) {
                    return candidate;
                }

                const softwareCandidate: VideoEncoderConfig = {
                    ...candidate,
                    hardwareAcceleration: 'prefer-software',
                };
                const softwareSupport = await VideoEncoder.isConfigSupported(softwareCandidate);
                if (softwareSupport.supported) {
                    return softwareCandidate;
                }
            }

            return undefined;
        };

        const codecCandidates = getCodecCandidates(meta, sourceCodec);
        let supportedConfig = await configureWithCandidates(codecCandidates, encodeMeta);

        if (!supportedConfig) {
            const fallbackMeta = scaleToMaxArea(meta, 2_097_152);
            encodeMeta = fallbackMeta;
            const fallbackCandidates = getCodecCandidates(encodeMeta, sourceCodec);
            supportedConfig = await configureWithCandidates(fallbackCandidates, encodeMeta);
        }

        if (!supportedConfig) {
            throw new ProcessingError('Unable to find a supported codec configuration for this resolution. Try reducing the video size.');
        }

        encoder.configure(supportedConfig);
        return { encoder, encodeMeta };
    }

    private async muxMp4(
        demuxed: DemuxedMedia,
        encodedChunks: EncodedVideoChunk[],
        decoderConfig: VideoDecoderConfig | undefined,
        meta: VideoMeta,
        onMuxProgress?: (percent: number) => void,
    ): Promise<Blob> {
        const muxWithMode = async (includeAudio: boolean): Promise<Blob> => {
            const output = new Output({
                format: new Mp4OutputFormat(),
                target: new BufferTarget(),
            });

            const videoCodec = decoderConfig?.codec ?? demuxed.videoTrack.codec;
            const videoSource = new EncodedVideoPacketSource(toMediabunnyVideoCodec(videoCodec) as any);
            output.addVideoTrack(videoSource, { frameRate: meta.fps });

            let audioSource: EncodedAudioPacketSource | undefined;
            if (includeAudio && demuxed.audioTrack) {
                audioSource = new EncodedAudioPacketSource(
                    toMediabunnyAudioCodec(demuxed.audioTrack.codec) as any,
                );
                output.addAudioTrack(audioSource);
            }

            await output.start();
            onMuxProgress?.(2);

            const totalUnits = encodedChunks.length
                + ((includeAudio && demuxed.audioSamples.length) ? demuxed.audioSamples.length : 0);
            let doneUnits = 0;
            const reportUnitProgress = (): void => {
                if (totalUnits <= 0) {
                    onMuxProgress?.(95);
                    return;
                }
                const unitsPercent = Math.min(95, Math.round((doneUnits / totalUnits) * 95));
                onMuxProgress?.(unitsPercent);
            };

            let firstVideoPacket = true;
            for (const chunk of encodedChunks) {
                const packet = EncodedPacket.fromEncodedChunk(chunk);
                if (firstVideoPacket) {
                    await videoSource.add(packet, {
                        decoderConfig: decoderConfig,
                    });
                    firstVideoPacket = false;
                } else {
                    await videoSource.add(packet);
                }
                doneUnits += 1;
                reportUnitProgress();
            }

            if (audioSource && demuxed.audioSamples.length) {
                let firstAudioPacket = true;
                for (const sample of demuxed.audioSamples) {
                    const chunk = new EncodedAudioChunk({
                        type: sample.is_rap ? 'key' : 'delta',
                        timestamp: sample.cts,
                        duration: sample.duration,
                        data: new Uint8Array(sample.data),
                    });
                    const packet = EncodedPacket.fromEncodedChunk(chunk);

                    if (firstAudioPacket) {
                        await audioSource.add(packet, {
                            decoderConfig: demuxed.audioTrack?.decoderConfig,
                        });
                        firstAudioPacket = false;
                    } else {
                        await audioSource.add(packet);
                    }
                    doneUnits += 1;
                    reportUnitProgress();
                }
            }

            onMuxProgress?.(98);
            await output.finalize();
            onMuxProgress?.(100);

            const buffer = output.target.buffer;
            if (!buffer || buffer.byteLength === 0) {
                throw new ProcessingError('Mediabunny mux produced empty output');
            }

            return new Blob([buffer], { type: 'video/mp4' });
        };

        try {
            return await muxWithMode(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isContainerError = /stco|isobmff|mux|container|track/i.test(message);
            if (!isContainerError || !demuxed.audioTrack) {
                throw error;
            }

            console.warn('[mux] Audio+video mux failed, retrying video-only output', error);
            return await muxWithMode(false);
        }
    }

    private async startStreamingMuxSession(
        demuxed: DemuxedMedia,
        meta: VideoMeta,
    ): Promise<StreamingMuxSession> {
        const output = new Output({
            format: new Mp4OutputFormat(),
            target: new BufferTarget(),
        });

        const videoSource = new EncodedVideoPacketSource(
            toMediabunnyVideoCodec(demuxed.videoTrack.codec) as any,
        );
        output.addVideoTrack(videoSource, { frameRate: meta.fps });

        let audioSource: EncodedAudioPacketSource | undefined;
        if (demuxed.audioTrack) {
            audioSource = new EncodedAudioPacketSource(
                toMediabunnyAudioCodec(demuxed.audioTrack.codec) as any,
            );
            output.addAudioTrack(audioSource);
        }

        await output.start();

        let isFirstVideoPacket = true;
        let queue: Promise<void> = Promise.resolve();
        let queueError: unknown;

        const enqueueVideoChunk = (chunk: EncodedVideoChunk, decoderConfig?: VideoDecoderConfig): void => {
            if (queueError) return;

            queue = queue
                .then(async () => {
                    const packet = EncodedPacket.fromEncodedChunk(chunk);

                    if (isFirstVideoPacket) {
                        if (decoderConfig) {
                            await videoSource.add(packet, { decoderConfig });
                        } else {
                            await videoSource.add(packet);
                        }
                        isFirstVideoPacket = false;
                        return;
                    }

                    await videoSource.add(packet);
                })
                .catch((error) => {
                    queueError = error;
                    this.abortController.abort();
                });
        };

        const flushVideoQueue = async (): Promise<void> => {
            await queue;
            if (queueError) {
                throw new ProcessingError(
                    `Streaming mux failed while writing video packets: ${queueError instanceof Error ? queueError.message : String(queueError)}`,
                );
            }
        };

        const finalize = async (
            audioSamples: Mp4Sample[],
            audioDecoderConfig?: AudioDecoderConfig,
            onProgress?: (percent: number) => void,
        ): Promise<Blob> => {
            await flushVideoQueue();
            onProgress?.(40);

            if (audioSource && audioSamples.length) {
                let firstAudioPacket = true;
                let doneAudioPackets = 0;
                for (const sample of audioSamples) {
                    const chunk = new EncodedAudioChunk({
                        type: sample.is_rap ? 'key' : 'delta',
                        timestamp: sample.cts,
                        duration: sample.duration,
                        data: new Uint8Array(sample.data),
                    });
                    const packet = EncodedPacket.fromEncodedChunk(chunk);

                    if (firstAudioPacket) {
                        await audioSource.add(packet, {
                            decoderConfig: audioDecoderConfig,
                        });
                        firstAudioPacket = false;
                    } else {
                        await audioSource.add(packet);
                    }

                    doneAudioPackets += 1;
                    const audioProgress = 40 + Math.round((doneAudioPackets / audioSamples.length) * 50);
                    onProgress?.(Math.min(90, audioProgress));
                }
            }

            onProgress?.(95);
            await output.finalize();
            onProgress?.(100);

            const buffer = output.target.buffer;
            if (!buffer || buffer.byteLength === 0) {
                throw new ProcessingError('Mediabunny mux produced empty output');
            }

            return new Blob([buffer], { type: 'video/mp4' });
        };

        return {
            enqueueVideoChunk,
            flushVideoQueue,
            finalize,
        };
    }

    private async finalizeStreamingMux(
        session: StreamingMuxSession,
        demuxed: DemuxedMedia,
        decoderConfig: VideoDecoderConfig | undefined,
        onMuxProgress: (percent: number, framesProcessed: number) => void,
        framesProcessed: number,
    ): Promise<Blob> {
        await session.flushVideoQueue();
        return session.finalize(
            demuxed.audioSamples,
            demuxed.audioTrack?.decoderConfig ?? decoderConfig,
            (percent) => onMuxProgress(percent, framesProcessed),
        );
    }
}

function toTightArrayBuffer(data: Uint8Array): ArrayBuffer {
    if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
        return data.buffer;
    }

    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function createProcessingProgressReporter(
    onProgress: VideoProcessorOptions['onProgress'],
    totalFrames: number,
): (framesProcessed: number, force?: boolean) => void {
    let lastReportedFrames = -1;
    let lastReportAt = 0;

    return (framesProcessed: number, force = false): void => {
        if (!onProgress) return;

        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const percent = totalFrames > 0
            ? Math.round((framesProcessed / totalFrames) * 100)
            : 0;

        const shouldReport = force
            || framesProcessed === totalFrames
            || framesProcessed === 0
            || now - lastReportAt >= PROGRESS_UPDATE_MIN_INTERVAL_MS;

        if (!shouldReport) return;

        lastReportedFrames = framesProcessed;
        lastReportAt = now;

        onProgress({
            phase: 'processing',
            percent,
            framesProcessed,
            totalFrames,
        });
    };
}

function createMuxProgressReporter(
    onProgress: VideoProcessorOptions['onProgress'],
    totalFrames: number,
): (percent: number, framesProcessed: number) => void {
    return (percent: number, framesProcessed: number): void => {
        if (!onProgress) return;

        const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
        onProgress({
            phase: 'muxing',
            percent: safePercent,
            framesProcessed,
            totalFrames,
        });
    };
}

function isCodecQueuePressureHigh(decoder: VideoDecoder, encoder: VideoEncoder): boolean {
    return decoder.decodeQueueSize > CODEC_QUEUE_HIGH_WATERMARK
        || encoder.encodeQueueSize > CODEC_QUEUE_HIGH_WATERMARK;
}

async function waitForCodecQueues(
    decoder: VideoDecoder,
    encoder: VideoEncoder,
    signal: AbortSignal,
): Promise<void> {
    let spin = 0;
    while (!signal.aborted && isCodecQueuePressureHigh(decoder, encoder)) {
        // Yield rarely to keep throughput high while still preventing queue runaway.
        if (spin % 2 === 0) {
            await Promise.resolve();
        } else {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        spin += 1;
    }
}
