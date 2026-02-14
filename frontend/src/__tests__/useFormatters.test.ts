import { describe, it, expect } from 'vitest';
import { useFormatters } from '../composables/useFormatters';

describe('useFormatters', () => {
    const { formatDuration, formatFileSize } = useFormatters();

    describe('formatDuration', () => {
        it('should format seconds to mm:ss', () => {
            expect(formatDuration(0)).toBe('0:00');
            expect(formatDuration(30)).toBe('0:30');
            expect(formatDuration(60)).toBe('1:00');
            expect(formatDuration(90)).toBe('1:30');
            expect(formatDuration(125)).toBe('2:05');
            expect(formatDuration(3661)).toBe('61:01');
        });

        it('should pad seconds with leading zero', () => {
            expect(formatDuration(5)).toBe('0:05');
            expect(formatDuration(10)).toBe('0:10');
            expect(formatDuration(65)).toBe('1:05');
        });

        it('should round seconds correctly', () => {
            expect(formatDuration(1.4)).toBe('0:01');
            expect(formatDuration(1.5)).toBe('0:02');
            expect(formatDuration(1.6)).toBe('0:02');
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes', () => {
            expect(formatFileSize(0)).toBe('0 B');
            expect(formatFileSize(100)).toBe('100 B');
            expect(formatFileSize(1023)).toBe('1023 B');
        });

        it('should format kilobytes', () => {
            expect(formatFileSize(1024)).toBe('1.0 KB');
            expect(formatFileSize(1536)).toBe('1.5 KB');
            expect(formatFileSize(10240)).toBe('10.0 KB');
            expect(formatFileSize(1048575)).toBe('1024.0 KB');
        });

        it('should format megabytes', () => {
            expect(formatFileSize(1048576)).toBe('1.0 MB');
            expect(formatFileSize(5242880)).toBe('5.0 MB');
            expect(formatFileSize(1073741823)).toBe('1024.0 MB');
        });

        it('should format gigabytes', () => {
            expect(formatFileSize(1073741824)).toBe('1.00 GB');
            expect(formatFileSize(5368709120)).toBe('5.00 GB');
            expect(formatFileSize(1099511627776)).toBe('1024.00 GB');
        });

        it('should handle edge cases', () => {
            expect(formatFileSize(1)).toBe('1 B');
            expect(formatFileSize(1023)).toBe('1023 B');
            expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB');
        });
    });
});
