export interface Formatters {
    formatDuration: (seconds: number) => string;
    formatFileSize: (bytes: number) => string;
}

/** Byte size thresholds for formatting */
const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export function useFormatters(): Formatters {
    function formatDuration(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function formatFileSize(bytes: number): string {
        if (bytes < KB) {
            return `${bytes} B`;
        }
        if (bytes < MB) {
            return `${(bytes / KB).toFixed(1)} KB`;
        }
        if (bytes < GB) {
            return `${(bytes / MB).toFixed(1)} MB`;
        }
        return `${(bytes / GB).toFixed(2)} GB`;
    }

    return {
        formatDuration,
        formatFileSize,
    };
}
