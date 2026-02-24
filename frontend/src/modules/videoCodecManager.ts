import type { VideoMeta } from '../core/types';
import { ProcessingError } from '../core/errors';
import {
    getCodecCandidates,
    estimateTargetBitrate,
    scaleToMaxArea,
} from './codecUtils';

export interface VideoCodecManager {
    createDecoder(
        codec: string,
        description: AllowSharedBufferSource | undefined,
        onFrame: (frame: VideoFrame) => void,
        onError: (message: string) => void,
    ): VideoDecoder;

    isVideoTrackDecodable(codec: string, description?: AllowSharedBufferSource): Promise<boolean>;

    createEncoder(
        meta: VideoMeta,
        sourceCodec: string,
        onChunk: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void,
        onError: (message: string) => void,
    ): Promise<{ encoder: VideoEncoder; encodeMeta: VideoMeta }>;
}

export function createVideoCodecManager(): VideoCodecManager {
    return {
        createDecoder(
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
        },

        async isVideoTrackDecodable(
            codec: string,
            description?: AllowSharedBufferSource,
        ): Promise<boolean> {
            try {
                const config: VideoDecoderConfig = { codec };
                if (description) config.description = description;

                const support = await VideoDecoder.isConfigSupported(config);
                return support.supported === true;
            } catch {
                return false;
            }
        },

        async createEncoder(
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
                const targetBitrate = estimateTargetBitrate(meta, targetMeta, 0);
                const buildVariantConfigs = (codec: string): VideoEncoderConfig[] => {
                    const common: Omit<VideoEncoderConfig, 'codec'> = {
                        width: targetMeta.width,
                        height: targetMeta.height,
                        bitrate: targetBitrate,
                        framerate: targetMeta.fps,
                    };

                    return [
                        {
                            ...common,
                            codec,
                            hardwareAcceleration: 'prefer-hardware',
                        },
                        {
                            ...common,
                            codec,
                            hardwareAcceleration: 'no-preference',
                        },
                        {
                            ...common,
                            codec,
                            hardwareAcceleration: 'prefer-software',
                        },
                    ];
                };

                for (const codec of codecCandidates) {
                    const variants = buildVariantConfigs(codec);
                    for (const candidate of variants) {
                        const support = await VideoEncoder.isConfigSupported(candidate);
                        if (support.supported) {
                            return candidate;
                        }
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
        },
    };
}
