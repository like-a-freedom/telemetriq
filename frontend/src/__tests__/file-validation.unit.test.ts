/**
 * Unit tests for file validation module.
 */
import { describe, it, expect } from 'vitest';
import { validateVideoFile } from '../modules/file-validation';

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
});
