import type { TelemetryFrame, OverlayConfig, ProcessingProgress, VideoMeta } from '../core/types';
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
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export interface VideoProcessorOptions {
    videoFile: File;
    videoMeta: VideoMeta;
    telemetryFrames: TelemetryFrame[];
    syncOffsetSeconds: number;
    overlayConfig?: OverlayConfig;
    onProgress?: (progress: ProcessingProgress) => void;
    useFfmpegMux?: boolean;
}

type Mp4Sample = {
    data: ArrayBuffer;
    duration: number;
    dts: number;
    cts: number;
    timescale: number;
    is_rap: boolean;
};

type DemuxedMedia = {
    videoTrack: {
        id: number;
        codec: string;
        codecName: string;
        description?: BufferSource;
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

        onProgress?.({ phase: 'demuxing', percent: 0, framesProcessed: 0, totalFrames: 0 });

        let sourceFile = videoFile;
        let demuxed = await this.demuxSamplesWithFallback(sourceFile, onProgress);

        const canDecodeSourceTrack = await this.isVideoTrackDecodable(
            demuxed.videoTrack.codec,
            demuxed.videoTrack.description,
        );

        if (!canDecodeSourceTrack) {
            onProgress?.({ phase: 'encoding', percent: 0, framesProcessed: 0, totalFrames: 0 });
            const transcodedForCompatibility = await this.transcodeWithForcedKeyframes(sourceFile, videoMeta, onProgress);
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

        let keyframeDetector = this.createKeyframeDetector(
            demuxed.videoTrack.codec,
            demuxed.videoTrack.description,
        );
        let firstKeyframeIndex = demuxed.videoSamples.findIndex((sample) => keyframeDetector(sample));

        if (firstKeyframeIndex === -1) {
            onProgress?.({ phase: 'encoding', percent: 0, framesProcessed: 0, totalFrames: 0 });
            const transcodedFile = await this.transcodeWithForcedKeyframes(sourceFile, videoMeta, onProgress);
            demuxed = await this.demuxSamplesWithFallback(transcodedFile, onProgress);
            keyframeDetector = this.createKeyframeDetector(
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

        onProgress?.({ phase: 'processing', percent: 0, framesProcessed: 0, totalFrames });

        const canvas = new OffscreenCanvas(videoMeta.width, videoMeta.height);
        const ctx = canvas.getContext('2d')!;

        const encodedChunks: { chunk: EncodedVideoChunk; duration: number }[] = [];
        const keyframeQueue: boolean[] = [];
        let encoderDecoderConfig: VideoDecoderConfig | undefined;
        let processingError: ProcessingError | undefined;

        const recordError = (message: string): void => {
            if (!processingError) {
                processingError = new ProcessingError(message);
                this.abortController.abort();
            }
        };

        const { encoder, encodeMeta } = await this.createEncoder(videoMeta, (chunk, metadata) => {
            if (metadata?.decoderConfig) {
                encoderDecoderConfig = metadata.decoderConfig;
            }
            encodedChunks.push({ chunk, duration: chunk.duration ?? 0 });
        }, recordError);

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
                const telemetry = getTelemetryAtTime(telemetryFrames, videoTimeSec, syncOffsetSeconds);

                ctx.drawImage(frame, 0, 0, encodeMeta.width, encodeMeta.height);
                if (telemetry) {
                    renderOverlay(ctx, telemetry, encodeMeta.width, encodeMeta.height, config);
                }

                const newFrame = new VideoFrame(canvas, {
                    timestamp: frame.timestamp,
                    duration: frame.duration ?? undefined,
                });
                frame.close();

                const keyFrame = keyframeQueue.shift() ?? false;
                encoder.encode(newFrame, { keyFrame });
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

                const isKeyframe = keyframeDetector(sample);
                keyframeQueue.push(isKeyframe);
                const chunk = new EncodedVideoChunk({
                    type: isKeyframe ? 'key' : 'delta',
                    timestamp: Math.round(timestampUs),
                    duration: Math.round(durationUs),
                    data: new Uint8Array(sample.data),
                });

                decoder.decode(chunk);
                framesProcessed++;

                onProgress?.({
                    phase: 'processing',
                    percent: Math.round((framesProcessed / totalFrames) * 100),
                    framesProcessed,
                    totalFrames,
                });
            }

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

        onProgress?.({ phase: 'muxing', percent: 0, framesProcessed, totalFrames });

        let blob = await this.muxMp4(
            demuxed,
            encodedChunks,
            encoderDecoderConfig,
            encodeMeta,
        );

        if (this.options.useFfmpegMux) {
            onProgress?.({ phase: 'muxing', percent: 0, framesProcessed, totalFrames });
            try {
                blob = await this.remuxWithFfmpeg(blob);
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

        // Second attempt: remux through FFmpeg (strips problematic metadata)
        try {
            onProgress?.({ phase: 'demuxing', percent: 0, framesProcessed: 0, totalFrames: 0 });
            const remuxed = await this.remuxInputWithFfmpeg(file);
            return await this.demuxSamples(remuxed);
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
                videoSamples.push({
                    data: packet.data.slice().buffer,
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
                    audioSamples.push({
                        data: packet.data.slice().buffer,
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
        description: BufferSource | undefined,
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

    private async isVideoTrackDecodable(codec: string, description?: BufferSource): Promise<boolean> {
        try {
            const config: VideoDecoderConfig = { codec };
            if (description) config.description = description;

            const support = await VideoDecoder.isConfigSupported(config);
            return support.supported;
        } catch {
            return false;
        }
    }

    private async createEncoder(
        meta: VideoMeta,
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
            const baseConfig: VideoEncoderConfig = {
                codec: codecCandidates[0] ?? 'avc1.640028',
                width: targetMeta.width,
                height: targetMeta.height,
                bitrate: this.estimateBitrate(targetMeta),
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

        const codecCandidates = this.getAvcCodecCandidates(meta);
        let supportedConfig = await configureWithCandidates(codecCandidates, encodeMeta);

        if (!supportedConfig) {
            const fallbackMeta = this.scaleToMaxArea(meta, 2_097_152);
            encodeMeta = fallbackMeta;
            supportedConfig = await configureWithCandidates(['avc1.640028'], encodeMeta);
        }

        if (!supportedConfig) {
            throw new ProcessingError('Unable to find a supported codec configuration for this resolution. Try reducing the video size.');
        }

        encoder.configure(supportedConfig);
        return { encoder, encodeMeta };
    }

    private getAvcCodecCandidates(meta: VideoMeta): string[] {
        const pixels = meta.width * meta.height;
        if (pixels > 4096 * 2304) {
            return ['avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.64002A', 'avc1.640029', 'avc1.640028'];
        }
        if (pixels > 1920 * 1080) {
            return ['avc1.640033', 'avc1.640032', 'avc1.64002A', 'avc1.640029', 'avc1.640028'];
        }
        return ['avc1.640029', 'avc1.640028'];
    }

    private scaleToMaxArea(meta: VideoMeta, maxArea: number): VideoMeta {
        const area = meta.width * meta.height;
        if (area <= maxArea) return { ...meta };

        const scale = Math.sqrt(maxArea / area);
        const width = Math.max(2, Math.floor(meta.width * scale));
        const height = Math.max(2, Math.floor(meta.height * scale));

        return { ...meta, width, height };
    }

    private async muxMp4(
        demuxed: DemuxedMedia,
        encodedChunks: { chunk: EncodedVideoChunk; duration: number }[],
        decoderConfig: VideoDecoderConfig | undefined,
        meta: VideoMeta,
    ): Promise<Blob> {
        const toMediabunnyVideoCodec = (codec: string): string => {
            const normalized = codec.toLowerCase();
            if (normalized.startsWith('avc1') || normalized.startsWith('avc3')) return 'avc';
            if (normalized.startsWith('hvc1') || normalized.startsWith('hev1')) return 'hevc';
            if (normalized.startsWith('vp09')) return 'vp9';
            if (normalized.startsWith('vp08')) return 'vp8';
            if (normalized.startsWith('av01')) return 'av1';
            return 'avc';
        };

        const toMediabunnyAudioCodec = (codec: string): string => {
            const normalized = codec.toLowerCase();
            if (normalized.startsWith('mp4a')) return 'aac';
            if (normalized.startsWith('opus')) return 'opus';
            if (normalized.startsWith('mp3')) return 'mp3';
            if (normalized.startsWith('flac')) return 'flac';
            return 'aac';
        };

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

            let firstVideoPacket = true;
            for (const { chunk } of encodedChunks) {
                const packet = EncodedPacket.fromEncodedChunk(chunk);
                if (firstVideoPacket) {
                    await videoSource.add(packet, {
                        decoderConfig: decoderConfig,
                    });
                    firstVideoPacket = false;
                } else {
                    await videoSource.add(packet);
                }
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
                }
            }

            await output.finalize();

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

    private async remuxWithFfmpeg(inputBlob: Blob): Promise<Blob> {
        const ffmpeg = new FFmpeg();
        const logBuffer: string[] = [];

        ffmpeg.on('log', ({ message }) => {
            console.debug('[ffmpeg remux log]', message);
            logBuffer.push(message);
            if (logBuffer.length > 50) logBuffer.shift();
        });

        ffmpeg.on('progress', ({ progress, time }) => {
            console.debug('[ffmpeg remux progress]', { progress, time });
        });

        const coreCandidates = [
            'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
            'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
        ];

        try {
            console.info('[ffmpeg remux] loading core (with retries)');
            const loadError = await this.loadFfmpegCore(ffmpeg, coreCandidates, logBuffer);
            if (loadError) throw loadError;
            console.info('[ffmpeg remux] core loaded');

            const inputData = new Uint8Array(await inputBlob.arrayBuffer());
            await ffmpeg.writeFile('input.mp4', inputData);
            console.info('[ffmpeg remux] input written');

            // -map_metadata -1 strips metadata and rewrites container atoms.
            await ffmpeg.exec(['-i', 'input.mp4', '-c', 'copy', '-map_metadata', '-1', 'output.mp4']);
            console.info('[ffmpeg remux] remux succeeded');

            const output = await ffmpeg.readFile('output.mp4');
            const outputData = output instanceof Uint8Array
                ? output
                : new Uint8Array(output as unknown as ArrayBuffer);
            const outputBuffer = outputData.slice().buffer;
            return new Blob([outputBuffer], { type: 'video/mp4' });
        } catch (error) {
            console.error('[ffmpeg remux] failed', error);
            if (logBuffer.length) console.error('[ffmpeg remux logs]', logBuffer.join('\n'));
            throw error;
        }
    }

    private async remuxInputWithFfmpeg(file: File): Promise<File> {
        const remuxedBlob = await this.remuxWithFfmpeg(file);
        const fileName = file.name.replace(/\.[^/.]+$/, '') + '.mp4';
        return new File([remuxedBlob], fileName, { type: 'video/mp4' });
    }

    private async transcodeWithForcedKeyframes(
        file: File,
        meta: VideoMeta,
        onProgress?: (progress: ProcessingProgress) => void,
    ): Promise<File> {
        const ffmpeg = new FFmpeg();
        const logBuffer: string[] = [];
        const attemptLogs: string[] = [];

        ffmpeg.on('log', ({ message }) => {
            // make FFmpeg internals visible in DevTools for debugging
            console.debug('[ffmpeg transcode log]', message);
            logBuffer.push(message);
            if (logBuffer.length > 50) {
                logBuffer.shift();
            }
        });

        ffmpeg.on('progress', ({ progress, time }) => {
            const percent = Number.isFinite(progress) ? Math.round(progress * 100) : 0;
            const remaining = Number.isFinite(time) && meta.duration > 0
                ? Math.max(0, meta.duration - time)
                : undefined;
            console.debug('[ffmpeg transcode progress]', { percent, time, remaining });
            onProgress?.({
                phase: 'encoding',
                percent,
                framesProcessed: 0,
                totalFrames: 0,
                estimatedRemainingSeconds: remaining,
            });
        });

        try {
            const gopSize = Math.max(1, Math.round(meta.fps));
            const forceKeyframesExpr = 'expr:gte(t,n_forced*1)';
            const x264Params = `keyint=${gopSize}:min-keyint=${gopSize}:scenecut=0:open-gop=0`;
            const speedPreset = 'ultrafast';
            const speedCrf = '23';

            const coreCandidates = [
                'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
                'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
            ];

            console.info('[ffmpeg transcode] loading core (with retries)');
            const loadError = await this.loadFfmpegCore(ffmpeg, coreCandidates, logBuffer);
            if (loadError) throw loadError;
            console.info('[ffmpeg transcode] core loaded');

            const inputData = new Uint8Array(await file.arrayBuffer());
            await ffmpeg.writeFile('input.mp4', inputData);
            console.info('[ffmpeg transcode] input written');

            const runTranscode = async (args: string[], label: string): Promise<void> => {
                logBuffer.length = 0;
                try {
                    console.info(`[ffmpeg transcode] running ${label} ${args.join(' ')}`);
                    await ffmpeg.exec(args);
                    console.info(`[ffmpeg transcode] ${label} succeeded`);
                } catch (error) {
                    if (logBuffer.length > 0) {
                        attemptLogs.push(`[${label}]\n${logBuffer.join('\n')}`);
                    }
                    console.warn(`[ffmpeg transcode] ${label} failed`);
                    throw error;
                }
            };

            try {
                console.info('[ffmpeg transcode] attempt audio-copy (fast repair)');
                await runTranscode([
                    '-i', 'input.mp4',
                    '-c:v', 'libx264',
                    '-preset', speedPreset,
                    '-crf', speedCrf,
                    '-tune', 'zerolatency',
                    '-pix_fmt', 'yuv420p',
                    '-g', `${gopSize}`,
                    '-keyint_min', `${gopSize}`,
                    '-sc_threshold', '0',
                    '-bf', '0',
                    '-refs', '1',
                    '-x264-params', x264Params,
                    '-force_key_frames', forceKeyframesExpr,
                    '-movflags', '+faststart',
                    '-c:a', 'copy',
                    'output.mp4',
                ], 'audio-copy');
            } catch (firstError) {
                console.warn('[ffmpeg transcode] audio-copy failed, retrying with audio re-encode', firstError);
                try {
                    console.info('[ffmpeg transcode] attempt audio-aac (fast repair)');
                    await runTranscode([
                        '-i', 'input.mp4',
                        '-c:v', 'libx264',
                        '-preset', speedPreset,
                        '-crf', speedCrf,
                        '-tune', 'zerolatency',
                        '-pix_fmt', 'yuv420p',
                        '-g', `${gopSize}`,
                        '-keyint_min', `${gopSize}`,
                        '-sc_threshold', '0',
                        '-bf', '0',
                        '-refs', '1',
                        '-x264-params', x264Params,
                        '-force_key_frames', forceKeyframesExpr,
                        '-movflags', '+faststart',
                        '-c:a', 'aac',
                        '-b:a', '256k',
                        'output.mp4',
                    ], 'audio-aac');
                } catch (secondError) {
                    console.error('[ffmpeg transcode] both attempts failed', { firstError, secondError, attemptLogs });
                    throw secondError;
                }
            }

            const output = await ffmpeg.readFile('output.mp4');
            const outputData = output instanceof Uint8Array
                ? output
                : new Uint8Array(output as unknown as ArrayBuffer);
            const outputBuffer = outputData.slice().buffer;
            const fileName = file.name.replace(/\.[^/.]+$/, '') + '.keyframes.mp4';
            return new File([outputBuffer], fileName, { type: 'video/mp4' });
        } catch (error) {
            const details = attemptLogs.length > 0
                ? attemptLogs.join('\n\n')
                : (logBuffer.length > 0 ? logBuffer.join('\n') : (error instanceof Error ? error.message : undefined));
            const message = error instanceof Error
                ? error.message
                : 'FFmpeg failed to transcode the video.';

            // Debug output for developers: print logs and attempts to DevTools
            console.error('[ffmpeg transcode] failed', { message, details, attemptLogs, error });
            if (details) console.error('[ffmpeg transcode logs]\n' + details);

            throw new ProcessingError(`FFmpeg transcode failed: ${message}`, details ? { details } : undefined);
        }
    }

    private estimateBitrate(meta: VideoMeta): number {
        const pixels = meta.width * meta.height;
        if (pixels >= 3840 * 2160) return 35_000_000; // 4K: 35 Mbps
        if (pixels >= 1920 * 1080) return 15_000_000; // 1080p: 15 Mbps
        if (pixels >= 1280 * 720) return 8_000_000;   // 720p: 8 Mbps
        return 5_000_000;                              // Default: 5 Mbps
    }

    /**
     * Try loading ffmpeg core from multiple CDN candidates. Returns an Error if
     * loading fails for all candidates (with collected diagnostics), otherwise
     * returns undefined.
     */
    private async loadFfmpegCore(
        ffmpeg: FFmpeg,
        candidates: string[],
        logBuffer: string[],
    ): Promise<Error | undefined> {
        const attemptErrors: string[] = [];

        // Prefer a local same-origin fallback first (serving from public/vendor/ffmpeg)
        const augmentedCandidates = ['/vendor/ffmpeg', ...candidates];

        for (const baseURL of augmentedCandidates) {
            let candidateDiagnostics: string[] = [];
            try {
                console.info(`[ffmpeg core] trying ${baseURL}`);

                // Probe urls first to expose network/CORS errors in DevTools and collect diagnostics

                try {
                    const probeResp = await fetch(`${baseURL}/ffmpeg-core.js`, { method: 'GET', mode: 'cors' });
                    candidateDiagnostics.push(`ffmpeg-core.js -> ${probeResp.status} ${probeResp.statusText}`);
                    candidateDiagnostics.push(`content-type: ${probeResp.headers.get('content-type')}`);
                    candidateDiagnostics.push(`access-control-allow-origin: ${probeResp.headers.get('access-control-allow-origin')}`);

                    // Try to read a small snippet of the JS to detect obvious issues
                    try {
                        const text = await probeResp.text();
                        candidateDiagnostics.push(`snippet: ${text.slice(0, 1024).replace(/\s+/g, ' ').slice(0, 512)}`);

                        // As a separate dynamic-import test, create a blob URL and attempt to import it directly to capture import-time errors
                        try {
                            const blob = new Blob([text], { type: 'text/javascript' });
                            const blobUrl = URL.createObjectURL(blob);
                            try {
                                // eslint-disable-next-line no-await-in-loop
                                await import(/* webpackIgnore: true */ blobUrl);
                                candidateDiagnostics.push('dynamic import(blob) succeeded');
                                URL.revokeObjectURL(blobUrl);
                            } catch (importErr) {
                                candidateDiagnostics.push(`dynamic import(blob) failed: ${importErr instanceof Error ? importErr.message : String(importErr)}`);
                                URL.revokeObjectURL(blobUrl);
                            }
                        } catch (blobErr) {
                            candidateDiagnostics.push(`blob import check failed: ${blobErr instanceof Error ? blobErr.message : String(blobErr)}`);
                        }
                    } catch (textErr) {
                        candidateDiagnostics.push(`reading js text failed: ${textErr instanceof Error ? textErr.message : String(textErr)}`);
                    }
                } catch (probeErr) {
                    candidateDiagnostics.push(`probe failed: ${probeErr instanceof Error ? probeErr.message : String(probeErr)}`);
                }

                try {
                    const wasmProbe = await fetch(`${baseURL}/ffmpeg-core.wasm`, { method: 'GET', mode: 'cors' });
                    candidateDiagnostics.push(`ffmpeg-core.wasm -> ${wasmProbe.status} ${wasmProbe.statusText}`);
                    candidateDiagnostics.push(`wasm content-type: ${wasmProbe.headers.get('content-type')}`);
                    candidateDiagnostics.push(`wasm access-control-allow-origin: ${wasmProbe.headers.get('access-control-allow-origin')}`);
                } catch (probeErr) {
                    candidateDiagnostics.push(`wasm probe failed: ${probeErr instanceof Error ? probeErr.message : String(probeErr)}`);
                }

                const directCoreUrl = `${baseURL}/ffmpeg-core.js`;
                const directWasmUrl = `${baseURL}/ffmpeg-core.wasm`;

                // First, try direct URLs for remote CDNs only (Vite dev server rejects /public module imports)
                if (baseURL.startsWith('http')) {
                    try {
                        await ffmpeg.load({ coreURL: directCoreUrl, wasmURL: directWasmUrl });
                        console.info(`[ffmpeg core] loaded from ${baseURL} (direct URLs)`);
                        if (candidateDiagnostics.length) console.debug(`[ffmpeg core diagnostics] ${baseURL}\n` + candidateDiagnostics.join('\n'));
                        return undefined;
                    } catch (directErr) {
                        candidateDiagnostics.push(`direct load failed: ${directErr instanceof Error ? directErr.message : String(directErr)}`);
                    }
                }

                // If direct load fails, fallback to toBlobURL and try again
                const coreUrl = await toBlobURL(directCoreUrl, 'text/javascript');
                const wasmUrl = await toBlobURL(directWasmUrl, 'application/wasm');

                // Attempt to load into ffmpeg; this is the step that often throws "failed to import ffmpeg-core.js"
                await ffmpeg.load({ coreURL: coreUrl, wasmURL: wasmUrl });

                console.info(`[ffmpeg core] loaded from ${baseURL} (blob URLs)`);
                if (candidateDiagnostics.length) console.debug(`[ffmpeg core diagnostics] ${baseURL}\n` + candidateDiagnostics.join('\n'));
                return undefined;
            } catch (err) {
                console.warn(`[ffmpeg core] failed to load from ${baseURL}`);
                // If we collected per-candidate diagnostics, include them in logs for visibility
                if (candidateDiagnostics && candidateDiagnostics.length) {
                    console.warn(`[ffmpeg core diagnostics] ${baseURL}\n` + candidateDiagnostics.join('\n'));
                    attemptErrors.push(`[${baseURL}] diagnostics:\n${candidateDiagnostics.join('\n')}`);
                }
                if (logBuffer.length) attemptErrors.push(`[${baseURL}] logs:\n${logBuffer.join('\n')}`);
                attemptErrors.push(`[${baseURL}] error: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        return new Error('Failed to load ffmpeg core from all candidates: ' + attemptErrors.join('\n---\n'));
    }

    private createKeyframeDetector(
        codec: string,
        description?: BufferSource,
    ): (sample: Mp4Sample) => boolean {
        const codecLower = codec.toLowerCase();
        const isH264 = codecLower.startsWith('avc1') || codecLower.startsWith('avc3');
        const isH265 = codecLower.startsWith('hvc1') || codecLower.startsWith('hev1');
        const nalLengthSize = this.getNalLengthSize(codecLower, description);
        let detectedNalLengthSize: number | undefined = nalLengthSize;

        return (sample: Mp4Sample): boolean => {
            if (sample.is_rap) return true;
            const data = new Uint8Array(sample.data);
            if (data.length < 5) return false;

            if (!detectedNalLengthSize) {
                detectedNalLengthSize = this.detectNalLengthSizeFromSample(data);
            }

            if (detectedNalLengthSize) {
                return this.containsKeyframeNal(data, detectedNalLengthSize, isH264, isH265);
            }

            return this.containsAnnexBKeyframe(data, isH264, isH265);
        };
    }

    private getNalLengthSize(codecLower: string, description?: BufferSource): number | undefined {
        if (!description) return undefined;
        const buffer = this.normalizeToArrayBuffer(description);
        const view = new DataView(buffer);

        if ((codecLower.startsWith('avc1') || codecLower.startsWith('avc3')) && view.byteLength >= 5) {
            const lengthSizeMinusOne = view.getUint8(4) & 0x03;
            return lengthSizeMinusOne + 1;
        }

        if ((codecLower.startsWith('hvc1') || codecLower.startsWith('hev1')) && view.byteLength >= 22) {
            const lengthSizeMinusOne = view.getUint8(21) & 0x03;
            return lengthSizeMinusOne + 1;
        }

        return undefined;
    }

    private normalizeToArrayBuffer(source: BufferSource): ArrayBuffer {
        if (source instanceof ArrayBuffer) {
            return source;
        }

        if (ArrayBuffer.isView(source)) {
            return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
        }

        return source as ArrayBuffer;
    }

    private detectNalLengthSizeFromSample(data: Uint8Array): number | undefined {
        if (data.length < 5) return undefined;
        const candidateSizes = [4, 3, 2, 1];

        for (const size of candidateSizes) {
            if (data.length <= size) continue;
            let nalSize = 0;
            for (let i = 0; i < size; i += 1) {
                const byte = data[i];
                if (byte === undefined) return undefined;
                nalSize = (nalSize << 8) | byte;
            }

            if (nalSize <= 0 || size + nalSize > data.length) continue;

            const nextOffset = size + nalSize;
            if (nextOffset + size <= data.length) {
                let nextSize = 0;
                for (let i = 0; i < size; i += 1) {
                    const byte = data[nextOffset + i];
                    if (byte === undefined) return size;
                    nextSize = (nextSize << 8) | byte;
                }
                if (nextSize > 0 && nextOffset + size + nextSize <= data.length) {
                    return size;
                }
            } else {
                return size;
            }
        }

        return undefined;
    }

    private containsKeyframeNal(
        data: Uint8Array,
        nalLengthSize: number,
        isH264: boolean,
        isH265: boolean,
    ): boolean {
        let offset = 0;
        while (offset + nalLengthSize <= data.length) {
            let nalSize = 0;
            for (let i = 0; i < nalLengthSize; i += 1) {
                const byte = data[offset + i];
                if (byte === undefined) return false;
                nalSize = (nalSize << 8) | byte;
            }
            offset += nalLengthSize;
            if (nalSize <= 0 || offset + nalSize > data.length) break;

            const nalHeader = data[offset];
            if (nalHeader !== undefined && this.isNalKeyframe(nalHeader, isH264, isH265)) return true;

            offset += nalSize;
        }
        return false;
    }

    private containsAnnexBKeyframe(data: Uint8Array, isH264: boolean, isH265: boolean): boolean {
        let i = 0;
        while (i + 3 < data.length) {
            const isStartCode3 = data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01;
            const isStartCode4 = i + 4 < data.length
                && data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01;
            if (isStartCode3 || isStartCode4) {
                const nalHeaderIndex = i + (isStartCode4 ? 4 : 3);
                if (nalHeaderIndex < data.length) {
                    const nalHeader = data[nalHeaderIndex];
                    if (nalHeader !== undefined && this.isNalKeyframe(nalHeader, isH264, isH265)) return true;
                }
                i = nalHeaderIndex;
            } else {
                i += 1;
            }
        }
        return false;
    }

    private isNalKeyframe(nalHeader: number, isH264: boolean, isH265: boolean): boolean {
        if (isH264) {
            const nalType = nalHeader & 0x1f;
            return nalType === 5;
        }
        if (isH265) {
            const nalType = (nalHeader >> 1) & 0x3f;
            // Treat all IRAP types as random access (BLA 16-18, IDR 19-20, CRA 21)
            return nalType >= 16 && nalType <= 21;
        }
        return false;
    }
}
