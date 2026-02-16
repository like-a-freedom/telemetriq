/**
 * Unit tests for muxer module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DemuxedMedia } from '../modules/video-processing-types';
import type { VideoMeta } from '../core/types';

class MockBufferTarget { }
class MockMp4OutputFormat { }

class MockEncodedVideoPacketSource {
    add = vi.fn().mockResolvedValue(undefined);
}

class MockEncodedAudioPacketSource {
    add = vi.fn().mockResolvedValue(undefined);
}

class MockOutput {
    target: { buffer: ArrayBuffer | null } = { buffer: new Uint8Array([1, 2, 3, 4, 5]).buffer };
    start = vi.fn().mockResolvedValue(undefined);
    finalize = vi.fn().mockResolvedValue(undefined);
    addVideoTrack = vi.fn();
    addAudioTrack = vi.fn();
}

const mockEncodedPacket = {
    fromEncodedChunk: vi.fn(),
};

vi.mock('mediabunny', () => ({
    __esModule: true,
    EncodedPacket: mockEncodedPacket,
    Output: MockOutput,
    EncodedVideoPacketSource: MockEncodedVideoPacketSource,
    EncodedAudioPacketSource: MockEncodedAudioPacketSource,
    BufferTarget: MockBufferTarget,
    Mp4OutputFormat: MockMp4OutputFormat,
}));

const { createMuxer } = await import('../modules/muxer');

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
            decoderConfig: { codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 48000, description: new Uint8Array([1]) } as any,
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
        vi.clearAllMocks();
        mockEncodedPacket.fromEncodedChunk.mockReset();
        muxer = createMuxer();
    });

    describe('muxMp4', () => {
        it('should mux video and audio tracks', async () => {
            mockEncodedPacket.fromEncodedChunk.mockImplementation((chunk: any) => ({
                data: chunk.data instanceof Uint8Array ? chunk.data : new Uint8Array(chunk.data || 0),
                timestamp: chunk.timestamp,
                duration: chunk.duration,
                type: chunk.type,
            }));

            class MockEncodedVideoChunk {
                data!: Uint8Array | ArrayBuffer;
                type!: string;
                timestamp!: number;
                duration!: number;

                constructor(init: any) {
                    this.data = init?.data ?? new Uint8Array();
                    this.type = init?.type ?? 'key';
                    this.timestamp = init?.timestamp ?? 0;
                    this.duration = init?.duration ?? 0;
                }

                copyTo(dest: Uint8Array) {
                    const src = this.data instanceof Uint8Array ? this.data : new Uint8Array(this.data || 0);
                    const len = Math.min(src.length, dest.length);
                    if (len > 0) dest.set(src.subarray(0, len), 0);
                    return dest;
                }
            }

            (globalThis as any).EncodedVideoChunk = MockEncodedVideoChunk;
            (globalThis as any).EncodedAudioChunk = MockEncodedVideoChunk;

            const encodedChunks = [new MockEncodedVideoChunk({
                type: 'key',
                timestamp: 0,
                duration: 1_000,
                data: new Uint8Array([
                    0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1f, 0xe5, 0x88,
                    0x00, 0x00, 0x00, 0x01, 0x68, 0xce, 0x06, 0xe2,
                    0x00, 0x00, 0x00, 0x01, 0x65, 0x88, 0x99,
                ]),
            })];

            const result = await muxer.muxMp4(
                mockDemuxed,
                encodedChunks,
                { codec: 'avc1.640028', codedWidth: 1920, codedHeight: 1080, description: new Uint8Array([1]) } as VideoDecoderConfig,
                mockVideoMeta,
            );

            expect(mockEncodedPacket.fromEncodedChunk).toHaveBeenCalled();
            expect(result).toBeTruthy();
            expect(typeof (result as any).size === 'number' || typeof (result as any).arrayBuffer === 'function').toBe(true);

            delete (globalThis as any).EncodedVideoChunk;
            delete (globalThis as any).EncodedAudioChunk;
        });

        it('should create streaming mux session', async () => {
            const abortController = new AbortController();

            mockEncodedPacket.fromEncodedChunk.mockReturnValue({});

            const session = muxer.startStreamingMuxSession(
                mockDemuxed,
                mockVideoMeta,
                abortController.signal,
            );

            expect(session).toHaveProperty('enqueueVideoChunk');
            expect(session).toHaveProperty('flushVideoQueue');
            expect(session).toHaveProperty('finalize');

            expect(typeof session.enqueueVideoChunk).toBe('function');
            expect(typeof session.flushVideoQueue).toBe('function');
            expect(typeof session.finalize).toBe('function');
        });

        it('should handle video-only muxing without audio track', async () => {
            mockEncodedPacket.fromEncodedChunk.mockImplementation((chunk: any) => ({
                data: chunk.data instanceof Uint8Array ? chunk.data : new Uint8Array(chunk.data || 0),
                timestamp: chunk.timestamp,
                duration: chunk.duration,
                type: chunk.type,
            }));

            class MockEncodedVideoChunk {
                data!: Uint8Array | ArrayBuffer;
                type!: string;
                timestamp!: number;
                duration!: number;

                constructor(init: any) {
                    this.data = init?.data ?? new Uint8Array();
                    this.type = init?.type ?? 'key';
                    this.timestamp = init?.timestamp ?? 0;
                    this.duration = init?.duration ?? 0;
                }

                copyTo(dest: Uint8Array) {
                    const src = this.data instanceof Uint8Array ? this.data : new Uint8Array(this.data || 0);
                    const len = Math.min(src.length, dest.length);
                    if (len > 0) dest.set(src.subarray(0, len), 0);
                    return dest;
                }
            }

            (globalThis as any).EncodedVideoChunk = MockEncodedVideoChunk;
            (globalThis as any).EncodedAudioChunk = MockEncodedVideoChunk;

            const videoOnlyDemuxed = {
                ...mockDemuxed,
                audioTrack: undefined,
                audioSamples: [],
            };

            const encodedChunks = [new MockEncodedVideoChunk({
                type: 'key',
                timestamp: 0,
                duration: 1_000,
                data: new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42]),
            })];

            const result = await muxer.muxMp4(
                videoOnlyDemuxed,
                encodedChunks,
                { codec: 'avc1.640028', codedWidth: 1920, codedHeight: 1080, description: new Uint8Array([1]) } as VideoDecoderConfig,
                mockVideoMeta,
            );

            expect(result).toBeTruthy();

            delete (globalThis as any).EncodedVideoChunk;
            delete (globalThis as any).EncodedAudioChunk;
        });
    });
});
