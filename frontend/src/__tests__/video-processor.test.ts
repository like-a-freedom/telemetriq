/**
 * Unit tests for VideoProcessor class.
 * Tests basic instantiation, options validation, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoProcessor } from '../modules/video-processor';
import type { VideoMeta } from '../core/types';

vi.mock('../modules/ffmpeg-utils', () => ({
    remuxWithFfmpeg: vi.fn().mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' })),
    transcodeWithForcedKeyframes: vi.fn().mockResolvedValue(new File([new Uint8Array([1])], 'transcoded.mp4', { type: 'video/mp4' })),
}));

vi.mock('../modules/demuxer', () => ({
    createDemuxer: vi.fn(() => ({
        demux: vi.fn().mockRejectedValue(new Error('Direct demux not available')),
        demuxWithFallback: vi.fn().mockResolvedValue({
            videoTrack: { id: 1, codec: 'avc1.640028', codecName: 'avc1', timescale: 1_000_000 },
            videoSamples: [{
                data: new Uint8Array([1, 2, 3]).buffer,
                duration: 1_000,
                dts: 0,
                cts: 0,
                timescale: 1_000_000,
                is_rap: true,
            }],
            audioSamples: [],
        }),
    })),
}));

vi.mock('../modules/muxer', () => ({
    createMuxer: vi.fn(() => ({
        muxMp4: vi.fn().mockResolvedValue(new Blob([new Uint8Array([9])], { type: 'video/mp4' })),
        startStreamingMuxSession: vi.fn().mockReturnValue({
            enqueueVideoChunk: vi.fn(),
            flushVideoQueue: vi.fn().mockResolvedValue(undefined),
            finalize: vi.fn().mockResolvedValue(new Blob([new Uint8Array([8])], { type: 'video/mp4' })),
        }),
    })),
}));

vi.mock('../modules/video-codec-manager', () => ({
    createVideoCodecManager: vi.fn(() => ({
        createDecoder: vi.fn().mockReturnValue({
            state: 'configured',
            decode: vi.fn(),
            flush: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
        }),
        isVideoTrackDecodable: vi.fn().mockResolvedValue(true),
        createEncoder: vi.fn().mockResolvedValue({
            encoder: {
                state: 'configured',
                encode: vi.fn(),
                flush: vi.fn().mockResolvedValue(undefined),
                close: vi.fn(),
            },
            encodeMeta: { width: 1920, height: 1080, fps: 30, duration: 10, codec: 'avc1.640028', fileName: 'test.mp4', fileSize: 1000 },
        }),
    })),
}));

const originalVideoDecoder = globalThis.VideoDecoder;
const originalVideoEncoder = globalThis.VideoEncoder;
const originalVideoFrame = globalThis.VideoFrame;
const originalEncodedVideoChunk = globalThis.EncodedVideoChunk;
const originalOffscreenCanvas = globalThis.OffscreenCanvas;

beforeEach(() => {
    (globalThis as any).VideoDecoder = class {
        static isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
        state = 'unconfigured';
        configure() { this.state = 'configured'; }
        decode() { }
        flush() { return Promise.resolve(); }
        close() { this.state = 'closed'; }
        set output(_cb: any) { }
        set error(_cb: any) { }
    };

    (globalThis as any).VideoEncoder = class {
        static isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
        state = 'unconfigured';
        configure() { this.state = 'configured'; }
        encode() { }
        flush() { return Promise.resolve(); }
        close() { this.state = 'closed'; }
        set output(_cb: any) { }
        set error(_cb: any) { }
    };

    (globalThis as any).VideoFrame = class {
        source: any;
        options?: any;
        timestamp: number;
        duration?: number;
        displayWidth = 1920;
        displayHeight = 1080;
        constructor(source: any, options?: any) {
            this.source = source;
            this.options = options;
            this.timestamp = options?.timestamp ?? 0;
            this.duration = options?.duration;
        }
        close() { }
    };

    (globalThis as any).EncodedVideoChunk = class {
        type: 'key' | 'delta';
        timestamp: number;
        duration?: number;
        data: Uint8Array;
        constructor(init: { type: 'key' | 'delta'; timestamp: number; duration?: number; data: Uint8Array }) {
            this.type = init.type;
            this.timestamp = init.timestamp;
            this.duration = init.duration;
            this.data = init.data;
        }
    };

    (globalThis as any).OffscreenCanvas = class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
        }
        getContext() {
            return {
                drawImage: vi.fn(),
                fillRect: vi.fn(),
                clearRect: vi.fn(),
            };
        }
    };
});

afterEach(() => {
    globalThis.VideoDecoder = originalVideoDecoder;
    globalThis.VideoEncoder = originalVideoEncoder;
    globalThis.VideoFrame = originalVideoFrame;
    globalThis.EncodedVideoChunk = originalEncodedVideoChunk;
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
    vi.clearAllMocks();
});

describe('VideoProcessor', () => {
    const createMockVideoMeta = (overrides?: Partial<VideoMeta>): VideoMeta => ({
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 10,
        codec: 'avc1.640028',
        fileName: 'test.mp4',
        fileSize: 1000,
        ...overrides,
    });

    it('should throw if WebCodecs API is not available', async () => {
        (globalThis as any).VideoDecoder = undefined;
        (globalThis as any).VideoEncoder = undefined;

        const processor = new VideoProcessor({
            videoFile: new File([], 'test.mp4'),
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        await expect(processor.process()).rejects.toThrow('WebCodecs API is not available');
    });

    it('should create processor with options', () => {
        const file = new File([], 'test.mp4');
        const meta = createMockVideoMeta();
        const processor = new VideoProcessor({
            videoFile: file,
            videoMeta: meta,
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        expect(processor).toBeInstanceOf(VideoProcessor);
    });

    it('should cancel processing', () => {
        const file = new File([], 'test.mp4');
        const processor = new VideoProcessor({
            videoFile: file,
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        processor.cancel();
        expect((processor as any).abortController.signal.aborted).toBe(true);
    });

    it('should normalize non-finite sync offset to zero', () => {
        const file = new File([], 'test.mp4');
        const processor = new VideoProcessor({
            videoFile: file,
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: NaN,
        });

        expect(processor).toBeInstanceOf(VideoProcessor);
    });

    it('recovers from decoder failure by transcoding and retrying', async () => {
        // make codec manager return a decoder that fails on the first run and succeeds on retry
        const codecModule = await import('../modules/video-codec-manager');
        let createDecoderCall = 0;
        (codecModule.createVideoCodecManager as vi.Mock).mockImplementation(() => ({
            createDecoder: (codec: string, description: any, onFrame: any, onError: any) => {
                createDecoderCall++;
                if (createDecoderCall === 1) {
                    return {
                        state: 'configured',
                        decode: () => onError(new Error('Decoder failure')),
                        flush: () => Promise.resolve(),
                        close: () => { },
                    };
                }

                return {
                    state: 'configured',
                    decode: vi.fn(),
                    flush: () => Promise.resolve(),
                    close: () => { },
                };
            },
            isVideoTrackDecodable: vi.fn().mockResolvedValue(true),
            createEncoder: vi.fn().mockResolvedValue({
                encoder: {
                    state: 'configured',
                    encode: vi.fn(),
                    flush: vi.fn().mockResolvedValue(undefined),
                    close: vi.fn(),
                },
                encodeMeta: { width: 1920, height: 1080, fps: 30, duration: 10, codec: 'avc1.640028', fileName: 'test.mp4', fileSize: 1000 },
            }),
        }));

        const file = new File([], 'test.mp4');
        const processor = new VideoProcessor({
            videoFile: file,
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        const blob = await processor.process();
        expect(blob).toBeInstanceOf(Blob);

        const ffmpeg = await import('../modules/ffmpeg-utils');
        expect(ffmpeg.transcodeWithForcedKeyframes).toHaveBeenCalled();
    });
});
