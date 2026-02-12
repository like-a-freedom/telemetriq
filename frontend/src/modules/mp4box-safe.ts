/**
 * Safe MP4Box wrapper.
 *
 * MP4Box.js crashes on non-ASCII box types such as `©dji`, `©nam`, `©ART`, etc.
 * These are standard QuickTime/Apple metadata atoms widely used by DJI, GoPro, and
 * other camera manufacturers.  The library's `parseOneBox` rejects any 4CC whose
 * bytes fall outside `\x20-\x7E`, then `buildTrakSampleLists` accesses
 * `trak.mdia.minf.stbl.stco` on an incompletely-parsed track and throws
 * `TypeError: Cannot read properties of undefined (reading 'stco')`.
 *
 * This module provides `createSafeMP4BoxFile()` with two safety layers:
 * 1) Runtime-safe 4CC decoding: non-ASCII bytes in 4CC box types are mapped to
 *    '?' so MP4Box treats them as unknown boxes instead of aborting parsing.
 * 2) Instance-level guard: `buildTrakSampleLists` skips incomplete tracks to
 *    prevent crashes when some metadata boxes are malformed.
 */
import * as MP4Box from 'mp4box';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyMP4BoxFile = any;
let dataStreamPatched = false;
let sampleListGuardPatched = false;
const DEFAULT_CHUNK_SIZE = 1024 * 1024;

function hasSafeSampleTable(trak: any): boolean {
    const stbl = trak?.mdia?.minf?.stbl;
    if (!stbl) return false;

    const hasChunkOffsets = !!stbl.stco || !!stbl.co64;
    if (!hasChunkOffsets) return false;

    if (!stbl.stsc || !stbl.stsz || !stbl.stts) return false;

    return true;
}

function initSkippedTrackState(trak: any): void {
    trak.samples = trak.samples ?? [];
    trak.samples_duration = trak.samples_duration ?? 0;
    trak.samples_size = trak.samples_size ?? 0;
}

function ensureSafeSampleListGuard(): void {
    if (sampleListGuardPatched) return;

    const isoFileProto = (MP4Box as unknown as { ISOFile?: { prototype?: any } }).ISOFile?.prototype;
    const original = isoFileProto?.buildTrakSampleLists as ((trak: any) => void) | undefined;

    if (!isoFileProto || typeof original !== 'function') return;

    isoFileProto.buildTrakSampleLists = function buildTrakSampleListsSafe(trak: any): void {
        if (!hasSafeSampleTable(trak)) {
            console.warn(
                '[mp4box-safe] Skipping track with incomplete sample table – '
                + 'this is normal for files containing non-standard metadata atoms (e.g. ©dji)',
            );
            initSkippedTrackState(trak);
            return;
        }

        try {
            original.call(this, trak);
        } catch (error) {
            console.warn('[mp4box-safe] buildTrakSampleLists failed for a track, skipping', error);
            initSkippedTrackState(trak);
        }
    };

    sampleListGuardPatched = true;
}

function ensureSafeFourCcDecoding(): void {
    if (dataStreamPatched) return;
    dataStreamPatched = true;

    const dataStream = (MP4Box as unknown as { DataStream?: { prototype?: any } }).DataStream;
    const readString = dataStream?.prototype?.readString as
        | ((length?: number, encoding?: string) => string)
        | undefined;

    if (!readString || !dataStream?.prototype?.mapUint8Array) return;

    dataStream.prototype.readString = function readStringSafe(length?: number, encoding?: string): string {
        if ((encoding === undefined || encoding === 'ASCII') && length === 4) {
            const bytes: Uint8Array = this.mapUint8Array(4);
            let out = '';
            for (const byte of bytes) {
                const safe = byte >= 0x20 && byte <= 0x7e ? byte : 0x3f; // '?'
                out += String.fromCharCode(safe);
            }
            return out;
        }

        return readString.call(this, length, encoding);
    };
}

/**
 * Create a patched MP4Box file instance that does NOT crash on tracks
 * with incomplete sample tables.
 */
export function createSafeMP4BoxFile(): AnyMP4BoxFile {
    ensureSafeFourCcDecoding();
    ensureSafeSampleListGuard();
    const mp4boxfile: AnyMP4BoxFile =
        (MP4Box as unknown as { createFile: () => AnyMP4BoxFile }).createFile();

    const original = mp4boxfile.buildTrakSampleLists?.bind(mp4boxfile) as
        | ((trak: any) => void)
        | undefined;

    if (typeof original === 'function') {
        mp4boxfile.buildTrakSampleLists = (trak: any): void => {
            if (!hasSafeSampleTable(trak)) {
                console.warn(
                    '[mp4box-safe] Skipping track with incomplete sample table – '
                    + 'this is normal for files containing non-standard metadata atoms (e.g. ©dji)',
                );
                initSkippedTrackState(trak);
                return;
            }

            try {
                original(trak);
            } catch (error) {
                console.warn('[mp4box-safe] buildTrakSampleLists failed for a track, skipping', error);
                initSkippedTrackState(trak);
            }
        };
    }

    return mp4boxfile;
}

export async function appendFileToMp4box(
    mp4boxfile: AnyMP4BoxFile,
    file: File,
    options?: { chunkSize?: number; signal?: AbortSignal },
): Promise<void> {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const seenOffsets = new Set<number>();
    let offset = 0;

    while (offset < file.size) {
        if (options?.signal?.aborted) {
            throw new Error('Aborted');
        }

        const end = Math.min(offset + chunkSize, file.size);
        const buffer = await file.slice(offset, end).arrayBuffer();
        const ab = buffer as ArrayBuffer & { fileStart?: number };
        ab.fileStart = offset;

        const nextFileStart = mp4boxfile.appendBuffer(ab) as number | undefined;

        if (
            typeof nextFileStart === 'number'
            && nextFileStart !== offset
            && !seenOffsets.has(nextFileStart)
        ) {
            seenOffsets.add(offset);
            offset = nextFileStart;
            continue;
        }

        offset = end;
    }
}
