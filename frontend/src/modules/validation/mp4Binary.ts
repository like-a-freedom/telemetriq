export const MP4_EPOCH_UNIX_OFFSET_SECONDS = 2_082_844_800;

async function extractMp4CreationTimeFromMvhd(file: File): Promise<Date | undefined> {
    if (file.size <= 0) return undefined;

    const headLength = Math.min(file.size, MP4_SCAN_WINDOW_BYTES);
    const head = new Uint8Array(await file.slice(0, headLength).arrayBuffer());
    const fromHead = findMvhdCreationTime(head);
    if (fromHead) return fromHead;

    if (file.size > MP4_SCAN_WINDOW_BYTES) {
        const tailStart = Math.max(0, file.size - MP4_SCAN_WINDOW_BYTES);
        const tail = new Uint8Array(await file.slice(tailStart, file.size).arrayBuffer());
        const fromTail = findMvhdCreationTime(tail);
        if (fromTail) return fromTail;
    }

    return undefined;
}

const MP4_MVHD_TYPE = 'mvhd';
const MP4_SCAN_WINDOW_BYTES = 16 * 1024 * 1024;

function findMvhdCreationTime(bytes: Uint8Array): Date | undefined {
    for (let i = 4; i <= bytes.length - 12; i++) {
        if (!isBoxTypeAt(bytes, i, MP4_MVHD_TYPE)) continue;

        const boxSize = readUInt32BE(bytes, i - 4);
        if (!Number.isFinite(boxSize) || boxSize < 16) continue;

        const boxEnd = (i - 4) + boxSize;
        if (boxEnd > bytes.length) continue;

        const version = bytes[i + 4];
        if (version === 0) {
            const createdSec = readUInt32BE(bytes, i + 8);
            return mp4SecondsToDate(createdSec);
        }

        if (version === 1) {
            const createdSec = readUInt64BEAsNumber(bytes, i + 8);
            if (createdSec === undefined) continue;
            return mp4SecondsToDate(createdSec);
        }
    }

    return undefined;
}

function isBoxTypeAt(bytes: Uint8Array, index: number, type: string): boolean {
    if (index < 0 || index + 3 >= bytes.length || type.length !== 4) return false;

    return bytes[index] === type.charCodeAt(0)
        && bytes[index + 1] === type.charCodeAt(1)
        && bytes[index + 2] === type.charCodeAt(2)
        && bytes[index + 3] === type.charCodeAt(3);
}

function readUInt32BE(bytes: Uint8Array, index: number): number {
    if (index < 0 || index + 3 >= bytes.length) return Number.NaN;

    return ((bytes[index]! * 2 ** 24)
        + (bytes[index + 1]! << 16)
        + (bytes[index + 2]! << 8)
        + bytes[index + 3]!);
}

function readUInt64BEAsNumber(bytes: Uint8Array, index: number): number | undefined {
    if (index < 0 || index + 7 >= bytes.length) return undefined;

    const high = readUInt32BE(bytes, index);
    const low = readUInt32BE(bytes, index + 4);
    if (!Number.isFinite(high) || !Number.isFinite(low)) return undefined;

    return high * 2 ** 32 + low;
}

function mp4SecondsToDate(mp4Seconds: number): Date | undefined {
    if (!Number.isFinite(mp4Seconds) || mp4Seconds <= 0) return undefined;

    const unixSeconds = mp4Seconds - MP4_EPOCH_UNIX_OFFSET_SECONDS;
    if (!Number.isFinite(unixSeconds)) return undefined;

    const date = new Date(unixSeconds * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

export { extractMp4CreationTimeFromMvhd };