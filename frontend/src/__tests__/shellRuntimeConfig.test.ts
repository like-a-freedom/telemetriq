import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(TEST_DIR, '../..');

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

    it('references required shell assets from index.html', () => {
        const indexHtml = readFrontendFile('index.html');

        // index.html must reference the core shell assets
        for (const asset of ['favicon.svg', 'site.webmanifest', 'llms.txt']) {
            expect(indexHtml).toContain(`/${asset}`);
        }

        // Verify that the public shell assets are structurally sound
        // (these files are shipped alongside the app shell and validated by the production build).
        for (const publicFile of ['public/site.webmanifest', 'public/llms.txt']) {
            if (!fs.existsSync(path.join(FRONTEND_DIR, publicFile))) {
                continue;
            }
            const content = readFrontendFile(publicFile);
            if (publicFile === 'public/site.webmanifest') {
                const manifest = JSON.parse(content) as { icons?: Array<{ src: string }> };
                expect(manifest.icons?.length).toBeGreaterThan(0);
                for (const icon of manifest.icons ?? []) {
                    expect(icon.src).toBeTruthy();
                }
            }
            if (publicFile === 'public/llms.txt') {
                expect(content).toContain('# Telemetriq');
            }
        }
    });
});
