declare module 'bun:test' {
    export function test(name: string, fn: () => void | Promise<void>, timeout?: number): void;
    export function expect<T>(value: T): {
        toBe(expected: T): void;
    };
}

declare const Bun: {
    spawnSync(options: {
        cmd: string[];
        cwd?: string;
        stdout?: 'pipe' | 'inherit' | 'ignore';
        stderr?: 'pipe' | 'inherit' | 'ignore';
        env?: NodeJS.ProcessEnv;
    }): {
        exitCode: number;
        stdout: Uint8Array;
        stderr: Uint8Array;
    };
};

interface ImportMeta {
    readonly dir: string;
}
