/**
 * Tests for codec utilities module.
 */
import { describe, it, expect } from 'vitest';
import {
    getCodecCandidates,
    getAvcCodecCandidates,
    scaleToMaxArea,
    estimateBitrateBaseline,
    estimateTargetBitrate,
    toMediabunnyVideoCodec,
    toMediabunnyAudioCodec,
} from '../modules/codec-utils';
import type { VideoMeta } from '../core/types';

describe('codec-utils', () => {
    describe('getAvcCodecCandidates', () => {
        it('should return high-profile candidates for 4K+ resolution', () => {
            const meta: VideoMeta = {
                width: 4097,
                height: 2305,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const candidates = getAvcCodecCandidates(meta);
            expect(candidates).toContain('avc1.640034');
            expect(candidates).toContain('avc1.640028');
        });

        it('should return medium-profile candidates for 1080p+ resolution', () => {
            const meta: VideoMeta = {
                width: 1921,
                height: 1081,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const candidates = getAvcCodecCandidates(meta);
            expect(candidates).toContain('avc1.640033');
            expect(candidates).not.toContain('avc1.640034');
        });

        it('should return basic candidates for sub-1080p resolution', () => {
            const meta: VideoMeta = {
                width: 1280,
                height: 720,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const candidates = getAvcCodecCandidates(meta);
            expect(candidates).toEqual(['avc1.640029', 'avc1.640028']);
        });
    });

    describe('getCodecCandidates', () => {
        it('should return HEVC candidates for HEVC source', () => {
            const meta: VideoMeta = {
                width: 1920,
                height: 1080,
                fps: 30,
                duration: 10,
                codec: 'hvc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const candidates = getCodecCandidates(meta, 'hvc1.1.6.L153.B0');
            expect(candidates[0]).toMatch(/^hvc1\./);
        });

        it('should return AV1 candidates for AV1 source', () => {
            const meta: VideoMeta = {
                width: 1920,
                height: 1080,
                fps: 30,
                duration: 10,
                codec: 'av01',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const candidates = getCodecCandidates(meta, 'av01.0.12M.08');
            expect(candidates[0]).toMatch(/^av01\./);
        });

        it('should return VP9 candidates for VP9 source', () => {
            const meta: VideoMeta = {
                width: 1920,
                height: 1080,
                fps: 30,
                duration: 10,
                codec: 'vp09',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const candidates = getCodecCandidates(meta, 'vp09.00.41.08');
            expect(candidates[0]).toMatch(/^vp09\./);
        });

        it('should return AVC candidates for unknown source', () => {
            const meta: VideoMeta = {
                width: 1920,
                height: 1080,
                fps: 30,
                duration: 10,
                codec: 'unknown',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const candidates = getCodecCandidates(meta, 'unknown');
            expect(candidates.every(c => c.startsWith('avc1.'))).toBe(true);
        });
    });

    describe('scaleToMaxArea', () => {
        it('should not scale if already within max area', () => {
            const meta: VideoMeta = {
                width: 1920,
                height: 1080,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const result = scaleToMaxArea(meta, 2_500_000);
            expect(result.width).toBe(1920);
            expect(result.height).toBe(1080);
        });

        it('should scale down if exceeding max area', () => {
            const meta: VideoMeta = {
                width: 3840,
                height: 2160,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const result = scaleToMaxArea(meta, 2_000_000);
            expect(result.width * result.height).toBeLessThanOrEqual(2_000_000);
            expect(result.width).toBeLessThan(3840);
            expect(result.height).toBeLessThan(2160);
        });

        it('should preserve other metadata', () => {
            const meta: VideoMeta = {
                width: 3840,
                height: 2160,
                fps: 60,
                duration: 120,
                codec: 'hvc1',
                fileName: 'test.mp4',
                fileSize: 1000000,
            };
            const result = scaleToMaxArea(meta, 1_000_000);
            expect(result.fps).toBe(60);
            expect(result.duration).toBe(120);
            expect(result.codec).toBe('hvc1');
        });
    });

    describe('estimateBitrateBaseline', () => {
        it('should return 35 Mbps for 4K', () => {
            const meta: VideoMeta = {
                width: 3840,
                height: 2160,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            expect(estimateBitrateBaseline(meta)).toBe(35_000_000);
        });

        it('should return 15 Mbps for 1080p', () => {
            const meta: VideoMeta = {
                width: 1920,
                height: 1080,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            expect(estimateBitrateBaseline(meta)).toBe(15_000_000);
        });

        it('should return 8 Mbps for 720p', () => {
            const meta: VideoMeta = {
                width: 1280,
                height: 720,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            expect(estimateBitrateBaseline(meta)).toBe(8_000_000);
        });

        it('should return 5 Mbps for smaller resolutions', () => {
            const meta: VideoMeta = {
                width: 640,
                height: 480,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            expect(estimateBitrateBaseline(meta)).toBe(5_000_000);
        });
    });

    describe('estimateTargetBitrate', () => {
        it('should estimate based on source file size', () => {
            const sourceMeta: VideoMeta = {
                width: 1920,
                height: 1080,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            // 10 second video, 18.75 MB = 15 Mbps
            const sourceFileSize = 18_750_000;
            const bitrate = estimateTargetBitrate(sourceMeta, sourceMeta, sourceFileSize);
            expect(bitrate).toBeGreaterThanOrEqual(15_000_000);
        });

        it('should respect minimum bitrate', () => {
            const sourceMeta: VideoMeta = {
                width: 640,
                height: 480,
                fps: 30,
                duration: 10,
                codec: 'avc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            const bitrate = estimateTargetBitrate(sourceMeta, sourceMeta, 1000);
            expect(bitrate).toBeGreaterThanOrEqual(5_000_000);
        });

        it('should respect maximum bitrate', () => {
            const sourceMeta: VideoMeta = {
                width: 7680,
                height: 4320,
                fps: 60,
                duration: 10,
                codec: 'hvc1',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            // Very large file size to trigger high bitrate
            const bitrate = estimateTargetBitrate(sourceMeta, sourceMeta, 1_000_000_000);
            expect(bitrate).toBeLessThanOrEqual(140_000_000);
        });
    });

    describe('toMediabunnyVideoCodec', () => {
        it('should convert AVC1 to avc', () => {
            expect(toMediabunnyVideoCodec('avc1.640028')).toBe('avc');
        });

        it('should convert AVC3 to avc', () => {
            expect(toMediabunnyVideoCodec('avc3.640028')).toBe('avc');
        });

        it('should convert HEVC to hevc', () => {
            expect(toMediabunnyVideoCodec('hvc1.1.6.L153.B0')).toBe('hevc');
            expect(toMediabunnyVideoCodec('hev1.1.6.L153.B0')).toBe('hevc');
        });

        it('should convert VP9 to vp9', () => {
            expect(toMediabunnyVideoCodec('vp09.00.41.08')).toBe('vp9');
        });

        it('should convert VP8 to vp8', () => {
            expect(toMediabunnyVideoCodec('vp08.00.41.08')).toBe('vp8');
        });

        it('should convert AV1 to av1', () => {
            expect(toMediabunnyVideoCodec('av01.0.12M.08')).toBe('av1');
        });

        it('should default to avc for unknown codecs', () => {
            expect(toMediabunnyVideoCodec('unknown')).toBe('avc');
        });
    });

    describe('toMediabunnyAudioCodec', () => {
        it('should convert AAC to aac', () => {
            expect(toMediabunnyAudioCodec('mp4a.40.2')).toBe('aac');
        });

        it('should convert Opus to opus', () => {
            expect(toMediabunnyAudioCodec('opus')).toBe('opus');
        });

        it('should convert MP3 to mp3', () => {
            expect(toMediabunnyAudioCodec('mp3')).toBe('mp3');
        });

        it('should convert FLAC to flac', () => {
            expect(toMediabunnyAudioCodec('flac')).toBe('flac');
        });

        it('should default to aac for unknown codecs', () => {
            expect(toMediabunnyAudioCodec('unknown')).toBe('aac');
        });
    });
});
