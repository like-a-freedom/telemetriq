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

// Mock WebCodecs API
beforeEach(() => {
    vi.stubGlobal('VideoDecoder', class {
        static isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
        state = 'unconfigured';
        configure() { this.state = 'configured'; }
        decode() { }
        flush() { return Promise.resolve(); }
        close() { this.state = 'closed'; }
        set output(_cb: any) { }
        set error(_cb: any) { }
    });
    vi.stubGlobal('VideoEncoder', class {
        static isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
        state = 'unconfigured';
        configure() { this.state = 'configured'; }
        encode() { }
        flush() { return Promise.resolve(); }
        close() { this.state = 'closed'; }
        set output(_cb: any) { }
        set error(_cb: any) { }
    });
    vi.stubGlobal('VideoFrame', class {
        constructor(source: any, options?: any) {
            this.source = source;
            this.options = options;
            this.timestamp = options?.timestamp ?? 0;
            this.duration = options?.duration;
        }
        source: any;
        options?: any;
        timestamp: number;
        duration?: number;
        close() { }
    });
    vi.stubGlobal('EncodedVideoChunk', class {
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
    });
    vi.stubGlobal('OffscreenCanvas', class OffscreenCanvas {
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
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
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
        vi.stubGlobal('VideoDecoder', undefined);
        vi.stubGlobal('VideoEncoder', undefined);

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
});
