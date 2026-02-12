/**
 * Unit tests for VideoProcessor class.
 * Tests basic instantiation, options validation, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoProcessor } from '../modules/video-processor';
import { ProcessingError } from '../core/errors';
import type { VideoMeta } from '../core/types';

vi.mock('../modules/ffmpeg-utils', () => ({
    remuxWithFfmpeg: vi.fn().mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' })),
    transcodeWithForcedKeyframes: vi.fn().mockResolvedValue(new File([new Uint8Array([1])], 'transcoded.mp4', { type: 'video/mp4' })),
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
        }
        source: any;
        options?: any;
        close() { }
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

    it('isVideoTrackDecodable should return false when capability check throws', async () => {
        vi.stubGlobal('VideoDecoder', class {
            static isConfigSupported = vi.fn().mockRejectedValue(new Error('unsupported runtime'));
        });

        const processor = new VideoProcessor({
            videoFile: new File([], 'test.mp4'),
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        const decodable = await (processor as any).isVideoTrackDecodable('avc1.640028');
        expect(decodable).toBe(false);
    });

    it('demuxSamplesWithFallback should retry after first demux failure', async () => {
        const processor = new VideoProcessor({
            videoFile: new File([], 'test.mp4'),
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        const demuxSpy = vi.spyOn(processor as any, 'demuxSamples')
            .mockRejectedValueOnce(new Error('first parse failed'))
            .mockResolvedValueOnce({
                videoTrack: { id: 1, codec: 'avc1.640028', codecName: 'avc1', timescale: 1_000_000 },
                videoSamples: [{
                    data: new ArrayBuffer(1),
                    duration: 1,
                    dts: 0,
                    cts: 0,
                    timescale: 1_000_000,
                    is_rap: true,
                }],
                audioSamples: [],
            });

        const result = await (processor as any).demuxSamplesWithFallback(new File([], 'test.mp4'));

        expect(demuxSpy).toHaveBeenCalledTimes(2);
        expect(result.videoSamples.length).toBe(1);
    });

    it('demuxSamplesWithFallback should throw ProcessingError when fallback also fails', async () => {
        const processor = new VideoProcessor({
            videoFile: new File([], 'test.mp4'),
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        vi.spyOn(processor as any, 'demuxSamples').mockRejectedValue(new Error('still failing'));

        await expect((processor as any).demuxSamplesWithFallback(new File([], 'test.mp4')))
            .rejects.toBeInstanceOf(ProcessingError);
    });

    it('createEncoder should throw when no codec configuration is supported', async () => {
        vi.stubGlobal('VideoEncoder', class {
            static isConfigSupported = vi.fn().mockResolvedValue({ supported: false });
            state = 'unconfigured';
            configure() {
                this.state = 'configured';
            }
            set output(_cb: any) { }
            set error(_cb: any) { }
        });

        const processor = new VideoProcessor({
            videoFile: new File([], 'test.mp4'),
            videoMeta: createMockVideoMeta(),
            telemetryFrames: [],
            syncOffsetSeconds: 0,
        });

        await expect((processor as any).createEncoder(
            createMockVideoMeta(),
            'avc1.640028',
            vi.fn(),
            vi.fn(),
        )).rejects.toBeInstanceOf(ProcessingError);
    });
});
