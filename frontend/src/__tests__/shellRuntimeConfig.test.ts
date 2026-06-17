import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(TEST_DIR, '../..');
const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');

function readFrontendFile(relativePath: string): string {
    return fs.readFileSync(path.join(FRONTEND_DIR, relativePath), 'utf-8');
}

describe('production shell runtime config', () => {
    it('routes runtime config before SPA fallback and disables caching for app shell', () => {
        const caddyfile = readFrontendFile('Caddyfile');

        const routeIndex = caddyfile.indexOf('route {');
        const siteConfigIndex = caddyfile.indexOf('handle /site-config.js');
        const appShellMatcherIndex = caddyfile.indexOf('@appShell path / /index.html /preview /processing /result');
        const existingFilesIndex = caddyfile.indexOf('@existingFiles file');

        expect(routeIndex).toBeGreaterThan(-1);
        expect(siteConfigIndex).toBeGreaterThan(routeIndex);
        expect(appShellMatcherIndex).toBeGreaterThan(siteConfigIndex);
        expect(existingFilesIndex).toBeGreaterThan(appShellMatcherIndex);
        expect(caddyfile).toContain('header Cache-Control "no-store, no-cache, must-revalidate"');
        expect(caddyfile).toContain('handle @existingFiles');
        expect(caddyfile).not.toContain('\n    try_files {path} /index.html\n');
    });

    it('ships the public shell assets referenced by index.html', () => {
        const indexHtml = readFrontendFile('index.html');
        const requiredAssets = ['favicon.svg', 'site.webmanifest', 'llms.txt'];

        for (const asset of requiredAssets) {
            expect(indexHtml).toContain(`/${asset}`);
            expect(fs.existsSync(path.join(PUBLIC_DIR, asset))).toBe(true);
        }

        const manifest = JSON.parse(readFrontendFile('public/site.webmanifest')) as {
            icons?: Array<{ src: string }>;
        };

        expect(manifest.icons?.length).toBeGreaterThan(0);
        for (const icon of manifest.icons ?? []) {
            expect(fs.existsSync(path.join(PUBLIC_DIR, icon.src.replace(/^\//, '')))).toBe(true);
        }

        expect(readFrontendFile('public/llms.txt')).toContain('# Telemetriq');
    });
});
