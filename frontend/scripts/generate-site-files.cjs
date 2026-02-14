/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

// Prefer SITE_URL, fall back to VITE_SITE_URL, then default
const SITE_URL = process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://telemetriq.app';

if (!SITE_URL) {
    console.error('SITE_URL is not set. Please set SITE_URL environment variable.');
    process.exit(1);
}

const publicDir = path.resolve(__dirname, '..', 'public');

// robots.txt
const robots = `# https://www.robotstxt.org/robotstxt.html\nUser-agent: *\nAllow: /\n\n# Sitemap\nSitemap: ${SITE_URL.replace(/\/$/, '')}/sitemap.xml\n\n# Crawl-delay for respectful crawling\nCrawl-delay: 1\n\n# Block common non-SEO paths\nDisallow: /node_modules/\nDisallow: /*.js$\nDisallow: /*.ts$\nDisallow: /test-results/\nDisallow: /coverage/\n`;

// sitemap.xml - update host for each route
const today = new Date().toISOString().slice(0, 10);
const pages = ['/', '/preview', '/processing', '/result'];
const sitemapEntries = pages
    .map((p) => `  <url>\n    <loc>${SITE_URL.replace(/\/$/, '')}${p}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`)
    .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;

try {
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots, 'utf8');
    console.log('Wrote public/robots.txt');

    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8');
    console.log('Wrote public/sitemap.xml');
} catch (err) {
    console.error('Failed to write site files:', err);
    process.exit(1);
}
