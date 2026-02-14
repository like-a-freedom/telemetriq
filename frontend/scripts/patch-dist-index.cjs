/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://telemetriq.app';
const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
    console.warn('dist/index.html not found — skipping patch. Run this after `vite build`.');
    process.exit(0);
}

let html = fs.readFileSync(distIndex, 'utf8');
const normalized = SITE_URL.replace(/\/$/, '') + '/';

// Replace canonical / og:url / twitter:url occurrences that match default value
html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${normalized}" />`);
html = html.replace(/<meta property="twitter:url" content="[^"]*"\s*\/?>/i, `<meta property="twitter:url" content="${normalized}" />`);
html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${normalized}" />`);

fs.writeFileSync(distIndex, html, 'utf8');
console.log('Patched dist/index.html with SITE_URL:', normalized);
