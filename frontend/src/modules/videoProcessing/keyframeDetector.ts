/**
 * Keyframe detection utilities for H.264/H.265 video streams.
 * Extracted from video-processor for SRP compliance.
 */

type Mp4Sample = {
    data: ArrayBuffer;
    duration: number;
    dts: number;
    cts: number;
    timescale: number;
    is_rap: boolean;
};

export type { Mp4Sample };

/**
 * Creates a keyframe detector function for a given codec.
 */
export function createKeyframeDetector(
    codec: string,
    description?: AllowSharedBufferSource,
): (sample: Mp4Sample) => boolean {
    const codecLower = codec.toLowerCase();
    const isH264 = codecLower.startsWith('avc1') || codecLower.startsWith('avc3');
    const isH265 = codecLower.startsWith('hvc1') || codecLower.startsWith('hev1');
    const nalLengthSize = getNalLengthSize(codecLower, description);
    let detectedNalLengthSize: number | undefined = nalLengthSize;

    return (sample: Mp4Sample): boolean => {
        if (sample.is_rap) return true;
        const data = new Uint8Array(sample.data);
        if (data.length < 5) return false;

        if (!detectedNalLengthSize) {
            detectedNalLengthSize = detectNalLengthSizeFromSample(data);
        }

        if (detectedNalLengthSize) {
            return containsKeyframeNal(data, detectedNalLengthSize, isH264, isH265);
        }

        return containsAnnexBKeyframe(data, isH264, isH265);
    };
}

/**
 * Detects GOP size from video samples by analyzing RAP (Random Access Point) distribution.
 */
export function detectSourceGopSize(samples: Mp4Sample[], fps: number): number {
    const rapIndexes: number[] = [];
    for (let i = 0; i < samples.length; i += 1) {
        if (samples[i]?.is_rap) rapIndexes.push(i);
        if (rapIndexes.length >= 16) break;
    }

    if (rapIndexes.length >= 3) {
        const deltas: number[] = [];
        for (let i = 1; i < rapIndexes.length; i += 1) {
            const delta = rapIndexes[i]! - rapIndexes[i - 1]!;
            if (delta > 0) deltas.push(delta);
        }
        if (deltas.length > 0) {
            const average = Math.round(deltas.reduce((sum, v) => sum + v, 0) / deltas.length);
            return Math.max(1, Math.min(300, average));
        }
    }

    const fallback = Math.max(1, Math.round(fps / 2));
    return Math.min(300, fallback);
}

// --- Private helpers ---

function getNalLengthSize(codecLower: string, description?: AllowSharedBufferSource): number | undefined {
    if (!description) return undefined;
    const buffer = normalizeToArrayBuffer(description);
    const view = new DataView(buffer);

    if ((codecLower.startsWith('avc1') || codecLower.startsWith('avc3')) && view.byteLength >= 5) {
        const lengthSizeMinusOne = view.getUint8(4) & 0x03;
        return lengthSizeMinusOne + 1;
    }

    if ((codecLower.startsWith('hvc1') || codecLower.startsWith('hev1')) && view.byteLength >= 22) {
        const lengthSizeMinusOne = view.getUint8(21) & 0x03;
        return lengthSizeMinusOne + 1;
    }

    return undefined;
}

function normalizeToArrayBuffer(source: AllowSharedBufferSource): ArrayBuffer {
    if (source instanceof ArrayBuffer) {
        return source;
    }

    if (ArrayBuffer.isView(source)) {
        const bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
        return bytes.slice().buffer;
    }

    return new Uint8Array(source as SharedArrayBuffer).slice().buffer;
}

function detectNalLengthSizeFromSample(data: Uint8Array): number | undefined {
    if (data.length < 5) return undefined;
    const candidateSizes = [4, 3, 2, 1];

    for (const size of candidateSizes) {
        if (data.length <= size) continue;
        let nalSize = 0;
        for (let i = 0; i < size; i += 1) {
            const byte = data[i];
            if (byte === undefined) return undefined;
            nalSize = (nalSize << 8) | byte;
        }

        if (nalSize <= 0 || size + nalSize > data.length) continue;

        const nextOffset = size + nalSize;
        if (nextOffset + size <= data.length) {
            let nextSize = 0;
            for (let i = 0; i < size; i += 1) {
                const byte = data[nextOffset + i];
                if (byte === undefined) return size;
                nextSize = (nextSize << 8) | byte;
            }
            if (nextSize > 0 && nextOffset + size + nextSize <= data.length) {
                return size;
            }
        } else {
            return size;
        }
    }

    return undefined;
}

function containsKeyframeNal(
    data: Uint8Array,
    nalLengthSize: number,
    isH264: boolean,
    isH265: boolean,
): boolean {
    let offset = 0;
    while (offset + nalLengthSize <= data.length) {
        let nalSize = 0;
        for (let i = 0; i < nalLengthSize; i += 1) {
            const byte = data[offset + i];
            if (byte === undefined) return false;
            nalSize = (nalSize << 8) | byte;
        }
        offset += nalLengthSize;
        if (nalSize <= 0 || offset + nalSize > data.length) break;

        const nalHeader = data[offset];
        if (nalHeader !== undefined && isNalKeyframe(nalHeader, isH264, isH265)) return true;

        offset += nalSize;
    }
    return false;
}

function containsAnnexBKeyframe(data: Uint8Array, isH264: boolean, isH265: boolean): boolean {
    let i = 0;
    while (i + 3 < data.length) {
        const isStartCode3 = data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01;
        const isStartCode4 = i + 4 < data.length
            && data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01;
        if (isStartCode3 || isStartCode4) {
            const nalHeaderIndex = i + (isStartCode4 ? 4 : 3);
            if (nalHeaderIndex < data.length) {
                const nalHeader = data[nalHeaderIndex];
                if (nalHeader !== undefined && isNalKeyframe(nalHeader, isH264, isH265)) return true;
            }
            i = nalHeaderIndex;
        } else {
            i += 1;
        }
    }
    return false;
}

function isNalKeyframe(nalHeader: number, isH264: boolean, isH265: boolean): boolean {
    if (isH264) {
        const nalType = nalHeader & 0x1f;
        return nalType === 5;
    }
    if (isH265) {
        const nalType = (nalHeader >> 1) & 0x3f;
        // Treat all IRAP types as random access (BLA 16-18, IDR 19-20, CRA 21)
        return nalType >= 16 && nalType <= 21;
    }
    return false;
}
