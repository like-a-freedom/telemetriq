import type { TelemetryFrame, OverlayConfig, ProcessingProgress, VideoMeta } from '../core/types';
import { ProcessingError } from '../core/errors';
import { getTelemetryAtTime } from './telemetry-core';
import { renderOverlay, DEFAULT_OVERLAY_CONFIG } from './overlay-renderer';
import { createSafeMP4BoxFile, appendFileToMp4box } from './mp4box-safe';
import * as MP4Box from 'mp4box';
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

/**
 * Process a video file by decoding each frame, overlaying telemetry data,
 * and encoding back to an MP4 container.
 *
 * Uses MP4Box.js for demux/mux and WebCodecs for decode/encode.
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
                console.warn('[mux] FFmpeg remux failed, using MP4Box output as-is', error);
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
    ): Promise<{
        videoTrack: { id: number; codec: string; description?: ArrayBuffer; timescale: number };
        audioTrack?: { id: number; codec: string; timescale: number; audio?: any; description?: ArrayBuffer };
        videoSamples: Mp4Sample[];
        audioSamples: Mp4Sample[];
    }> {
        // First attempt: direct MP4Box parse (with safe wrapper)
        try {
            const result = await this.demuxSamples(file);
            if (result.videoSamples.length > 0) return result;
            // onReady fired but no samples extracted – treat as failure
            throw new ProcessingError('MP4Box returned zero video samples');
        } catch (firstError) {
            console.warn('[demux] Direct MP4Box parse failed, trying FFmpeg remux', firstError);
        }

        // Second attempt: remux through FFmpeg (strips problematic metadata)
        try {
            onProgress?.({ phase: 'demuxing', percent: 0, framesProcessed: 0, totalFrames: 0 });
            const remuxed = await this.remuxInputWithFfmpeg(file);
            return await this.demuxSamples(remuxed);
        } catch (secondError) {
            throw new ProcessingError(
                'Failed to parse the video file. The file may contain unsupported metadata '
                + '(e.g. DJI ©dji atoms) or be corrupted. Automatic repair did not succeed.',
            );
        }
    }

    private async demuxSamples(file: File): Promise<{
        videoTrack: { id: number; codec: string; description?: ArrayBuffer; timescale: number };
        audioTrack?: { id: number; codec: string; timescale: number; audio?: any; description?: ArrayBuffer };
        videoSamples: Mp4Sample[];
        audioSamples: Mp4Sample[];
    }> {
        return new Promise((resolve, reject) => {
            const mp4boxfile = createSafeMP4BoxFile();
            const videoSamples: Mp4Sample[] = [];
            const audioSamples: Mp4Sample[] = [];
            let videoTrack: any;
            let audioTrack: any;
            let rejected = false;

            const safeReject = (reason: unknown): void => {
                if (!rejected) {
                    rejected = true;
                    reject(reason);
                }
            };

            mp4boxfile.onError = (e: unknown) => safeReject(e);

            mp4boxfile.onReady = (info: any) => {
                videoTrack = info.tracks?.find((t: any) => t.video);
                audioTrack = info.tracks?.find((t: any) => t.audio);

                if (!videoTrack) {
                    safeReject(new ProcessingError('No video track found in the file'));
                    return;
                }

                if (!videoTrack.description) {
                    const extracted = this.extractCodecDescriptionFromMp4box(
                        mp4boxfile,
                        videoTrack.id,
                        videoTrack.codec,
                    );
                    if (extracted) {
                        videoTrack.description = extracted;
                    }
                }

                try {
                    mp4boxfile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1, rapAlignement: false });
                    if (audioTrack) {
                        mp4boxfile.setExtractionOptions(audioTrack.id, null, { nbSamples: 50, rapAlignement: false });
                    }
                    mp4boxfile.start();
                } catch (error) {
                    safeReject(new ProcessingError('Failed to start sample extraction'));
                }
            };

            mp4boxfile.onSamples = (id: number, _user: unknown, samples: Mp4Sample[]) => {
                if (videoTrack && id === videoTrack.id) {
                    videoSamples.push(...samples);
                }
                if (audioTrack && id === audioTrack.id) {
                    audioSamples.push(...samples);
                }
            };

            appendFileToMp4box(mp4boxfile, file, { signal: this.abortController.signal })
                .then(() => {
                    if (rejected) return;

                    try {
                        mp4boxfile.flush();
                    } catch (flushError) {
                        safeReject(new ProcessingError('Failed to finalise MP4 parsing'));
                        return;
                    }

                    if (!videoTrack) {
                        safeReject(new ProcessingError('No video track found after parsing'));
                        return;
                    }

                    resolve({
                        videoTrack: {
                            id: videoTrack.id,
                            codec: videoTrack.codec,
                            description: videoTrack.description,
                            timescale: videoTrack.timescale,
                        },
                        audioTrack: audioTrack
                            ? {
                                id: audioTrack.id,
                                codec: audioTrack.codec,
                                timescale: audioTrack.timescale,
                                audio: audioTrack.audio,
                                description: audioTrack.description,
                            }
                            : undefined,
                        videoSamples,
                        audioSamples,
                    });
                })
                .catch((error) => {
                    if (error instanceof Error && error.message === 'Aborted') return;
                    safeReject(error);
                });
        });
    }

    private createDecoder(
        codec: string,
        description: ArrayBuffer | undefined,
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

    private async isVideoTrackDecodable(codec: string, description?: ArrayBuffer): Promise<boolean> {
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
        demuxed: {
            videoTrack: { id: number; codec: string; description?: ArrayBuffer; timescale: number };
            audioTrack?: { id: number; codec: string; timescale: number; audio?: any; description?: ArrayBuffer };
            audioSamples: Mp4Sample[];
        },
        encodedChunks: { chunk: EncodedVideoChunk; duration: number }[],
        decoderConfig: VideoDecoderConfig | undefined,
        meta: VideoMeta,
    ): Promise<Blob> {
        const toTrackType = (codec: string): string => {
            const normalized = codec.toLowerCase();
            if (normalized.startsWith('avc1') || normalized.startsWith('avc3')) return 'avc1';
            if (normalized.startsWith('hvc1') || normalized.startsWith('hev1')) return 'hvc1';
            if (normalized.startsWith('mp4a')) return 'mp4a';
            if (normalized.startsWith('opus')) return 'Opus';
            if (normalized.startsWith('vp09')) return 'vp09';
            if (normalized.startsWith('av01')) return 'av01';

            const fourcc = normalized.split('.')[0];
            return fourcc || 'avc1';
        };

        const muxWithMode = async (includeAudio: boolean): Promise<Blob> => {
            const mp4boxfile = createSafeMP4BoxFile();

            const videoCodec = decoderConfig?.codec ?? demuxed.videoTrack.codec;
            const videoType = toTrackType(videoCodec);
            const videoConfigRecord = decoderConfig?.description ?? demuxed.videoTrack.description;

            const videoTrackId = mp4boxfile.addTrack({
                type: videoType,
                timescale: 1_000_000,
                width: meta.width,
                height: meta.height,
                codec: videoCodec,
                avcDecoderConfigRecord: videoType === 'avc1' ? videoConfigRecord : undefined,
                hevcDecoderConfigRecord: videoType === 'hvc1' ? videoConfigRecord : undefined,
                description: undefined,
                hdlr: 'vide',
            });

            if (!videoTrackId) {
                throw new ProcessingError(`MP4 mux failed: unsupported video track type ${videoType} (${videoCodec})`);
            }

            let audioTrackId: number | undefined;
            if (includeAudio && demuxed.audioTrack) {
                const audioType = toTrackType(demuxed.audioTrack.codec);
                audioTrackId = mp4boxfile.addTrack({
                    type: audioType,
                    timescale: demuxed.audioTrack.timescale,
                    codec: demuxed.audioTrack.codec,
                    description: demuxed.audioTrack.description,
                    channel_count: demuxed.audioTrack.audio?.channel_count,
                    samplerate: demuxed.audioTrack.audio?.sample_rate,
                    hdlr: 'soun',
                });

                if (!audioTrackId) {
                    console.warn(`[mux] Skipping unsupported audio track type ${audioType} (${demuxed.audioTrack.codec})`);
                }
            }

            for (const { chunk } of encodedChunks) {
                const data = new Uint8Array(chunk.byteLength);
                chunk.copyTo(data);
                mp4boxfile.addSample(videoTrackId, data, {
                    duration: chunk.duration ?? Math.round(1_000_000 / meta.fps),
                    dts: chunk.timestamp ?? 0,
                    cts: chunk.timestamp ?? 0,
                    is_sync: chunk.type === 'key',
                });
            }

            if (audioTrackId && demuxed.audioSamples.length) {
                for (const sample of demuxed.audioSamples) {
                    mp4boxfile.addSample(audioTrackId, new Uint8Array(sample.data), {
                        duration: sample.duration,
                        dts: sample.dts,
                        cts: sample.cts,
                        is_sync: sample.is_rap,
                    });
                }
            }

            const stream = mp4boxfile.getBuffer() as { buffer: ArrayBuffer; getPosition?: () => number };
            const end = typeof stream.getPosition === 'function' ? stream.getPosition() : stream.buffer.byteLength;
            return new Blob([stream.buffer.slice(0, end)], { type: 'video/mp4' });
        };

        try {
            return await muxWithMode(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isStcoError = /stco/i.test(message);
            if (!isStcoError || !demuxed.audioTrack) {
                throw error;
            }

            console.warn('[mux] MP4Box audio mux failed with stco-related error, retrying video-only output', error);
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

            // -map_metadata -1 strips ALL metadata (including non-standard atoms like ©dji)
            // that cause MP4Box.js to crash during parsing.
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
        description?: ArrayBuffer,
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

    private getNalLengthSize(codecLower: string, description?: ArrayBuffer): number | undefined {
        if (!description) return undefined;
        const view = new DataView(description);

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

    private extractCodecDescriptionFromMp4box(
        mp4boxfile: any,
        trackId: number,
        codec: string,
    ): ArrayBuffer | undefined {
        try {
            const moov = mp4boxfile?.moov;
            const traks = moov?.traks;
            if (!traks || !Array.isArray(traks)) return undefined;

            const trak = traks.find((t: any) => t?.tkhd?.track_id === trackId);
            const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
            if (!entry) return undefined;

            const codecLower = codec.toLowerCase();
            const box = codecLower.startsWith('hvc1') || codecLower.startsWith('hev1')
                ? entry.hvcC
                : (codecLower.startsWith('avc1') || codecLower.startsWith('avc3')
                    ? entry.avcC
                    : undefined);

            if (!box || typeof box.write !== 'function') return undefined;

            const DataStreamCtor = (MP4Box as unknown as { DataStream?: any }).DataStream;
            if (!DataStreamCtor) return undefined;

            // Write the full box (header + data) into a DataStream
            const stream = new DataStreamCtor(undefined, 0, 1 /* BIG_ENDIAN */);
            box.write(stream);
            const written: number = stream.getPosition();

            // MP4 box header is 8 bytes (4-byte size + 4-byte fourcc type).
            // WebCodecs expects only the raw DecoderConfigurationRecord
            // (AVCDecoderConfigurationRecord / HEVCDecoderConfigurationRecord)
            // without the box header.
            const BOX_HEADER_SIZE = 8;
            if (written <= BOX_HEADER_SIZE) return undefined;

            const buffer: ArrayBuffer = stream.buffer;
            return buffer.slice(BOX_HEADER_SIZE, written);
        } catch (error) {
            console.warn('[mp4box] Failed to extract codec description', error);
            return undefined;
        }
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
