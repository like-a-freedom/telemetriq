import type { DemuxedMedia, Mp4Sample } from './videoProcessingTypes';
import { ProcessingError } from '../core/errors';
import {
    ALL_FORMATS,
    BlobSource,
    EncodedPacketSink,
    Input,
} from 'mediabunny';
import { remuxWithFfmpeg } from './ffmpegUtils';
import type { ProcessingProgress } from '../core/types';

/** FFmpeg.wasm fallback reads the whole file into memory. */
const FFMPEG_FALLBACK_MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB

export interface Demuxer {
    demux(file: File): Promise<DemuxedMedia>;
    demuxWithFallback(file: File, onProgress?: (progress: ProcessingProgress) => void): Promise<DemuxedMedia>;
}

export function createDemuxer(): Demuxer {
    return {
        async demux(file: File): Promise<DemuxedMedia> {
            return withSuppressedUnsupportedAudioCodecWarnings(async () => {
                const input = new Input({
                    formats: ALL_FORMATS,
                    source: new BlobSource(file),
                });

                try {
                    const videoTrack = await input.getPrimaryVideoTrack();
                    const audioTrack = await readPrimaryAudioTrack(input);

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
                        videoDecoderConfig = undefined;
                    }
                    const videoCodecName = String(videoTrack.codec ?? '').toLowerCase();
                    const rotation = normalizeRotation(videoTrack.rotation);

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
                            rotation,
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
            });
        },

        async demuxWithFallback(
            file: File,
            onProgress?: (progress: ProcessingProgress) => void,
        ): Promise<DemuxedMedia> {
            try {
                const result = await this.demux(file);
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

            try {
                onProgress?.({ phase: 'demuxing', percent: 0, framesProcessed: 0, totalFrames: 0 });
                const remuxedBlob = await remuxWithFfmpeg(file);
                const fileName = file.name.replace(/\.[^/.]+$/, '') + '.mp4';
                const remuxedFile = new File([remuxedBlob], fileName, { type: 'video/mp4' });
                return await this.demux(remuxedFile);
            } catch (secondError) {
                throw new ProcessingError(
                    'Failed to parse the video file. The file may contain unsupported metadata '
                    + 'or be corrupted. Automatic repair did not succeed.',
                );
            }
        },
    };
}

async function readPrimaryAudioTrack(
    input: Input,
): Promise<Awaited<ReturnType<Input['getPrimaryAudioTrack']>> | undefined> {
    try {
        return await input.getPrimaryAudioTrack();
    } catch (error) {
        if (!isUnsupportedAudioCodecError(error)) {
            console.warn('[demux] Primary audio track is unsupported and will be skipped');
        }
        return undefined;
    }
}

function normalizeRotation(value: unknown): 0 | 90 | 180 | 270 {
    if (value === 90 || value === 180 || value === 270) return value;
    return 0;
}

function isUnsupportedAudioCodecError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /Unsupported audio codec/i.test(message);
}

async function withSuppressedUnsupportedAudioCodecWarnings<T>(
    operation: () => Promise<T>,
): Promise<T> {
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
        const text = args
            .map((arg) => (typeof arg === 'string' ? arg : String(arg ?? '')))
            .join(' ');

        if (/Unsupported audio codec/i.test(text)) {
            return;
        }

        originalWarn(...args);
    };

    try {
        return await operation();
    } finally {
        console.warn = originalWarn;
    }
}

function toTightArrayBuffer(data: Uint8Array): ArrayBuffer {
    if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
        return data.buffer as ArrayBuffer;
    }

    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
