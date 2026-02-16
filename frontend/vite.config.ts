import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(),
  // dev-only middleware: return dynamic robots/sitemap using SITE_URL env var
  {
    name: 'dev-runtime-sitefiles',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          const url = req.url || '';
          const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
          if (url === '/robots.txt') {
            const robots = `# robots.txt — generated at runtime\nUser-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n\nCrawl-delay: 1\n\nDisallow: /node_modules/\nDisallow: /*.js$\nDisallow: /*.ts$\nDisallow: /test-results/\nDisallow: /coverage/\n`;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(robots);
            return;
          }
          if (url === '/sitemap.xml') {
            const today = new Date().toISOString().slice(0, 10);
            const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n  <url>\n    <loc>${siteUrl}/preview</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n  <url>\n    <loc>${siteUrl}/processing</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n  <url>\n    <loc>${siteUrl}/result</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>`;
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.end(sitemap);
            return;
          }
          if (url === '/site-config.js') {
            const js = `window.__SITE_URL__ = "${siteUrl}";`;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.end(js);
            return;
          }
        } catch (err) {
          // fall through to normal dev server handling
        }
        next();
      });
    },
  },
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), microphone=()',
    },
    // Serve robots.txt and sitemap.xml dynamically in dev so SITE_URL can change without rebuild
    middlewareMode: false,
  },

  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'src/__tests__/pace-real-gpx-regression.test.ts',
      '**/e2e/**',
      '**/e2e',
    ],
    coverage: {
      provider: 'v8',
      exclude: [],
    },
  },
})
