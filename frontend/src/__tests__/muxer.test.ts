/**
 * Unit tests for muxer module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMuxer } from '../modules/muxer';
import { ProcessingError } from '../core/errors';
import type { DemuxedMedia, Mp4Sample } from '../modules/video-processing-types';
import type { VideoMeta } from '../core/types';

describe('muxer', () => {
    let muxer: ReturnType<typeof createMuxer>;

    const mockVideoMeta: VideoMeta = {
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 10,
        codec: 'avc1.640028',
        fileName: 'test.mp4',
        fileSize: 1000000,
    };

    const mockDemuxed: DemuxedMedia = {
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
            data: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
            duration: 1_000,
            dts: 0,
            cts: 0,
            timescale: 1_000_000,
            is_rap: true,
        }],
        audioSamples: [{
            data: new Uint8Array([4, 5, 6]).buffer as ArrayBuffer,
            duration: 1_000,
            dts: 0,
            cts: 0,
            timescale: 1_000_000,
            is_rap: true,
        }],
    };

    beforeEach(() => {
        muxer = createMuxer();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('muxMp4', () => {
        it('should mux video and audio tracks', async () => {
            vi.stubGlobal('Output', class {
                target = { buffer: new Uint8Array([1, 2, 3, 4, 5]).buffer };
                async start() {}
                async finalize() {}
                addVideoTrack() {}
                addAudioTrack() {}
            });

            vi.stubGlobal('EncodedVideoPacketSource', class {
                async add() {}
            });

            vi.stubGlobal('EncodedAudioPacketSource', class {
                async add() {}
            });

            vi.stubGlobal('EncodedPacket', {
                fromEncodedChunk: vi.fn().mockReturnValue({}),
            });

            vi.stubGlobal('EncodedAudioChunk', class {
                constructor() {}
            });

            const encodedChunks = [{
                type: 'key',
                timestamp: 0,
                duration: 1_000,
                data: new Uint8Array([1, 2, 3]),
            }] as EncodedVideoChunk[];

            const result = await muxer.muxMp4(
                mockDemuxed,
                encodedChunks,
                { codec: 'avc1.640028' } as VideoDecoderConfig,
                mockVideoMeta,
            );

            expect(result).toBeInstanceOf(Blob);
        });

        it('should throw when output is empty', async () => {
            vi.stubGlobal('Output', class {
                target = { buffer: null };
                async start() {}
                async finalize() {}
                addVideoTrack() {}
                addAudioTrack() {}
            });

            vi.stubGlobal('EncodedVideoPacketSource', class {
                async add() {}
            });

            vi.stubGlobal('EncodedPacket', {
                fromEncodedChunk: vi.fn().mockReturnValue({}),
            });

            await expect(muxer.muxMp4(
                mockDemuxed,
                [],
                undefined,
                mockVideoMeta,
            )).rejects.toThrow(ProcessingError);
        });
    });

    describe('startStreamingMuxSession', () => {
        it('should create streaming mux session', async () => {
            const abortController = new AbortController();
            
            vi.stubGlobal('Output', class {
                target = { buffer: new Uint8Array([1, 2, 3]).buffer };
                async start() {}
                async finalize() {}
                addVideoTrack() {}
                addAudioTrack() {}
            });

            vi.stubGlobal('EncodedVideoPacketSource', class {
                async add() {}
            });

            vi.stubGlobal('EncodedPacket', {
                fromEncodedChunk: vi.fn().mockReturnValue({}),
            });

            const session = muxer.startStreamingMuxSession(
                mockDemuxed,
                mockVideoMeta,
                abortController.signal,
            );

            expect(session).toHaveProperty('enqueueVideoChunk');
            expect(session).toHaveProperty('flushVideoQueue');
            expect(session).toHaveProperty('finalize');
        });
    });
});
