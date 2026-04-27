/// <reference path="./bun.d.ts" />

import { expect, test } from 'bun:test';

test('frontend Vitest suite passes', () => {
    const result = Bun.spawnSync({
        cmd: ['bun', 'run', 'test'],
        cwd: `${import.meta.dir}/frontend`,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
            ...process.env,
            FORCE_COLOR: '0',
        },
    });

    const stdout = Buffer.from(result.stdout).toString('utf8');
    const stderr = Buffer.from(result.stderr).toString('utf8');

    if (result.exitCode !== 0) {
        throw new Error(
            `frontend test suite failed with exit code ${result.exitCode}\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`,
        );
    }

    expect(result.exitCode).toBe(0);
}, 120_000);