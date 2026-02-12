/**
 * Unit tests for extractVideoMeta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractVideoMeta, MAX_VIDEO_DURATION_SECONDS } from '../modules/file-validation';

vi.mock('mediabunny', () => {
    const state = {
        codec: 'avc1.640028',
        fps: 30,
        width: 1920,
        height: 1080,
        duration: 120,
        date: new Date('2026-02-11T10:00:00Z'),
        raw: { location: '+55.7558+037.6176/' },
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
});
