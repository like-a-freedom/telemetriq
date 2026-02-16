/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createDemuxer } from '../modules/demuxer';

const IPHONE_FILE_PATH = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../../test_data/iphone/iphone-16-pro-max.MOV',
);

const FILE_EXISTS = fs.existsSync(IPHONE_FILE_PATH);
const describeWithFile = FILE_EXISTS ? describe : describe.skip;

describeWithFile('iPhone 16 Pro Max MOV integration', () => {
    it('should parse video samples even when audio codec is unsupported (apac)', async () => {
        const raw = fs.readFileSync(IPHONE_FILE_PATH);
        const fileBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        const file = new File([fileBuffer], 'iphone-16-pro-max.MOV', { type: 'video/quicktime' });

        const demuxer = createDemuxer();
        const demuxed = await demuxer.demux(file);

        expect(demuxed.videoTrack.codec).toBeTruthy();
        expect([0, 90, 180, 270]).toContain(demuxed.videoTrack.rotation ?? 0);
        expect(demuxed.videoSamples.length).toBeGreaterThan(0);
        // Audio may be absent if the track codec is unsupported by Mediabunny.
        expect(Array.isArray(demuxed.audioSamples)).toBe(true);
    }, 120_000);
});
