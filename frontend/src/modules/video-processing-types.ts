/**
 * Type definitions for video processing pipeline components.
 */

export type Mp4Sample = {
    data: ArrayBuffer;
    duration: number;
    dts: number;
    cts: number;
    timescale: number;
    is_rap: boolean;
};

export type DemuxedMedia = {
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

export type StreamingMuxSession = {
    enqueueVideoChunk: (chunk: EncodedVideoChunk, decoderConfig?: VideoDecoderConfig) => void;
    flushVideoQueue: () => Promise<void>;
    finalize: (
        audioSamples: Mp4Sample[],
        audioDecoderConfig?: AudioDecoderConfig,
        onProgress?: (percent: number) => void,
    ) => Promise<Blob>;
};

export type VideoEncodeMeta = {
    width: number;
    height: number;
};

export interface CodecQueues {
    decoder: VideoDecoder;
    encoder: VideoEncoder;
}

export const CODEC_QUEUE_HIGH_WATERMARK = 24;

export function isCodecQueuePressureHigh(decoder: VideoDecoder, encoder: VideoEncoder): boolean {
    return decoder.decodeQueueSize > CODEC_QUEUE_HIGH_WATERMARK
        || encoder.encodeQueueSize > CODEC_QUEUE_HIGH_WATERMARK;
}

export async function waitForCodecQueues(
    decoder: VideoDecoder,
    encoder: VideoEncoder,
    signal: AbortSignal,
): Promise<void> {
    let spin = 0;
    while (!signal.aborted && isCodecQueuePressureHigh(decoder, encoder)) {
        if (spin % 2 === 0) {
            await Promise.resolve();
        } else {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        spin += 1;
    }
}
