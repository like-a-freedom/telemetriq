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

class MockEncodedVideoChunk {
    type: 'key' | 'delta';
    timestamp: number;
    duration: number;
    data: Uint8Array;

    constructor(init: { type: 'key' | 'delta'; timestamp: number; duration: number; data: Uint8Array }) {
        this.type = init.type;
        this.timestamp = init.timestamp;
        this.duration = init.duration;
        this.data = init.data;
    }
}

class MockEncodedAudioChunk {
    type: 'key' | 'delta';
    timestamp: number;
    duration: number;
    data: Uint8Array;

    constructor(init: { type: 'key' | 'delta'; timestamp: number; duration: number; data: Uint8Array }) {
        this.type = init.type;
        this.timestamp = init.timestamp;
        this.duration = init.duration;
        this.data = init.data;
    }
}

vi.mock('mediabunny', () => ({
    EncodedPacket: mockEncodedPacket,
    Output: MockOutput,
    EncodedVideoPacketSource: MockEncodedVideoPacketSource,
    EncodedAudioPacketSource: MockEncodedAudioPacketSource,
    BufferTarget: MockBufferTarget,
    Mp4OutputFormat: MockMp4OutputFormat,
}));

const { createMuxer } = await import('../modules/muxer');

describe('muxer negative timestamp handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('EncodedAudioChunk', MockEncodedAudioChunk);
    });

    it('should clamp negative audio timestamp to zero before muxing', async () => {
        mockEncodedPacket.fromEncodedChunk.mockImplementation((chunk: any) => chunk);

        const muxer = createMuxer();
        const meta: VideoMeta = {
            width: 1920,
            height: 1080,
            fps: 30,
            duration: 10,
            codec: 'avc1.640028',
            fileName: 'iphone.mov',
            fileSize: 1000,
        };

        const demuxed: DemuxedMedia = {
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
                audio: { channel_count: 2, sample_rate: 48_000 },
            },
            videoSamples: [],
            audioSamples: [{
                data: new Uint8Array([1, 2, 3]).buffer,
                duration: 21_333,
                dts: -44_000,
                cts: -44_000,
                timescale: 1_000_000,
                is_rap: true,
            }],
        };

        const encodedChunks = [new MockEncodedVideoChunk({
            type: 'key',
            timestamp: 0,
            duration: 33_333,
            data: new Uint8Array([0x01]),
        }) as unknown as EncodedVideoChunk];

        await muxer.muxMp4(
            demuxed,
            encodedChunks,
            { codec: 'avc1.640028', codedWidth: 1920, codedHeight: 1080 } as VideoDecoderConfig,
            meta,
        );

        const audioChunkCall = mockEncodedPacket.fromEncodedChunk.mock.calls
            .map(([chunk]) => chunk)
            .find((chunk) => chunk instanceof MockEncodedAudioChunk);

        expect(audioChunkCall).toBeDefined();
        expect((audioChunkCall as MockEncodedAudioChunk).timestamp).toBe(0);
        expect((audioChunkCall as MockEncodedAudioChunk).duration).toBeGreaterThan(0);
    });
});
