/* eslint-disable no-console */
// generate-site-files.cjs — NO-OP
// Site files (robots.txt / sitemap.xml) are now served dynamically at runtime by the server (Caddy/Vite).
// This script is intentionally a no-op to avoid producing static copies that could conflict with runtime behavior.
console.warn('generate-site-files.cjs is a no-op — site files are generated dynamically at runtime');
