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

    beforeEach(() => {
        manager = createVideoCodecManager();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('createDecoder', () => {
        it('should create VideoDecoder with correct config', () => {
            const onFrame = vi.fn();
            const onError = vi.fn();

            vi.stubGlobal('VideoDecoder', class {
                configure = vi.fn();
            });

            const decoder = manager.createDecoder('avc1.640028', undefined, onFrame, onError);

            expect(decoder).toBeDefined();
        });

        it('should include description when provided', () => {
            const description = new Uint8Array([1, 2, 3]).buffer;
            const configureSpy = vi.fn();

            vi.stubGlobal('VideoDecoder', class {
                configure = configureSpy;
                set output(_: any) {}
                set error(_: any) {}
            });

            manager.createDecoder('avc1.640028', description, vi.fn(), vi.fn());

            expect(configureSpy).toHaveBeenCalled();
            const config = configureSpy.mock.calls[0][0];
            expect(config.description).toBe(description);
        });
    });

    describe('isVideoTrackDecodable', () => {
        it('should return true when config is supported', async () => {
            vi.stubGlobal('VideoDecoder', {
                isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
            });

            const result = await manager.isVideoTrackDecodable('avc1.640028');
            expect(result).toBe(true);
        });

        it('should return false when config is not supported', async () => {
            vi.stubGlobal('VideoDecoder', {
                isConfigSupported: vi.fn().mockResolvedValue({ supported: false }),
            });

            const result = await manager.isVideoTrackDecodable('unsupported');
            expect(result).toBe(false);
        });

        it('should return false when check throws', async () => {
            vi.stubGlobal('VideoDecoder', {
                isConfigSupported: vi.fn().mockRejectedValue(new Error('error')),
            });

            const result = await manager.isVideoTrackDecodable('avc1.640028');
            expect(result).toBe(false);
        });
    });

    describe('createEncoder', () => {
        it('should throw when no codec is supported', async () => {
            vi.stubGlobal('VideoEncoder', {
                isConfigSupported: vi.fn().mockResolvedValue({ supported: false }),
            });

            vi.stubGlobal('VideoEncoder', class {
                static isConfigSupported = vi.fn().mockResolvedValue({ supported: false });
                state = 'unconfigured';
                configure() {}
                set output(_: any) {}
                set error(_: any) {}
            });

            await expect(
                manager.createEncoder(mockVideoMeta, 'avc1.640028', vi.fn(), vi.fn())
            ).rejects.toThrow();
        });
    });
});
