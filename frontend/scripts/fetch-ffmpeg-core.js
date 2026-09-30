import { createHash } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const coreVersion = '0.12.10';
const coreBaseUrl = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${coreVersion}/dist/esm`;
const destination = join(import.meta.dir, '../.cache/ffmpeg-core');
const assets = [
    {
        name: 'ffmpeg-core.js',
        sha256: '67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3',
    },
    {
        name: 'ffmpeg-core.wasm',
        sha256: '9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7',
    },
];

const downloaded = await Promise.all(assets.map(async ({ name, sha256 }) => {
    const response = await fetch(`${coreBaseUrl}/${name}`);
    if (!response.ok) {
        throw new Error(`Failed to download ${name}: HTTP ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== sha256) {
        throw new Error(`SHA-256 mismatch for ${name}: expected ${sha256}, received ${actualHash}`);
    }

    return { name, bytes };
}));

await mkdir(destination, { recursive: true });
const tempDirectory = join(destination, `.download-${process.pid}`);
await mkdir(tempDirectory, { recursive: true });

try {
    await Promise.all(downloaded.map(({ name, bytes }) => writeFile(join(tempDirectory, name), bytes)));
    await Promise.all(downloaded.map(({ name }) => rename(join(tempDirectory, name), join(destination, name))));
} finally {
    await rm(tempDirectory, { recursive: true, force: true });
}

console.log(`Fetched and verified @ffmpeg/core@${coreVersion} into the local build cache`);
