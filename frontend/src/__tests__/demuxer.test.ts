/**
 * Unit tests for demuxer module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDemuxer } from '../modules/demuxer';
import * as ffmpegUtils from '../modules/ffmpeg-utils';
import { ProcessingError } from '../core/errors';

describe('demuxer', () => {
    let demuxer: ReturnType<typeof createDemuxer>;

    beforeEach(() => {
        demuxer = createDemuxer();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('demux', () => {
        it('should throw ProcessingError when no video track found', async () => {
            vi.stubGlobal('Input', class {
                async getPrimaryVideoTrack() { return null; }
                async getPrimaryAudioTrack() { return null; }
                [Symbol.dispose]() {}
            });

            await expect(demuxer.demux(new File([], 'test.mp4')))
                .rejects.toThrow(ProcessingError);
        });

        it('should handle demux with audio track', async () => {
            const mockVideoTrack = {
                id: 1,
                codec: 'avc1.640028',
                displayWidth: 1920,
                displayHeight: 1080,
                getCodecParameterString: vi.fn().mockResolvedValue('avc1.640028'),
                getDecoderConfig: vi.fn().mockResolvedValue({ codec: 'avc1.640028' }),
            };

            const mockAudioTrack = {
                id: 2,
                codec: 'mp4a.40.2',
                numberOfChannels: 2,
                sampleRate: 48000,
                getCodecParameterString: vi.fn().mockResolvedValue('mp4a.40.2'),
                getDecoderConfig: vi.fn().mockResolvedValue({ codec: 'mp4a.40.2' }),
            };

            vi.stubGlobal('Input', class {
                async getPrimaryVideoTrack() { return mockVideoTrack; }
                async getPrimaryAudioTrack() { return mockAudioTrack; }
                [Symbol.dispose]() {}
            });

            vi.stubGlobal('EncodedPacketSink', class {
                async *packets() {
                    yield {
                        data: new Uint8Array([1, 2, 3]),
                        type: 'key',
                        timestamp: 0,
                        duration: 0.033,
                    };
                }
                close() {}
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

            // First call fails, second succeeds
            let callCount = 0;
            vi.stubGlobal('Input', class {
                async getPrimaryVideoTrack() {
                    callCount++;
                    if (callCount === 1) throw new Error('First parse failed');
                    return {
                        id: 1,
                        codec: 'avc1.640028',
                        displayWidth: 1920,
                        displayHeight: 1080,
                        getCodecParameterString: vi.fn().mockResolvedValue('avc1.640028'),
                        getDecoderConfig: vi.fn().mockResolvedValue({ codec: 'avc1.640028' }),
                    };
                }
                async getPrimaryAudioTrack() { return null; }
                [Symbol.dispose]() {}
            });

            vi.stubGlobal('EncodedPacketSink', class {
                async *packets() {
                    yield {
                        data: new Uint8Array([1, 2, 3]),
                        type: 'key',
                        timestamp: 0,
                        duration: 0.033,
                    };
                }
                close() {}
            });

            const file = new File([new Uint8Array([1])], 'test.mp4', { type: 'video/mp4' });
            const result = await demuxer.demuxWithFallback(file);

            expect(result).toBeDefined();
            expect(remuxSpy).toHaveBeenCalled();
        });

        it('should throw for large files when fallback fails', async () => {
            const hugeFile = new File([new Uint8Array([1])], 'huge.mp4', { type: 'video/mp4' });
            Object.defineProperty(hugeFile, 'size', { value: 1024 * 1024 * 1024 + 1 });

            vi.stubGlobal('Input', class {
                async getPrimaryVideoTrack() { throw new Error('Parse failed'); }
                [Symbol.dispose]() {}
            });

            await expect(demuxer.demuxWithFallback(hugeFile))
                .rejects.toThrow(/larger than 1 GB/i);
        });
    });
});
