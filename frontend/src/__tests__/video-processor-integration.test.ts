/**
 * Integration & load tests for video processing pipeline with a real
 * DJI Osmo Pocket 3 HEVC file (hvc1.2.4.H150, 1728×3072, long-GOP).
 *
 * These tests exercise the MP4Box parsing, codec-description extraction,
 * and keyframe detection layers — everything that can run without the
 * browser-only WebCodecs API (VideoDecoder/VideoEncoder are unavailable
 * in the happy-dom test environment).
 */
/// <reference types="node" />
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createSafeMP4BoxFile, appendFileToMp4box } from '../modules/mp4box-safe';
import { VideoProcessor } from '../modules/video-processor';
import type { VideoMeta, TelemetryFrame } from '../core/types';

// ─── paths ──────────────────────────────────────────────────────────────
const DJI_FILE_PATH = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../test_data/DJI_20260211092425_0002_D.MP4');

const FILE_EXISTS = fs.existsSync(DJI_FILE_PATH);

// Skip the entire suite when the test file is not present (CI without fixtures).
const describeWithFile = FILE_EXISTS ? describe : describe.skip;

// ─── helpers ────────────────────────────────────────────────────────────

/** Minimal VideoProcessor instance to access private helpers. */
function createTestProcessor(file: File): VideoProcessor {
    const meta: VideoMeta = {
        duration: 10,
        width: 1728,
        height: 3072,
        fps: 30,
        codec: 'hvc1.2.4.H150',
        fileSize: file.size,
        fileName: file.name,
    };
    return new VideoProcessor({
        videoFile: file,
        videoMeta: meta,
        telemetryFrames: [] as TelemetryFrame[],
        syncOffsetSeconds: 0,
    });
}

/** Feed an ArrayBuffer directly to MP4Box (bypasses File/Blob slice). */
function feedBufferToMp4box(
    mp4boxfile: ReturnType<typeof createSafeMP4BoxFile>,
    buffer: ArrayBuffer,
    chunkSize = 1024 * 1024,
): void {
    const seenOffsets = new Set<number>();
    let offset = 0;
    while (offset < buffer.byteLength) {
        const end = Math.min(offset + chunkSize, buffer.byteLength);
        const chunk = buffer.slice(offset, end) as ArrayBuffer & { fileStart?: number };
        chunk.fileStart = offset;

        const nextFileStart = mp4boxfile.appendBuffer(chunk) as number | undefined;
        if (
            typeof nextFileStart === 'number' &&
            nextFileStart !== offset &&
            !seenOffsets.has(nextFileStart)
        ) {
            seenOffsets.add(offset);
            offset = nextFileStart;
            continue;
        }
        offset = end;
    }
}

interface DemuxResult {
    info: any;
    mp4boxfile: any;
    videoTrack: any;
    audioTrack: any;
    videoSamples: any[];
    audioSamples: any[];
}

/** Parse the DJI file with MP4Box and collect samples. */
function demuxFile(buffer: ArrayBuffer): Promise<DemuxResult> {
    return new Promise<DemuxResult>((resolve, reject) => {
        const mp4boxfile = createSafeMP4BoxFile();
        const videoSamples: any[] = [];
        const audioSamples: any[] = [];
        let videoTrack: any;
        let audioTrack: any;
        let info: any;

        mp4boxfile.onError = reject;

        mp4boxfile.onReady = (infoObj: any) => {
            info = infoObj;
            videoTrack = info.tracks?.find((t: any) => t.video);
            audioTrack = info.tracks?.find((t: any) => t.audio);

            if (videoTrack) {
                mp4boxfile.setExtractionOptions(videoTrack.id, null, {
                    nbSamples: 1,
                    rapAlignement: false,
                });
            }
            if (audioTrack) {
                mp4boxfile.setExtractionOptions(audioTrack.id, null, {
                    nbSamples: 50,
                    rapAlignement: false,
                });
            }
            mp4boxfile.start();
        };

        mp4boxfile.onSamples = (id: number, _user: unknown, samples: any[]) => {
            if (videoTrack && id === videoTrack.id) videoSamples.push(...samples);
            if (audioTrack && id === audioTrack.id) audioSamples.push(...samples);
        };

        try {
            feedBufferToMp4box(mp4boxfile, buffer);
            mp4boxfile.flush();
        } catch (err) {
            reject(err);
            return;
        }

        if (!videoTrack) {
            reject(new Error('No video track found'));
            return;
        }

        resolve({ info, mp4boxfile, videoTrack, audioTrack, videoSamples, audioSamples });
    });
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

describeWithFile('DJI Osmo Pocket 3 — Integration tests', () => {
    let fileBuffer: ArrayBuffer;
    let demux: DemuxResult;

    beforeAll(async () => {
        const raw = fs.readFileSync(DJI_FILE_PATH);
        fileBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        demux = await demuxFile(fileBuffer);
    }, 60_000);

    // ── MP4Box safe parsing ─────────────────────────────────────────
    describe('MP4Box safe parsing of DJI HEVC', () => {
        it('should parse without crashing on ©dji metadata atoms', () => {
            expect(demux.info).toBeDefined();
            expect(demux.info.tracks.length).toBeGreaterThan(0);
        });

        it('should detect a video track with hvc1 codec', () => {
            expect(demux.videoTrack).toBeDefined();
            expect(demux.videoTrack.codec.toLowerCase()).toMatch(/^hvc1/);
        });

        it('should report correct resolution (1728×3072)', () => {
            expect(demux.videoTrack.video.width).toBe(1728);
            expect(demux.videoTrack.video.height).toBe(3072);
        });

        it('should extract video samples', () => {
            expect(demux.videoSamples.length).toBeGreaterThan(0);
        });

        it('each video sample should carry typed array data', () => {
            for (const sample of demux.videoSamples.slice(0, 5)) {
                // MP4Box may return Uint8Array or ArrayBuffer
                const hasData =
                    sample.data instanceof ArrayBuffer ||
                    ArrayBuffer.isView(sample.data);
                expect(hasData).toBe(true);
                expect(sample.data.byteLength).toBeGreaterThan(0);
            }
        });

        it('should have valid sample timing (duration, dts, cts, timescale)', () => {
            const sample = demux.videoSamples[0];
            expect(sample.timescale).toBeGreaterThan(0);
            expect(typeof sample.dts).toBe('number');
            expect(typeof sample.cts).toBe('number');
            expect(typeof sample.duration).toBe('number');
        });
    });

    // ── Codec description extraction ────────────────────────────────
    describe('Codec description extraction (hvcC)', () => {
        it('videoTrack.description from getInfo() should be undefined for this DJI file', () => {
            // This is the root cause of the bug: MP4Box doesn't surface
            // the hvcC box via the standard description field for this file.
            // Our custom extraction path must kick in.
            const infoDescription = demux.videoTrack.description;
            // Could be undefined or an empty ArrayBuffer (length 0)
            const isEmpty =
                infoDescription === undefined ||
                infoDescription === null ||
                (infoDescription instanceof ArrayBuffer && infoDescription.byteLength === 0);
            expect(isEmpty).toBe(true);
        });

        it('extractCodecDescriptionFromMp4box should return a non-empty ArrayBuffer', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer | undefined;

            expect(description).toBeDefined();
            expect(description).toBeInstanceOf(ArrayBuffer);
            expect(description!.byteLength).toBeGreaterThan(0);
        });

        it('extracted description should start with configurationVersion=1 (valid HEVC config record)', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer;

            const view = new DataView(description);
            // HEVCDecoderConfigurationRecord: first byte is configurationVersion
            expect(view.getUint8(0)).toBe(1);
        });

        it('extracted description should NOT include the 8-byte box header', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer;

            // If the header were included, the first 4 bytes would be the box
            // size (big-endian) and bytes 4-7 would be 'hvcC' (0x68766343).
            // The stripped buffer should NOT start with these.
            const view = new DataView(description);
            const possibleFourcc = String.fromCharCode(
                view.getUint8(4),
                view.getUint8(5),
                view.getUint8(6),
                view.getUint8(7),
            );
            expect(possibleFourcc).not.toBe('hvcC');
        });

        it('extracted description should be exactly 126 bytes (134 box - 8 header)', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer;

            // Validated via manual bun script: box.write() produces 134 bytes,
            // minus 8-byte header = 126 bytes of HEVCDecoderConfigurationRecord.
            expect(description.byteLength).toBe(126);
        });
    });

    // ── NAL length-size detection ───────────────────────────────────
    describe('NAL length-size detection', () => {
        it('getNalLengthSize should parse lengthSizeMinusOne from hvcC description', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer;

            const nalLengthSize = (processor as any).getNalLengthSize(
                demux.videoTrack.codec.toLowerCase(),
                description,
            ) as number | undefined;

            expect(nalLengthSize).toBeDefined();
            // NAL length size is typically 4 for HEVC
            expect([1, 2, 3, 4]).toContain(nalLengthSize);
        });

        it('detectNalLengthSizeFromSample should work on a real sample without description', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const sample = demux.videoSamples[0];
            expect(sample).toBeDefined();

            const data = new Uint8Array(sample.data);
            const detected = (processor as any).detectNalLengthSizeFromSample(data) as
                | number
                | undefined;

            expect(detected).toBeDefined();
            expect([1, 2, 3, 4]).toContain(detected);
        });

        it('heuristic NAL length-size should agree with description-based value', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer;

            const fromDescription = (processor as any).getNalLengthSize(
                demux.videoTrack.codec.toLowerCase(),
                description,
            ) as number;

            const sample = demux.videoSamples[0];
            const data = new Uint8Array(sample.data);
            const fromHeuristic = (processor as any).detectNalLengthSizeFromSample(data) as number;

            expect(fromHeuristic).toBe(fromDescription);
        });
    });

    // ── Keyframe detection ──────────────────────────────────────────
    describe('Keyframe detection (H.265 IRAP)', () => {
        it('createKeyframeDetector should return a function', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer;

            const detector = (processor as any).createKeyframeDetector(
                demux.videoTrack.codec,
                description,
            ) as (sample: any) => boolean;

            expect(typeof detector).toBe('function');
        });

        it('should detect at least one keyframe among the extracted samples', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer;

            const detector = (processor as any).createKeyframeDetector(
                demux.videoTrack.codec,
                description,
            ) as (sample: any) => boolean;

            const hasKeyframe = demux.videoSamples.some((s) => detector(s));
            expect(hasKeyframe).toBe(true);
        });

        it('should detect keyframe via NAL parsing even when is_rap is false', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const description = (processor as any).extractCodecDescriptionFromMp4box(
                demux.mp4boxfile,
                demux.videoTrack.id,
                demux.videoTrack.codec,
            ) as ArrayBuffer;

            const detector = (processor as any).createKeyframeDetector(
                demux.videoTrack.codec,
                description,
            ) as (sample: any) => boolean;

            // Override is_rap to false on all samples and check NAL-based detection
            const samplesWithoutRap = demux.videoSamples.map((s) => ({
                ...s,
                is_rap: false,
            }));

            const nalKeyframes = samplesWithoutRap.filter((s) => detector(s));
            // DJI long-GOP HEVC uses CRA/BLA rather than IDR, which MP4Box
            // may not flag as is_rap. Our IRAP detection must find at least
            // one such frame.
            expect(nalKeyframes.length).toBeGreaterThan(0);
        });

        it('isNalKeyframe should recognise H.265 IRAP NAL types 16–21', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            // H.265 NAL header: nalType is ((header >> 1) & 0x3F)
            // BLA_W_LP = 16, BLA_W_RADL = 17, BLA_N_LP = 18, IDR_W_RADL = 19, IDR_N_LP = 20, CRA = 21
            for (let nalType = 16; nalType <= 21; nalType++) {
                const header = (nalType << 1) & 0xff;
                const result = (processor as any).isNalKeyframe(header, false, true);
                expect(result).toBe(true);
            }

            // Non-IRAP types should return false
            for (const nalType of [0, 1, 8, 15, 22, 32, 40]) {
                const header = (nalType << 1) & 0xff;
                const result = (processor as any).isNalKeyframe(header, false, true);
                expect(result).toBe(false);
            }
        });

        it('isNalKeyframe should recognise H.264 IDR (NAL type 5)', () => {
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            // H.264 NAL header: nalType = header & 0x1F
            const idrHeader = 0x65; // NAL type 5
            expect((processor as any).isNalKeyframe(idrHeader, true, false)).toBe(true);

            const nonIdrHeader = 0x61; // NAL type 1
            expect((processor as any).isNalKeyframe(nonIdrHeader, true, false)).toBe(false);
        });
    });

    // ── demuxSamples full pipeline ──────────────────────────────────
    describe('Full demux pipeline via appendFileToMp4box', () => {
        it('should work with File API (same path as production code)', async () => {
            const file = new File([fileBuffer], 'DJI_20260211092425_0002_D.MP4', {
                type: 'video/mp4',
            });

            const mp4boxfile = createSafeMP4BoxFile();
            const videoSamples: any[] = [];
            let videoTrack: any;

            const result = await new Promise<{ track: any; samples: any[] }>(
                (resolve, reject) => {
                    mp4boxfile.onError = reject;

                    mp4boxfile.onReady = (info: any) => {
                        videoTrack = info.tracks?.find((t: any) => t.video);
                        if (!videoTrack) {
                            reject(new Error('No video track'));
                            return;
                        }
                        mp4boxfile.setExtractionOptions(videoTrack.id, null, {
                            nbSamples: 1,
                            rapAlignement: false,
                        });
                        mp4boxfile.start();
                    };

                    mp4boxfile.onSamples = (
                        id: number,
                        _user: unknown,
                        samples: any[],
                    ) => {
                        if (videoTrack && id === videoTrack.id) {
                            videoSamples.push(...samples);
                        }
                    };

                    appendFileToMp4box(mp4boxfile, file)
                        .then(() => {
                            mp4boxfile.flush();
                            resolve({ track: videoTrack, samples: videoSamples });
                        })
                        .catch(reject);
                },
            );

            expect(result.track).toBeDefined();
            expect(result.track.codec.toLowerCase()).toMatch(/^hvc1/);
            expect(result.samples.length).toBeGreaterThan(0);
        }, 60_000);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// Load tests
// ═══════════════════════════════════════════════════════════════════════

describeWithFile('DJI Osmo Pocket 3 — Load tests', () => {
    let fileBuffer: ArrayBuffer;

    beforeAll(() => {
        const raw = fs.readFileSync(DJI_FILE_PATH);
        fileBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    });

    it('should parse 64 MB DJI file within 30 seconds', async () => {
        const start = performance.now();
        const result = await demuxFile(fileBuffer);
        const elapsed = performance.now() - start;

        expect(result.videoSamples.length).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(30_000);

        console.log(`[load] Parse time: ${elapsed.toFixed(0)} ms`);
        console.log(`[load] Video samples: ${result.videoSamples.length}`);
        console.log(`[load] Audio samples: ${result.audioSamples.length}`);
    }, 60_000);

    it('should extract codec description consistently over 5 sequential parses', async () => {
        const descriptions: ArrayBuffer[] = [];

        for (let i = 0; i < 5; i++) {
            const result = await demuxFile(fileBuffer);
            const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
            const processor = createTestProcessor(file);

            const desc = (processor as any).extractCodecDescriptionFromMp4box(
                result.mp4boxfile,
                result.videoTrack.id,
                result.videoTrack.codec,
            ) as ArrayBuffer;

            expect(desc).toBeDefined();
            descriptions.push(desc);
        }

        // All extractions should produce identical results
        const reference = new Uint8Array(descriptions[0]!);
        for (let i = 1; i < descriptions.length; i++) {
            const current = new Uint8Array(descriptions[i]!);
            expect(current.length).toBe(reference.length);
            for (let j = 0; j < reference.length; j++) {
                expect(current[j]).toBe(reference[j]);
            }
        }
    }, 120_000);

    it('should run keyframe detection across all samples without error', async () => {
        const result = await demuxFile(fileBuffer);
        const file = new File([fileBuffer], 'test.mp4', { type: 'video/mp4' });
        const processor = createTestProcessor(file);

        const description = (processor as any).extractCodecDescriptionFromMp4box(
            result.mp4boxfile,
            result.videoTrack.id,
            result.videoTrack.codec,
        ) as ArrayBuffer;

        const detector = (processor as any).createKeyframeDetector(
            result.videoTrack.codec,
            description,
        ) as (sample: any) => boolean;

        const start = performance.now();
        let keyframeCount = 0;

        for (const sample of result.videoSamples) {
            const isKey = detector(sample);
            if (isKey) keyframeCount++;
        }

        const elapsed = performance.now() - start;

        console.log(`[load] Keyframe detection: ${elapsed.toFixed(0)} ms for ${result.videoSamples.length} samples`);
        console.log(`[load] Keyframes found: ${keyframeCount} / ${result.videoSamples.length}`);

        expect(keyframeCount).toBeGreaterThan(0);
        // Keyframe detection across all samples should be fast (< 1s)
        expect(elapsed).toBeLessThan(1_000);
    }, 60_000);

    it('should handle chunk sizes from 256 KB to 4 MB without failure', async () => {
        const chunkSizes = [256 * 1024, 512 * 1024, 1024 * 1024, 2 * 1024 * 1024, 4 * 1024 * 1024];

        for (const chunkSize of chunkSizes) {
            const mp4boxfile = createSafeMP4BoxFile();
            let trackFound = false;

            await new Promise<void>((resolve, reject) => {
                mp4boxfile.onError = reject;
                mp4boxfile.onReady = (info: any) => {
                    const vt = info.tracks?.find((t: any) => t.video);
                    if (vt) trackFound = true;
                };

                try {
                    feedBufferToMp4box(mp4boxfile, fileBuffer, chunkSize);
                    mp4boxfile.flush();
                } catch (err) {
                    reject(err);
                    return;
                }
                resolve();
            });

            expect(trackFound).toBe(true);
        }
    }, 60_000);
});
