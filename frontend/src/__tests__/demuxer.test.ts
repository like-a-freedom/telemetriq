/**
 * Unit tests for demuxer module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDemuxer } from '../modules/demuxer';
import * as ffmpegUtils from '../modules/ffmpegUtils';
import { ProcessingError } from '../core/errors';

vi.mock('mediabunny', () => {
    class MockInput {
        async getPrimaryVideoTrack() {
            return {
                displayWidth: 1920,
                displayHeight: 1080,
                getCodecParameterString: async () => 'avc1.640028',
                getDecoderConfig: async () => ({ codec: 'avc1.640028' }),
                computePacketStats: async () => ({ averagePacketRate: 30 }),
            };
        }
        async computeDuration() {
            return 120;
        }
        async getMetadataTags() {
            return {
                date: new Date('2026-02-11T10:00:00Z'),
                raw: { location: '+55.7558+037.6176/' },
            };
        }
    }

    return {
        __esModule: true,
        Input: MockInput,
    };
});

describe('demuxer', () => {
    let demuxer: ReturnType<typeof createDemuxer>;

    beforeEach(() => {
        demuxer = createDemuxer();
        vi.clearAllMocks();
    });

    describe('demux', () => {
        it('should throw ProcessingError when no video track found', async () => {
            vi.spyOn(demuxer, 'demux').mockRejectedValue(new ProcessingError('No video track found in the file'));

            await expect(demuxer.demux(new File([], 'test.mp4')))
                .rejects.toThrow(ProcessingError);
        });

        it('should handle demux with audio track', async () => {
            vi.spyOn(demuxer, 'demux').mockResolvedValue({
                videoTrack: {
                    id: 1,
                    codec: 'avc1.640028',
                    codecName: 'avc1',
                    timescale: 1_000_000,
                },
                audioTrack: {
                    id: 2,
                    codec: 'mp4a.40.2',
                    codecName: 'aac',
                    timescale: 1_000_000,
                    audio: { channel_count: 2, sample_rate: 48000 },
                },
                videoSamples: [{
                    data: new Uint8Array([1, 2, 3]).buffer,
                    duration: 33_333,
                    dts: 0,
                    cts: 0,
                    timescale: 1_000_000,
                    is_rap: true,
                }],
                audioSamples: [{
                    data: new Uint8Array([4, 5, 6]).buffer,
                    duration: 21_333,
                    dts: 0,
                    cts: 0,
                    timescale: 1_000_000,
                    is_rap: true,
                }],
            });

            const result = await demuxer.demux(new File([], 'test.mp4'));

            expect(result.videoTrack).toBeDefined();
            expect(result.audioTrack).toBeDefined();
            expect(result.videoSamples.length).toBeGreaterThan(0);
        });
    });

    describe('demuxWithFallback', () => {
        it('should use remux when direct demux fails', async () => {
            const remuxSpy = vi.spyOn(ffmpegUtils, 'remuxWithFfmpeg')
                .mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }));

            const successfulDemux: any = {
                videoTrack: { id: 1, codec: 'avc1.640028', codecName: 'avc1', timescale: 1_000_000 },
                audioTrack: null,
                videoSamples: [{ data: new Uint8Array([1, 2, 3]).buffer, duration: 1000, dts: 0, cts: 0, timescale: 1_000_000, is_rap: true }],
                audioSamples: [],
            };

            const demuxSpy = vi.spyOn(demuxer, 'demux')
                .mockRejectedValueOnce(new Error('First parse failed'))
                .mockResolvedValueOnce(successfulDemux);

            const file = new File([new Uint8Array([1])], 'test.mp4', { type: 'video/mp4' });
            const result = await demuxer.demuxWithFallback(file);

            expect(result).toBeDefined();
            expect(remuxSpy).toHaveBeenCalled();
            expect(demuxSpy).toHaveBeenCalledTimes(2);
        });

        it('should throw for large files when fallback fails', async () => {
            const hugeFile = new File([new Uint8Array([1])], 'huge.mp4', { type: 'video/mp4' });
            Object.defineProperty(hugeFile, 'size', { value: 1024 * 1024 * 1024 + 1 });

            vi.spyOn(demuxer, 'demux').mockRejectedValue(new ProcessingError('Parse failed'));

            await expect(demuxer.demuxWithFallback(hugeFile))
                .rejects.toThrow(/larger than 1 GB/i);
        });
    });
});
