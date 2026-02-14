#!/usr/bin/env bun
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const sizes = [16, 32, 48, 64, 128, 180, 192, 512];
const publicDir = join(import.meta.dir, '../public');
const svgPath = join(publicDir, 'favicon.svg');

console.log('🎨 Generating favicon PNG versions...\n');

async function generateFavicons() {
    const svgBuffer = readFileSync(svgPath);

    for (const size of sizes) {
        try {
            const pngBuffer = await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toBuffer();

            const filename = size === 192
                ? 'android-chrome-192x192.png'
                : size === 512
                    ? 'android-chrome-512x512.png'
                    : size === 180
                        ? 'apple-touch-icon.png'
                        : `favicon-${size}x${size}.png`;

            writeFileSync(join(publicDir, filename), pngBuffer);
            console.log(`✓ Generated ${filename} (${size}x${size})`);
        } catch (error) {
            console.error(`✗ Failed to generate ${size}x${size}:`, error.message);
        }
    }

    // Generate ICO file (16x16 and 32x32 combined)
    const ico16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
    const ico32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();

    // For ICO, we'll just use the 32x32 version as favicon.ico
    writeFileSync(join(publicDir, 'favicon.ico'), ico32);
    console.log('✓ Generated favicon.ico (32x32)');

    console.log('\n✨ All favicons generated successfully!');
}

generateFavicons().catch(console.error);
