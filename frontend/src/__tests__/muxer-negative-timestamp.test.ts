/**
 * Unit tests for muxer with negative timestamps.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    target: { buffer: ArrayBuffer | null } = { buffer: new Uint8Array([1, 2, 3]).buffer };
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

describe('muxer negative timestamp', () => {
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

    beforeEach(() => {
        vi.clearAllMocks();
        muxer = createMuxer();
    });

    it('should handle negative video timestamps', async () => {
        mockEncodedPacket.fromEncodedChunk.mockImplementation((chunk: any) => ({
            data: chunk.data instanceof Uint8Array ? chunk.data : new Uint8Array(chunk.data || 0),
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            type: chunk.type,
        }));

        const mockDemuxed: DemuxedMedia = {
            videoTrack: {
                id: 1,
                codec: 'avc1.640028',
                codecName: 'avc1',
                timescale: 1_000_000,
            },
            audioTrack: undefined,
            videoSamples: [{
                data: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
                duration: 1_000,
                dts: -1000,
                cts: -1000,
                timescale: 1_000_000,
                is_rap: true,
            }],
            audioSamples: [],
        };

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

            get byteLength() {
                if (this.data instanceof Uint8Array) return this.data.byteLength;
                if (this.data instanceof ArrayBuffer) return this.data.byteLength;
                return 0;
            }

            copyTo(dest: Uint8Array) {
                const src = this.data instanceof Uint8Array ? this.data : new Uint8Array(this.data || 0);
                const len = Math.min(src.length, dest.length);
                if (len > 0) dest.set(src.subarray(0, len), 0);
                return dest;
            }
        }

        (globalThis as any).EncodedVideoChunk = MockEncodedVideoChunk;

        const encodedChunks = [new MockEncodedVideoChunk({
            type: 'key',
            timestamp: -1000,
            duration: 1_000,
            data: new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42]),
        })] as unknown as EncodedVideoChunk[];

        const result = await muxer.muxMp4(
            mockDemuxed,
            encodedChunks,
            { codec: 'avc1.640028', codedWidth: 1920, codedHeight: 1080, description: new Uint8Array([1]) } as VideoDecoderConfig,
            mockVideoMeta,
        );

        expect(result).toBeTruthy();

        delete (globalThis as any).EncodedVideoChunk;
    });
});
