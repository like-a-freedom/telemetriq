import { describe, it, expect } from 'vitest';
import { validateVideoFile } from '../modules/file-validation';

describe('File Validation', () => {
    describe('validateVideoFile', () => {
        it('should accept a valid .mp4 file', () => {
            const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
            const result = validateVideoFile(file);
            expect(result.valid).toBe(true);
        });

        it('should accept a valid .mov file', () => {
            const file = new File(['data'], 'video.mov', { type: 'video/quicktime' });
            const result = validateVideoFile(file);
            expect(result.valid).toBe(true);
        });

        it('should accept a .m4v file', () => {
            const file = new File(['data'], 'video.m4v', { type: 'video/x-m4v' });
            const result = validateVideoFile(file);
            expect(result.valid).toBe(true);
        });

        it('should reject unsupported format', () => {
            const file = new File(['data'], 'video.avi', { type: 'video/avi' });
            const result = validateVideoFile(file);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('.avi');
        });

        it('should reject .webm format', () => {
            const file = new File(['data'], 'video.webm', { type: 'video/webm' });
            const result = validateVideoFile(file);
            expect(result.valid).toBe(false);
        });

        it('should reject empty file', () => {
            const file = new File([], 'video.mp4', { type: 'video/mp4' });
            const result = validateVideoFile(file);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('File is empty');
        });

        it('should add warning for non-standard MIME type', () => {
            const file = new File(['data'], 'video.mp4', { type: 'application/octet-stream' });
            const result = validateVideoFile(file);
            expect(result.valid).toBe(true); // Still valid
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should handle file without type', () => {
            const file = new File(['data'], 'video.mp4');
            const result = validateVideoFile(file);
            expect(result.valid).toBe(true);
        });
    });
});
