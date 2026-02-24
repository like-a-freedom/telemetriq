/**
 * Unit tests for file validation module.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
    validateVideoFile,
    isWebCodecsSupported,
    isSharedArrayBufferSupported,
    checkBrowserCapabilities,
} from '../modules/fileValidation';

function createFileWithSize(size: number, name = 'test.mp4', type = 'video/mp4'): File {
    const file = new File([new ArrayBuffer(1)], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
}

describe('file-validation', () => {
    describe('validateVideoFile', () => {
        it('should accept valid MP4 file', () => {
            const file = new File([new ArrayBuffer(1000)], 'test.mp4', { type: 'video/mp4' });
            const result = validateVideoFile(file);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should accept valid MOV file', () => {
            const file = new File([new ArrayBuffer(1000)], 'test.MOV', { type: 'video/quicktime' });
            const result = validateVideoFile(file);

            expect(result.valid).toBe(true);
        });

        it('should reject unsupported extension', () => {
            const file = new File([new ArrayBuffer(1000)], 'test.avi', { type: 'video/x-msvideo' });
            const result = validateVideoFile(file);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Unsupported format'))).toBe(true);
        });

        it('should reject oversized file', () => {
            const largeSize = 5 * 1024 * 1024 * 1024; // 5 GB
            const file = createFileWithSize(largeSize);
            const result = validateVideoFile(file);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('too large'))).toBe(true);
        });

        it('should reject empty file', () => {
            const file = new File([], 'empty.mp4', { type: 'video/mp4' });
            const result = validateVideoFile(file);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('File is empty');
        });

        it('should warn on non-standard MIME type', () => {
            const file = new File([new ArrayBuffer(1000)], 'test.mp4', { type: 'application/octet-stream' });
            const result = validateVideoFile(file);

            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('Non-standard MIME type'))).toBe(true);
        });

        it('should handle missing file extension', () => {
            const file = new File([new ArrayBuffer(1000)], 'noextension', { type: 'video/mp4' });
            const result = validateVideoFile(file);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Unsupported format'))).toBe(true);
        });

        it('should accept file at exactly 4GB limit', () => {
            const maxSize = 4 * 1024 * 1024 * 1024; // 4 GB
            const file = createFileWithSize(maxSize);
            const result = validateVideoFile(file);

            expect(result.valid).toBe(true);
        });
    });

    describe('browser capabilities', () => {
        const originalVideoDecoder = (globalThis as any).VideoDecoder;
        const originalVideoEncoder = (globalThis as any).VideoEncoder;
        const originalVideoFrame = (globalThis as any).VideoFrame;
        const originalSharedArrayBuffer = (globalThis as any).SharedArrayBuffer;
        const originalOffscreenCanvas = (globalThis as any).OffscreenCanvas;

        afterEach(() => {
            (globalThis as any).VideoDecoder = originalVideoDecoder;
            (globalThis as any).VideoEncoder = originalVideoEncoder;
            (globalThis as any).VideoFrame = originalVideoFrame;
            (globalThis as any).SharedArrayBuffer = originalSharedArrayBuffer;
            (globalThis as any).OffscreenCanvas = originalOffscreenCanvas;
        });

        it('isWebCodecsSupported should return true when all APIs exist', () => {
            (globalThis as any).VideoDecoder = class { };
            (globalThis as any).VideoEncoder = class { };
            (globalThis as any).VideoFrame = class { };

            expect(isWebCodecsSupported()).toBe(true);
        });

        it('isWebCodecsSupported should return false when one API is missing', () => {
            (globalThis as any).VideoDecoder = class { };
            (globalThis as any).VideoEncoder = class { };
            (globalThis as any).VideoFrame = undefined;

            expect(isWebCodecsSupported()).toBe(false);
        });

        it('isSharedArrayBufferSupported should reflect runtime', () => {
            (globalThis as any).SharedArrayBuffer = class { };
            expect(isSharedArrayBufferSupported()).toBe(true);

            (globalThis as any).SharedArrayBuffer = undefined;
            expect(isSharedArrayBufferSupported()).toBe(false);
        });

        it('checkBrowserCapabilities should report all missing features', () => {
            (globalThis as any).VideoDecoder = undefined;
            (globalThis as any).VideoEncoder = undefined;
            (globalThis as any).VideoFrame = undefined;
            (globalThis as any).SharedArrayBuffer = undefined;
            (globalThis as any).OffscreenCanvas = undefined;

            const result = checkBrowserCapabilities();

            expect(result.supported).toBe(false);
            expect(result.missing).toContain('WebCodecs API');
            expect(result.missing).toContain('SharedArrayBuffer');
            expect(result.missing).toContain('OffscreenCanvas');
        });

        it('checkBrowserCapabilities should pass when all features exist', () => {
            (globalThis as any).VideoDecoder = class { };
            (globalThis as any).VideoEncoder = class { };
            (globalThis as any).VideoFrame = class { };
            (globalThis as any).SharedArrayBuffer = class { };
            (globalThis as any).OffscreenCanvas = class { };

            const result = checkBrowserCapabilities();

            expect(result.supported).toBe(true);
            expect(result.missing).toHaveLength(0);
        });
    });
});
