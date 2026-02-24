import type { DemuxedMedia, Mp4Sample, StreamingMuxSession } from './videoProcessingTypes';
import { ProcessingError } from '../core/errors';
import {
    BufferTarget,
    EncodedAudioPacketSource,
    EncodedPacket,
    EncodedVideoPacketSource,
    Mp4OutputFormat,
    Output,
} from 'mediabunny';
import { toMediabunnyVideoCodec, toMediabunnyAudioCodec } from './codecUtils';
import type { VideoMeta } from '../core/types';

export interface Muxer {
    muxMp4(
        demuxed: DemuxedMedia,
        encodedChunks: EncodedVideoChunk[],
        decoderConfig: VideoDecoderConfig | undefined,
        meta: VideoMeta,
        onMuxProgress?: (percent: number) => void,
    ): Promise<Blob>;

    startStreamingMuxSession(
        demuxed: DemuxedMedia,
        meta: VideoMeta,
        abortSignal: AbortSignal,
    ): StreamingMuxSession;
}

export function createMuxer(): Muxer {
    return {
        async muxMp4(
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
                        const sanitizedTimestamp = sanitizeTimestampUs(sample.cts);
                        const sanitizedDuration = sanitizeDurationUs(sample.duration);
                        const chunk = new EncodedAudioChunk({
                            type: sample.is_rap ? 'key' : 'delta',
                            timestamp: sanitizedTimestamp,
                            duration: sanitizedDuration,
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
        },

        startStreamingMuxSession(
            demuxed: DemuxedMedia,
            meta: VideoMeta,
            abortSignal: AbortSignal,
        ): StreamingMuxSession {
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

            let outputStarted = false;
            let startPromise: Promise<void> | null = null;

            const ensureStarted = async (): Promise<void> => {
                if (outputStarted) return;
                if (startPromise) return startPromise;

                startPromise = output.start().then(() => {
                    outputStarted = true;
                });
                return startPromise;
            };

            let isFirstVideoPacket = true;
            let queue: Promise<void> = Promise.resolve();
            let queueError: unknown;

            const enqueueVideoChunk = (chunk: EncodedVideoChunk, decoderConfig?: VideoDecoderConfig): void => {
                if (queueError) return;

                queue = queue
                    .then(async () => {
                        await ensureStarted();
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
                        if (!abortSignal.aborted) {
                            throw error;
                        }
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
                    await ensureStarted();
                    let firstAudioPacket = true;
                    let doneAudioPackets = 0;
                    for (const sample of audioSamples) {
                        const sanitizedTimestamp = sanitizeTimestampUs(sample.cts);
                        const sanitizedDuration = sanitizeDurationUs(sample.duration);
                        const chunk = new EncodedAudioChunk({
                            type: sample.is_rap ? 'key' : 'delta',
                            timestamp: sanitizedTimestamp,
                            duration: sanitizedDuration,
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
        },
    };
}

function sanitizeTimestampUs(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
}

function sanitizeDurationUs(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.round(value));
}
