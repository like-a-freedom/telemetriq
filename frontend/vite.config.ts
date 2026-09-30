import { defineConfig } from 'vitest/config'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import vue from '@vitejs/plugin-vue'

const configuredBasePath = process.env.VITE_BASE_PATH || '/'
const basePath = configuredBasePath === '/'
  ? '/'
  : `/${configuredBasePath.replace(/^\/+|\/+$/g, '')}/`
const pagesBuild = process.env.PAGES_BUILD === 'true'
const siteUrl = process.env.VITE_SITE_URL || 'https://telemetriq.app'

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [vue() as any,
  {
    name: 'pages-site-config',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!pagesBuild) return html

        const siteRoot = `${siteUrl.replace(/\/$/, '')}${basePath === '/' ? '' : `/${basePath.replace(/^\/+|\/+$/g, '')}`}`
        const assetBase = basePath.endsWith('/') ? basePath : `${basePath}/`
        return html
          .replace(
            /<script id="runtime-site-config">[\s\S]*?<\/script>/,
            `<script>window.__SITE_URL__ = ${JSON.stringify(siteUrl.replace(/\/$/, ''))};</script>`,
          )
          .replaceAll('{site_url}', `${siteRoot}/`)
          .replaceAll('content="/og-image.png"', `content="${assetBase}og-image.png"`)
      },
    },
    async generateBundle() {
      if (!pagesBuild) return

      const coreDirectory = join(import.meta.dirname, '.cache/ffmpeg-core')
      const [core, wasm] = await Promise.all([
        readFile(join(coreDirectory, 'ffmpeg-core.js')),
        readFile(join(coreDirectory, 'ffmpeg-core.wasm')),
      ])

      this.emitFile({ type: 'asset', fileName: 'vendor/ffmpeg/ffmpeg-core.js', source: core })
      this.emitFile({ type: 'asset', fileName: 'vendor/ffmpeg/ffmpeg-core.wasm', source: wasm })
    },
  },
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
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
    },
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
      '**/e2e/**',
      '**/e2e',
    ],
    onConsoleLog(log, type) {
      if (type === 'stderr' && log.includes('--localstorage-file')) {
        return false;
      }
    },
    coverage: {
      provider: 'v8',
      exclude: [],
    },
  },
})
