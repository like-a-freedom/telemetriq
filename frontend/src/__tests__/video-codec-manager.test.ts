/**
 * Unit tests for video-codec-manager module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVideoCodecManager } from '../modules/video-codec-manager';
import type { VideoMeta } from '../core/types';

describe('video-codec-manager', () => {
    let manager: ReturnType<typeof createVideoCodecManager>;
    const mockVideoMeta: VideoMeta = {
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 10,
        codec: 'avc1.640028',
        fileName: 'test.mp4',
        fileSize: 1000000,
    };

    let originalVideoDecoder: typeof VideoDecoder;
    let originalVideoEncoder: typeof VideoEncoder;

    beforeEach(() => {
        manager = createVideoCodecManager();
        originalVideoDecoder = globalThis.VideoDecoder;
        originalVideoEncoder = globalThis.VideoEncoder;
    });

    afterEach(() => {
        globalThis.VideoDecoder = originalVideoDecoder;
        globalThis.VideoEncoder = originalVideoEncoder;
    });

    describe('createDecoder', () => {
        it('should create VideoDecoder with correct config', () => {
            const onFrame = vi.fn();
            const onError = vi.fn();

            globalThis.VideoDecoder = class MockVideoDecoder {
                configure = vi.fn();
            } as any;

            const decoder = manager.createDecoder('avc1.640028', undefined, onFrame, onError);

            expect(decoder).toBeDefined();
        });

        it('should include description when provided', () => {
            const description = new Uint8Array([1, 2, 3]).buffer;
            const configureSpy = vi.fn();

            globalThis.VideoDecoder = class MockVideoDecoder {
                configure = configureSpy;
                set output(_: any) { }
                set error(_: any) { }
            } as any;

            manager.createDecoder('avc1.640028', description, vi.fn(), vi.fn());

            expect(configureSpy).toHaveBeenCalled();
            const config = configureSpy.mock.calls[0]?.[0];
            expect(config).toBeDefined();
            expect(config?.description).toBe(description);
        });
    });

    describe('isVideoTrackDecodable', () => {
        it('should return true when config is supported', async () => {
            globalThis.VideoDecoder = {
                isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
            } as any;

            const result = await manager.isVideoTrackDecodable('avc1.640028');
            expect(result).toBe(true);
        });

        it('should return false when config is not supported', async () => {
            globalThis.VideoDecoder = {
                isConfigSupported: vi.fn().mockResolvedValue({ supported: false }),
            } as any;

            const result = await manager.isVideoTrackDecodable('unsupported');
            expect(result).toBe(false);
        });

        it('should return false when check throws', async () => {
            globalThis.VideoDecoder = {
                isConfigSupported: vi.fn().mockRejectedValue(new Error('error')),
            } as any;

            const result = await manager.isVideoTrackDecodable('avc1.640028');
            expect(result).toBe(false);
        });
    });

    describe('createEncoder', () => {
        it('should throw when no codec is supported', async () => {
            globalThis.VideoEncoder = class MockVideoEncoder {
                static isConfigSupported = vi.fn().mockResolvedValue({ supported: false });
                state = 'unconfigured';
                configure() { }
                set output(_: any) { }
                set error(_: any) { }
            } as any;

            await expect(
                manager.createEncoder(mockVideoMeta, 'avc1.640028', vi.fn(), vi.fn())
            ).rejects.toThrow();
        });
    });
});
