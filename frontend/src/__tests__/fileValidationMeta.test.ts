/**
 * Unit tests for extractVideoMeta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    extractVideoMeta,
    MAX_VIDEO_DURATION_SECONDS,
    FAST_METADATA_THRESHOLD_BYTES,
} from '../modules/fileValidation';

const mockState: {
    width: number;
    height: number;
    codec: string;
    fps: number;
    duration: number;
    date?: Date | undefined;
    raw: Record<string, any>;
    throwVideoTrackError: boolean;
    throwMetadataError: boolean;
} = {
    width: 1920,
    height: 1080,
    codec: 'avc1.640028',
    fps: 30,
    duration: 120,
    date: new Date('2026-02-11T10:00:00Z'),
    raw: { location: '+55.7558+037.6176/' },
    throwVideoTrackError: false,
    throwMetadataError: false,
};

vi.mock('mediabunny', () => {
    class MockBlobSource {
        file: File;
        constructor(file: File) {
            this.file = file;
        }
    }

    class MockVideoTrack {
        displayWidth: number;
        displayHeight: number;
        codec: string;
        fps: number;
        throwError: boolean;

        constructor(config: { width: number; height: number; codec: string; fps: number; throwError?: boolean }) {
            this.displayWidth = config.width;
            this.displayHeight = config.height;
            this.codec = config.codec;
            this.fps = config.fps;
            this.throwError = config.throwError ?? false;
        }

        async getCodecParameterString() {
            if (this.throwError) throw new Error('unsupported codec');
            return this.codec;
        }
        async getDecoderConfig() {
            if (this.throwError) throw new Error('unsupported codec');
            return { codec: this.codec };
        }
        async computePacketStats(_expectedFps?: number) {
            if (this.throwError) throw new Error('compute packet stats failed');
            return { averagePacketRate: this.fps };
        }
    }

    class MockMetadataTags {
        date: Date | undefined;
        raw: Record<string, any>;
        throwError: boolean;

        constructor(config: { date?: Date; raw: Record<string, any>; throwError?: boolean }) {
            this.date = config.date;
            this.raw = config.raw;
            this.throwError = config.throwError ?? false;
        }

        async getMetadataTags() {
            if (this.throwError) throw new Error('failed to read metadata tags');
            return {
                date: this.date,
                raw: this.raw,
            };
        }
    }

    return {
        __esModule: true,
        ALL_FORMATS: ['mp4'],
        BlobSource: MockBlobSource,
        Input: class MockInput {
            source: any;
            constructor(config: { formats: string[]; source: any }) {
                this.source = config.source;
            }

            async getPrimaryVideoTrack() {
                if (mockState.throwVideoTrackError) {
                    throw new Error('unsupported codec in side stream');
                }
                return new MockVideoTrack({
                    width: mockState.width,
                    height: mockState.height,
                    codec: mockState.codec,
                    fps: mockState.fps,
                    throwError: mockState.throwVideoTrackError,
                });
            }

            async computeDuration() {
                return mockState.duration;
            }

            async getMetadataTags() {
                if (mockState.throwMetadataError) {
                    throw new Error('failed to read metadata tags');
                }
                return new MockMetadataTags({
                    date: mockState.date,
                    raw: mockState.raw,
                    throwError: mockState.throwMetadataError,
                });
            }
        },
    };
});

function createMockVideoElement(params: {
    width: number;
    height: number;
    duration: number;
    trigger: 'loaded' | 'error';
}) {
    const video: any = {
        preload: '',
        videoWidth: params.width,
        videoHeight: params.height,
        duration: params.duration,
        onloadedmetadata: null,
        onerror: null,
    };

    Object.defineProperty(video, 'src', {
        set() {
            queueMicrotask(() => {
                if (params.trigger === 'loaded') {
                    if (typeof video.onloadedmetadata === 'function') {
                        video.onloadedmetadata();
                    }
                } else if (typeof video.onerror === 'function') {
                    video.onerror();
                }
            });
        },
    });

    return video;
}

function createMp4WithMvhdCreationTime(isoTime: string): Uint8Array {
    const date = new Date(isoTime);
    const unixSec = Math.floor(date.getTime() / 1000);
    const mp4Sec = unixSec + 2_082_844_800;

    const boxSize = 32;
    const bytes = new Uint8Array(boxSize);

    bytes[0] = 0;
    bytes[1] = 0;
    bytes[2] = 0;
    bytes[3] = boxSize;

    bytes[4] = 'm'.charCodeAt(0);
    bytes[5] = 'v'.charCodeAt(0);
    bytes[6] = 'h'.charCodeAt(0);
    bytes[7] = 'd'.charCodeAt(0);

    bytes[8] = 0;
    bytes[9] = 0;
    bytes[10] = 0;
    bytes[11] = 0;

    bytes[12] = (mp4Sec >>> 24) & 0xff;
    bytes[13] = (mp4Sec >>> 16) & 0xff;
    bytes[14] = (mp4Sec >>> 8) & 0xff;
    bytes[15] = mp4Sec & 0xff;

    return bytes;
}

describe('extractVideoMeta', () => {
    beforeEach(() => {
        mockState.width = 1920;
        mockState.height = 1080;
        mockState.codec = 'avc1.640028';
        mockState.fps = 30;
        mockState.duration = 120;
        mockState.date = new Date('2026-02-11T10:00:00Z');
        mockState.raw = { location: '+55.7558+037.6176/' };
        mockState.throwVideoTrackError = false;
        mockState.throwMetadataError = false;

        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should extract metadata and merge mp4 details', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);

        expect(meta.width).toBe(1920);
        expect(meta.height).toBe(1080);
        expect(meta.codec).toBe('avc1.640028');
        expect(meta.fps).toBe(30);
        expect(meta.gps).toEqual({ lat: 55.7558, lon: 37.6176 });
    });

    it('should use mp4 dimensions when video element reports zero size', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 0, height: 0, duration: 120, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);

        expect(meta.width).toBe(1920);
        expect(meta.height).toBe(1080);
    });

    it('should reject when metadata loading fails', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'error' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });

        await expect(extractVideoMeta(file)).rejects.toThrow();
    });

    it('should reject when video duration exceeds max limit', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: MAX_VIDEO_DURATION_SECONDS + 1, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });

        await expect(extractVideoMeta(file)).rejects.toThrow(/Video is too long/i);
    });

    it('should reject when both html metadata and mp4 metadata have invalid resolution', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 0, height: 0, duration: 120, trigger: 'loaded' }),
        );

        mockState.width = 0;
        mockState.height = 0;

        const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });

        await expect(extractVideoMeta(file)).rejects.toThrow(/Failed to determine video resolution/i);
    });

    it('should skip deep mp4 parsing for very large files', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1280, height: 720, duration: 30, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
        Object.defineProperty(file, 'size', { value: FAST_METADATA_THRESHOLD_BYTES + 1 });

        const meta = await extractVideoMeta(file);

        expect(meta.codec).toBe('unknown');
    });

    it('should use DJI filename startTime when MP4 metadata is missing', async () => {
        mockState.date = undefined;
        mockState.raw = {};

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 60, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'DJI_20260215_142500.mp4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);

        const expectedLocal = new Date(2026, 1, 15, 14, 25, 0);
        expect(meta.startTime).not.toBeUndefined();
        expect(meta.startTime!.getTime()).toBe(expectedLocal.getTime());
        expect(meta.timezoneOffsetMinutes).toBe(-meta.startTime!.getTimezoneOffset());
    });

    it('should prefer MP4 creation_time over DJI filename and set timezoneOffsetMinutes=0', async () => {
        const mp4Date = new Date('2026-02-15T14:25:00Z');
        mockState.date = mp4Date;
        mockState.raw = { creation_time: mp4Date.toISOString() };

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 60, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'DJI_20260215_142500.mp4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);

        expect(meta.startTime).not.toBeUndefined();
        expect(meta.startTime!.toISOString()).toBe(mp4Date.toISOString());
        expect(meta.timezoneOffsetMinutes).toBe(0);
    });

    it('should find mvhd creation_time in file tail (non-faststart MP4)', async () => {
        mockState.throwVideoTrackError = true;
        mockState.throwMetadataError = true;
        mockState.date = undefined;
        mockState.raw = {};

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'loaded' }),
        );

        const mvhd = createMp4WithMvhdCreationTime('2026-02-15T14:25:00Z');
        const leading = new Uint8Array(1024);
        const combined = new Uint8Array(leading.length + mvhd.length);
        combined.set(leading, 0);
        combined.set(mvhd, leading.length);

        const file = new File([combined.buffer as unknown as ArrayBuffer], 'video.mp4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);
        expect(meta.startTime?.toISOString()).toBe('2026-02-15T14:25:00.000Z');
    });

    it('should extract mvhd creation_time (version 1, 64-bit)', async () => {
        mockState.throwVideoTrackError = true;
        mockState.throwMetadataError = true;
        mockState.date = undefined;
        mockState.raw = {};

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'loaded' }),
        );

        function createMvhdV1(iso: string) {
            const date = new Date(iso);
            const unixSec = Math.floor(date.getTime() / 1000);
            const mp4Sec = unixSec + 2_082_844_800;
            const boxSize = 40;
            const b = new Uint8Array(boxSize);
            b[0] = 0; b[1] = 0; b[2] = 0; b[3] = boxSize;
            b[4] = 'm'.charCodeAt(0); b[5] = 'v'.charCodeAt(0); b[6] = 'h'.charCodeAt(0); b[7] = 'd'.charCodeAt(0);
            b[8] = 1; b[9] = 0; b[10] = 0; b[11] = 0;
            const high = Math.floor(mp4Sec / 2 ** 32) >>> 0;
            const low = mp4Sec >>> 0;
            b[12] = (high >>> 24) & 0xff; b[13] = (high >>> 16) & 0xff; b[14] = (high >>> 8) & 0xff; b[15] = high & 0xff;
            b[16] = (low >>> 24) & 0xff; b[17] = (low >>> 16) & 0xff; b[18] = (low >>> 8) & 0xff; b[19] = low & 0xff;
            return b;
        }

        const mvhdV1 = createMvhdV1('2026-02-15T14:25:00Z');
        const file = new File([mvhdV1.buffer as unknown as ArrayBuffer], 'video.mp4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);
        expect(meta.startTime?.toISOString()).toBe('2026-02-15T14:25:00.000Z');
    });
});
