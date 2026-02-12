/**
 * Tests for keyframe detector module.
 */
import { describe, it, expect } from 'vitest';
import { createKeyframeDetector, detectSourceGopSize, type Mp4Sample } from '../modules/keyframe-detector';

describe('keyframe-detector', () => {
    describe('createKeyframeDetector', () => {
        it('should detect RAP samples as keyframes', () => {
            const detector = createKeyframeDetector('avc1.640028');
            const sample: Mp4Sample = {
                data: new ArrayBuffer(10),
                duration: 1000,
                dts: 0,
                cts: 0,
                timescale: 1_000_000,
                is_rap: true,
            };
            expect(detector(sample)).toBe(true);
        });

        it('should detect keyframe NAL in H.264 Annex-B format', () => {
            const detector = createKeyframeDetector('avc1.640028');
            // Annex-B start code (0x00 0x00 0x01) + NAL header for IDR frame (type 5 = 0x25)
            const data = new Uint8Array([0x00, 0x00, 0x01, 0x25, 0x88, 0x84, 0x00]);
            const sample: Mp4Sample = {
                data: data.buffer,
                duration: 1000,
                dts: 0,
                cts: 0,
                timescale: 1_000_000,
                is_rap: false,
            };
            expect(detector(sample)).toBe(true);
        });

        it('should detect non-keyframe NAL in H.264', () => {
            const detector = createKeyframeDetector('avc1.640028');
            // Annex-B start code + NAL header for non-IDR frame (type 1 = 0x21)
            const data = new Uint8Array([0x00, 0x00, 0x01, 0x21, 0x88, 0x84, 0x00]);
            const sample: Mp4Sample = {
                data: data.buffer,
                duration: 1000,
                dts: 0,
                cts: 0,
                timescale: 1_000_000,
                is_rap: false,
            };
            expect(detector(sample)).toBe(false);
        });

        it('should detect keyframe NAL in H.265', () => {
            const detector = createKeyframeDetector('hvc1.1.6.L153.B0');
            // Annex-B start code + NAL header for IDR_W_RADL (type 19 = 0x26)
            const data = new Uint8Array([0x00, 0x00, 0x01, 0x26, 0x01, 0x00, 0x00]);
            const sample: Mp4Sample = {
                data: data.buffer,
                duration: 1000,
                dts: 0,
                cts: 0,
                timescale: 1_000_000,
                is_rap: false,
            };
            expect(detector(sample)).toBe(true);
        });

        it('should detect CRA keyframe in H.265', () => {
            const detector = createKeyframeDetector('hvc1.1.6.L153.B0');
            // Annex-B start code + NAL header for CRA_NUT (type 21 = 0x2A)
            const data = new Uint8Array([0x00, 0x00, 0x01, 0x2A, 0x01, 0x00, 0x00]);
            const sample: Mp4Sample = {
                data: data.buffer,
                duration: 1000,
                dts: 0,
                cts: 0,
                timescale: 1_000_000,
                is_rap: false,
            };
            expect(detector(sample)).toBe(true);
        });

        it('should return false for small samples', () => {
            const detector = createKeyframeDetector('avc1.640028');
            const sample: Mp4Sample = {
                data: new ArrayBuffer(3),
                duration: 1000,
                dts: 0,
                cts: 0,
                timescale: 1_000_000,
                is_rap: false,
            };
            expect(detector(sample)).toBe(false);
        });

        it('should handle 4-byte start codes', () => {
            const detector = createKeyframeDetector('avc1.640028');
            // 4-byte Annex-B start code (0x00 0x00 0x00 0x01) + NAL header for IDR frame
            const data = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x25, 0x88, 0x84, 0x00]);
            const sample: Mp4Sample = {
                data: data.buffer,
                duration: 1000,
                dts: 0,
                cts: 0,
                timescale: 1_000_000,
                is_rap: false,
            };
            expect(detector(sample)).toBe(true);
        });
    });

    describe('detectSourceGopSize', () => {
        it('should detect GOP size from RAP distribution', () => {
            const samples: Mp4Sample[] = [];
            // Create samples with GOP size of 30
            for (let i = 0; i < 120; i++) {
                samples.push({
                    data: new ArrayBuffer(10),
                    duration: 1000,
                    dts: i * 1000,
                    cts: i * 1000,
                    timescale: 1_000_000,
                    is_rap: i % 30 === 0,
                });
            }
            const gopSize = detectSourceGopSize(samples, 30);
            expect(gopSize).toBe(30);
        });

        it('should fallback to fps/2 when insufficient RAPs', () => {
            const samples: Mp4Sample[] = [];
            // Create samples with only 2 RAPs (insufficient for detection)
            for (let i = 0; i < 10; i++) {
                samples.push({
                    data: new ArrayBuffer(10),
                    duration: 1000,
                    dts: i * 1000,
                    cts: i * 1000,
                    timescale: 1_000_000,
                    is_rap: i === 0 || i === 5,
                });
            }
            const gopSize = detectSourceGopSize(samples, 30);
            expect(gopSize).toBe(15); // fps/2
        });

        it('should cap GOP size at 300', () => {
            const samples: Mp4Sample[] = [];
            // Create samples with very large GOP
            for (let i = 0; i < 500; i++) {
                samples.push({
                    data: new ArrayBuffer(10),
                    duration: 1000,
                    dts: i * 1000,
                    cts: i * 1000,
                    timescale: 1_000_000,
                    is_rap: i === 0 || i === 400,
                });
            }
            const gopSize = detectSourceGopSize(samples, 30);
            expect(gopSize).toBeLessThanOrEqual(300);
        });

        it('should return at least 1', () => {
            const samples: Mp4Sample[] = [];
            const gopSize = detectSourceGopSize(samples, 1);
            expect(gopSize).toBeGreaterThanOrEqual(1);
        });
    });
});
