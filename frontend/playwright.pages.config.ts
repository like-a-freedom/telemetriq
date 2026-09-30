import { defineConfig, devices } from '@playwright/test';

const configuredPath = process.env.PAGES_BASE_PATH || '/telemetriq/';
const appBasePath = configuredPath.endsWith('/') ? configuredPath : `${configuredPath}/`;

export default defineConfig({
    testDir: './e2e',
    testMatch: ['pages-static.spec.ts', 'processing-real.spec.ts'],
    grep: /production Pages:/,
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'bun scripts/preview-pages.js',
        url: `http://127.0.0.1:4173${appBasePath}`,
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
