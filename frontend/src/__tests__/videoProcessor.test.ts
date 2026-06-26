/**
 * Unit tests for VideoProcessor class.
 * Tests basic instantiation, options validation, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoProcessor } from '../modules/videoProcessor';
import type { VideoMeta } from '../core/types';

vi.mock('../modules/ffmpegUtils', () => ({
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

vi.mock('../modules/videoProcessing/codecManager', () => ({
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
const originalNavigatorUserAgent = globalThis.navigator?.userAgent;
const originalNavigatorMaxTouchPoints = globalThis.navigator?.maxTouchPoints;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

function setNavigatorEnvironment(userAgent: string, maxTouchPoints: number): void {
    if (!globalThis.navigator) return;

    Object.defineProperty(globalThis.navigator, 'userAgent', {
        value: userAgent,
        configurable: true,
    });
    Object.defineProperty(globalThis.navigator, 'maxTouchPoints', {
        value: maxTouchPoints,
        configurable: true,
    });
}

function createMockVideoSamples(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        data: new Uint8Array([1, 2, 3]).buffer,
        duration: 1_000,
        dts: index * 1_000,
        cts: index * 1_000,
        timescale: 1_000_000,
        is_rap: index === 0,
    }));
}

beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

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
    consoleWarnSpy.mockRestore();
    globalThis.VideoDecoder = originalVideoDecoder;
    globalThis.VideoEncoder = originalVideoEncoder;
    globalThis.VideoFrame = originalVideoFrame;
    globalThis.EncodedVideoChunk = originalEncodedVideoChunk;
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
    if (globalThis.navigator) {
        Object.defineProperty(globalThis.navigator, 'userAgent', {
            value: originalNavigatorUserAgent,
            configurable: true,
        });
        Object.defineProperty(globalThis.navigator, 'maxTouchPoints', {
            value: originalNavigatorMaxTouchPoints,
            configurable: true,
        });
    }
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

    it('should reject process after cancel', async () => {
        const file = new File([], 'test.mp4');
        const processor = new VideoProcessor({
            videoFile: file,
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        processor.cancel();
        await expect(processor.process()).rejects.toThrow();
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
        const codecModule = await import('../modules/videoProcessing/codecManager');
        let createDecoderCall = 0;
        vi.mocked(codecModule.createVideoCodecManager).mockImplementation(() => ({
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
        } as any));

        const file = new File([], 'test.mp4');
        const processor = new VideoProcessor({
            videoFile: file,
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        const blob = await processor.process();
        expect(blob).toBeInstanceOf(Blob);

        const ffmpeg = await import('../modules/ffmpegUtils');
        expect(ffmpeg.transcodeWithForcedKeyframes).toHaveBeenCalled();
    });

    it('emits an opt-in processing profile after a successful run', async () => {
        const onProfile = vi.fn();
        const file = new File([], 'test.mp4');
        const processor = new VideoProcessor({
            videoFile: file,
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
            onProfile,
        });

        await processor.process();

        expect(onProfile).toHaveBeenCalledTimes(1);
        expect(onProfile).toHaveBeenCalledWith(expect.objectContaining({
            totalDurationMs: expect.any(Number),
            processedFrames: expect.any(Number),
            phases: expect.objectContaining({
                demuxing: expect.objectContaining({ durationMs: expect.any(Number) }),
                processing: expect.objectContaining({ durationMs: expect.any(Number) }),
                muxing: expect.objectContaining({ durationMs: expect.any(Number) }),
            }),
        }));
    });

    it('uses streaming mux earlier on Apple mobile WebKit for long videos', async () => {
        setNavigatorEnvironment(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
            5,
        );

        const demuxerModule = await import('../modules/demuxer');
        vi.mocked(demuxerModule.createDemuxer).mockImplementationOnce(() => ({
            demux: vi.fn().mockRejectedValue(new Error('Direct demux not available')),
            demuxWithFallback: vi.fn().mockResolvedValue({
                videoTrack: { id: 1, codec: 'avc1.640028', codecName: 'avc1', timescale: 1_000_000 },
                videoSamples: createMockVideoSamples(1_527),
                audioSamples: [],
            }),
        }) as any);

        const startStreamingMuxSession = vi.fn().mockResolvedValue({
            enqueueVideoChunk: vi.fn(),
            flushVideoQueue: vi.fn().mockResolvedValue(undefined),
            finalize: vi.fn().mockResolvedValue(new Blob([new Uint8Array([8])], { type: 'video/mp4' })),
            opfsAvailable: true,
        });

        const muxerModule = await import('../modules/muxer');
        vi.mocked(muxerModule.createMuxer).mockImplementationOnce(() => ({
            muxMp4: vi.fn().mockResolvedValue(new Blob([new Uint8Array([9])], { type: 'video/mp4' })),
            startStreamingMuxSession,
        }) as any);

        const processor = new VideoProcessor({
            videoFile: new File([], 'long-run.mp4', { type: 'video/mp4' }),
            videoMeta: createMockVideoMeta({ duration: 51 }),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        await processor.process();

        expect(startStreamingMuxSession).toHaveBeenCalledTimes(1);
    });

    it('skips FFmpeg remux on Apple mobile WebKit even when it is requested', async () => {
        setNavigatorEnvironment(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
            5,
        );

        const ffmpegModule = await import('../modules/ffmpegUtils');
        const processor = new VideoProcessor({
            videoFile: new File([], 'test.mp4'),
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
            useFfmpegMux: true,
        });

        await processor.process();

        expect(ffmpegModule.remuxWithFfmpeg).not.toHaveBeenCalled();
    });

    it('keeps FFmpeg remux enabled on desktop browsers when requested', async () => {
        setNavigatorEnvironment(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            0,
        );

        const ffmpegModule = await import('../modules/ffmpegUtils');
        const processor = new VideoProcessor({
            videoFile: new File([], 'test.mp4'),
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
            useFfmpegMux: true,
        });

        await processor.process();

        expect(ffmpegModule.remuxWithFfmpeg).toHaveBeenCalledTimes(1);
    });
});
