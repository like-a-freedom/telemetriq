import { describe, it, expect, vi } from 'vitest';

const disposeSpy = vi.fn();

class MockBlobSource {
    constructor(_file: File) { }
}

class MockInput {
    async getPrimaryVideoTrack() {
        return {
            codec: 'avc1',
            displayWidth: 1920,
            displayHeight: 1080,
            getCodecParameterString: async () => 'avc1.640028',
            getDecoderConfig: async () => ({ codec: 'avc1.640028' }),
        };
    }

    async getPrimaryAudioTrack() {
        throw new Error("Unsupported audio codec (sample entry type 'apac').");
    }

    [Symbol.dispose]() {
        disposeSpy();
    }
}

class MockEncodedPacketSink {
    private readonly track: any;

    constructor(track: any) {
        this.track = track;
    }

    async *packets() {
        if (this.track?.codec === 'avc1') {
            yield {
                timestamp: 0,
                duration: 1 / 30,
                data: new Uint8Array([1, 2, 3]),
                type: 'key' as const,
            };
        }
    }

    close() { }
}

vi.mock('mediabunny', () => ({
    ALL_FORMATS: ['mp4'],
    BlobSource: MockBlobSource,
    Input: MockInput,
    EncodedPacketSink: MockEncodedPacketSink,
}));

const { createDemuxer } = await import('../modules/demuxer');

describe('demuxer unsupported audio codec handling', () => {
    it('should parse video and skip unsupported apac audio track', async () => {
        const demuxer = createDemuxer();
        const file = new File([new Uint8Array([1, 2, 3])], 'iphone-16-pro-max.mov', { type: 'video/quicktime' });

        const result = await demuxer.demux(file);

        expect(result.videoTrack.codec).toBe('avc1.640028');
        expect(result.videoSamples.length).toBe(1);
        expect(result.audioTrack).toBeUndefined();
        expect(result.audioSamples).toEqual([]);
        expect(disposeSpy).toHaveBeenCalledTimes(1);
    });
});
