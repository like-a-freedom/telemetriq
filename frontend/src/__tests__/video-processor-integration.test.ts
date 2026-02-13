/**
 * Integration & load tests for video processing pipeline with a real
 * DJI Osmo Pocket 3 HEVC file (hvc1.2.4.H150, 1728×3072, long-GOP).
 *
 * These tests validate the Mediabunny-based demuxing path and keyframe
 * detection behavior.
 */
/// <reference types="node" />
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } from 'mediabunny';
import { createDemuxer } from '../modules/demuxer';
import { createKeyframeDetector } from '../modules/keyframe-detector';

const DJI_FILE_PATH = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../test_data/DJI_20260211092425_0002_D.MP4');

const FILE_EXISTS = fs.existsSync(DJI_FILE_PATH);
const describeWithFile = FILE_EXISTS ? describe : describe.skip;

interface DemuxResult {
    codec: string;
    width: number;
    height: number;
    videoPackets: Array<{ data: Uint8Array; type: 'key' | 'delta'; timestamp: number; duration: number }>;
    audioPackets: Array<{ data: Uint8Array; type: 'key' | 'delta'; timestamp: number; duration: number }>;
}

async function demuxFileWithMediabunny(file: File): Promise<DemuxResult> {
    const input = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(file),
    });

    try {
        const videoTrack = await input.getPrimaryVideoTrack();
        const audioTrack = await input.getPrimaryAudioTrack();

        if (!videoTrack) throw new Error('No video track found');

        const codec = (await videoTrack.getCodecParameterString()) ?? 'unknown';
        const width = videoTrack.displayWidth;
        const height = videoTrack.displayHeight;

        const videoSink = new EncodedPacketSink(videoTrack);
        const videoPackets: DemuxResult['videoPackets'] = [];
        for await (const packet of videoSink.packets()) {
            videoPackets.push({
                data: packet.data,
                type: packet.type,
                timestamp: packet.timestamp,
                duration: packet.duration,
            });
        }

        const audioPackets: DemuxResult['audioPackets'] = [];
        if (audioTrack) {
            const audioSink = new EncodedPacketSink(audioTrack);
            for await (const packet of audioSink.packets()) {
                audioPackets.push({
                    data: packet.data,
                    type: packet.type,
                    timestamp: packet.timestamp,
                    duration: packet.duration,
                });
            }
        }

        return { codec, width, height, videoPackets, audioPackets };
    } finally {
        const disposable = input as unknown as { [Symbol.dispose]?: () => void };
        disposable[Symbol.dispose]?.();
    }
}

describeWithFile('DJI Osmo Pocket 3 — Mediabunny integration', () => {
    let fileBuffer: ArrayBuffer;
    let file: File;
    let demux: DemuxResult;

    beforeAll(async () => {
        const raw = fs.readFileSync(DJI_FILE_PATH);
        fileBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        file = new File([fileBuffer], 'DJI_20260211092425_0002_D.MP4', { type: 'video/mp4' });
        demux = await demuxFileWithMediabunny(file);
    }, 60_000);

    it('should parse video track and extract packets', () => {
        expect(demux.codec.toLowerCase()).toMatch(/^(hvc1|hev1)/);
        expect(demux.videoPackets.length).toBeGreaterThan(0);
    });

    it('should report correct resolution (1728×3072)', () => {
        expect(demux.width).toBe(1728);
        expect(demux.height).toBe(3072);
    });

    it('should parse packet timing and payload', () => {
        const sample = demux.videoPackets[0];
        expect(sample).toBeDefined();
        const firstSample = sample!;
        expect(firstSample.data.byteLength).toBeGreaterThan(0);
        expect(firstSample.timestamp).toBeGreaterThanOrEqual(0);
        expect(firstSample.duration).toBeGreaterThan(0);
    });

    it('demuxer module should return samples via Mediabunny path', async () => {
        const demuxer = createDemuxer();
        const parsed = await demuxer.demux(file);

        expect(parsed.videoTrack.codec.toLowerCase()).toMatch(/^(hvc1|hev1)/);
        expect(parsed.videoSamples.length).toBeGreaterThan(0);
    });

    it('keyframe detector should find at least one keyframe', async () => {
        const demuxer = createDemuxer();
        const parsed = await demuxer.demux(file);

        const detector = createKeyframeDetector(
            parsed.videoTrack.codec,
            parsed.videoTrack.description,
        );

        const hasKeyframe = parsed.videoSamples.some((sample: any) => detector(sample));
        expect(hasKeyframe).toBe(true);
    });
});

describeWithFile('DJI Osmo Pocket 3 — Mediabunny load tests', () => {
    let fileBuffer: ArrayBuffer;
    let file: File;

    beforeAll(() => {
        const raw = fs.readFileSync(DJI_FILE_PATH);
        fileBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        file = new File([fileBuffer], 'DJI_20260211092425_0002_D.MP4', { type: 'video/mp4' });
    });

    it('should parse DJI file within 30 seconds', async () => {
        const start = performance.now();
        const result = await demuxFileWithMediabunny(file);
        const elapsed = performance.now() - start;

        expect(result.videoPackets.length).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(30_000);
    }, 60_000);

    it('should run keyframe detection across all samples quickly', async () => {
        const demuxer = createDemuxer();
        const parsed = await demuxer.demux(file);
        const detector = createKeyframeDetector(
            parsed.videoTrack.codec,
            parsed.videoTrack.description,
        );

        const start = performance.now();
        let keyframeCount = 0;
        for (const sample of parsed.videoSamples) {
            if (detector(sample)) keyframeCount += 1;
        }
        const elapsed = performance.now() - start;

        expect(keyframeCount).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(1_000);
    }, 60_000);
});
