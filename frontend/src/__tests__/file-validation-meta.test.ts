/**
 * Unit tests for extractVideoMeta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    extractVideoMeta,
    MAX_VIDEO_DURATION_SECONDS,
    FAST_METADATA_THRESHOLD_BYTES,
} from '../modules/file-validation';

vi.mock('mediabunny', () => {
    const state = {
        codec: 'avc1.640028',
        fps: 30,
        width: 1920,
        height: 1080,
        duration: 120,
        date: new Date('2026-02-11T10:00:00Z'),
        raw: { location: '+55.7558+037.6176/' },
        throwPrimaryTrack: false,
        throwMetadataTags: false,
    };

    class BlobSource {
        file: File;
        constructor(file: File) {
            this.file = file;
        }
    }

    class Input {
        config: any;
        constructor(config: any) {
            this.config = config;
        }

        async getPrimaryVideoTrack() {
            if (state.throwPrimaryTrack) {
                throw new Error('unsupported codec in side stream');
            }

            return {
                displayWidth: state.width,
                displayHeight: state.height,
                getCodecParameterString: async () => state.codec,
                getDecoderConfig: async () => ({ codec: state.codec }),
                computePacketStats: async () => ({ averagePacketRate: state.fps }),
            };
        }

        async computeDuration() {
            return state.duration;
        }

        async getMetadataTags() {
            if (state.throwMetadataTags) {
                throw new Error('failed to read metadata tags');
            }

            return {
                date: state.date,
                raw: state.raw,
            };
        }
    }

    return {
        ALL_FORMATS: ['mp4'],
        BlobSource,
        Input,
        __setMockMp4Meta: (patch: Partial<typeof state>) => {
            Object.assign(state, patch);
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
    const mp4Sec = unixSec + 2_082_844_800; // seconds since 1904-01-01

    // Simple mvhd box (version 0)
    const boxSize = 32;
    const bytes = new Uint8Array(boxSize);

    // size (big-endian)
    bytes[0] = 0;
    bytes[1] = 0;
    bytes[2] = 0;
    bytes[3] = boxSize;

    // type 'mvhd'
    bytes[4] = 'm'.charCodeAt(0);
    bytes[5] = 'v'.charCodeAt(0);
    bytes[6] = 'h'.charCodeAt(0);
    bytes[7] = 'd'.charCodeAt(0);

    // version (0) + flags (0,0,0)
    bytes[8] = 0;
    bytes[9] = 0;
    bytes[10] = 0;
    bytes[11] = 0;

    // creation_time (4 bytes, BE)
    bytes[12] = (mp4Sec >>> 24) & 0xff;
    bytes[13] = (mp4Sec >>> 16) & 0xff;
    bytes[14] = (mp4Sec >>> 8) & 0xff;
    bytes[15] = mp4Sec & 0xff;

    return bytes;
}

describe('extractVideoMeta', () => {
    beforeEach(async () => {
        const mediabunny = await import('mediabunny') as any;
        mediabunny.__setMockMp4Meta({
            codec: 'avc1.640028',
            fps: 30,
            width: 1920,
            height: 1080,
            duration: 120,
            date: new Date('2026-02-11T10:00:00Z'),
            raw: { location: '+55.7558+037.6176/' },
            throwPrimaryTrack: false,
            throwMetadataTags: false,
        });

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
        expect(meta.startTime instanceof Date).toBe(true);
    });

    it('should use mp4 dimensions when video element reports zero size', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 0, height: 0, duration: 120, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);

        expect(meta.width).toBe(1920);
        expect(meta.height).toBe(1080);
    });

    it('should reject when metadata loading fails', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'error' }),
        );

        const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

        await expect(extractVideoMeta(file)).rejects.toThrow('Failed to read video metadata');
    });

    it('should reject when video duration exceeds max limit', async () => {
        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({
                width: 1920,
                height: 1080,
                duration: MAX_VIDEO_DURATION_SECONDS + 1,
                trigger: 'loaded',
            }),
        );

        const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

        await expect(extractVideoMeta(file)).rejects.toThrow('Video is too long');
    });

    it('should reject when both html metadata and mp4 metadata have invalid resolution', async () => {
        const mediabunny = await import('mediabunny') as any;
        mediabunny.__setMockMp4Meta({ width: 0, height: 0 });

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 0, height: 0, duration: 120, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

        await expect(extractVideoMeta(file)).rejects.toThrow('Failed to determine video resolution');
    });

    it('should skip deep mp4 parsing for very large files', async () => {
        const mediabunny = await import('mediabunny') as any;
        mediabunny.__setMockMp4Meta({
            codec: 'hvc1.1.6.L120.B0',
            fps: 120,
            date: new Date('2020-01-01T00:00:00Z'),
            raw: { location: '+00.0000+000.0000/' },
        });

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 3840, height: 2160, duration: 180, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'huge.mp4', { type: 'video/mp4' });
        Object.defineProperty(file, 'size', { value: FAST_METADATA_THRESHOLD_BYTES + 1 });

        const meta = await extractVideoMeta(file);

        expect(meta.width).toBe(3840);
        expect(meta.height).toBe(2160);
        expect(meta.codec).toBe('unknown');
        expect(meta.fps).toBe(30);
        expect(meta.gps).toBeUndefined();
    });

    it('should keep startTime from metadata tags when primary track probing fails', async () => {
        const mediabunny = await import('mediabunny') as any;
        const expectedDate = new Date('2026-02-15T14:25:00.000Z');
        mediabunny.__setMockMp4Meta({
            throwPrimaryTrack: true,
            date: expectedDate,
            raw: {
                creation_time: '2026-02-15T14:25:00.000000Z',
            },
        });

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'dji-90sec-video.MP4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);

        expect(meta.startTime?.toISOString()).toBe(expectedDate.toISOString());
    });

    it('should extract startTime from raw metadata when tags.date is missing', async () => {
        const mediabunny = await import('mediabunny') as any;
        mediabunny.__setMockMp4Meta({
            date: undefined,
            raw: {
                creation_time: '2026-02-15T14:25:00.000000Z',
            },
        });

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'dji-90sec-video.MP4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);

        expect(meta.startTime?.toISOString()).toBe('2026-02-15T14:25:00.000Z');
    });

    it('should not infer startTime from arbitrary numeric raw metadata fields', async () => {
        const mediabunny = await import('mediabunny') as any;
        mediabunny.__setMockMp4Meta({
            date: undefined,
            raw: {
                lat: 54.76189,
                lon: 35.630005,
                speed: 4.2,
                altitude: 139.4,
            },
        });

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'loaded' }),
        );

        const file = new File([new Uint8Array([1, 2, 3])], 'dji-90sec-video.MP4', { type: 'video/mp4' });
        const meta = await extractVideoMeta(file);

        expect(meta.startTime).toBeUndefined();
    });

    it('should extract startTime from mvhd when mediabunny metadata is unavailable', async () => {
        const mediabunny = await import('mediabunny') as any;
        mediabunny.__setMockMp4Meta({
            throwPrimaryTrack: true,
            throwMetadataTags: true,
            date: undefined,
            raw: undefined,
        });

        vi.spyOn(document, 'createElement').mockReturnValue(
            createMockVideoElement({ width: 1920, height: 1080, duration: 120, trigger: 'loaded' }),
        );

        const fileBytes = createMp4WithMvhdCreationTime('2026-02-15T14:25:00Z');
        const file = new File([fileBytes], 'dji-90sec-video.MP4', { type: 'video/mp4' });

        const meta = await extractVideoMeta(file);
        expect(meta.startTime?.toISOString()).toBe('2026-02-15T14:25:00.000Z');
    });
});
