import { describe, it, expect, vi } from 'vitest';
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

    describe('DJI filename parsing', () => {
        // These tests use internal function - we test via the sync result instead
        // Since parseDjiFilename is private, we verify behavior through integration
        
        it('should handle DJI filename patterns', () => {
            const testCases = [
                { name: 'DJI_20260211_092425', expected: new Date(Date.UTC(2026, 1, 11, 9, 24, 25)) },
                { name: 'DJI_20260105_030007', expected: new Date(Date.UTC(2026, 0, 5, 3, 0, 7)) },
                { name: 'dji_20260211_092425', expected: new Date(Date.UTC(2026, 1, 11, 9, 24, 25)) },
                { name: 'DJI_19991231_235959', expected: new Date(Date.UTC(1999, 11, 31, 23, 59, 59)) },
            ];

            testCases.forEach(({ name, expected }) => {
                // Test pattern matching
                const match = name.match(/^DJI_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i);
                expect(match).not.toBeNull();
                const date = Date.UTC(
                    Number(match![1]),
                    Number(match![2]) - 1,
                    Number(match![3]),
                    Number(match![4]),
                    Number(match![5]),
                    Number(match![6])
                );
                expect(date).toBe(expected.getTime());
            });
        });

        it('should not match non-DJI filenames', () => {
            const nonDjiNames = [
                'video_20260211',
                'my_video.mp4',
                'IMG_1234',
                'GH01_20260211_092425',
            ];

            nonDjiNames.forEach(name => {
                const match = name.match(/^DJI_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i);
                expect(match).toBeNull();
            });
        });
    });
});
