/**
 * Unit tests for BrowserFileSystem.
 *
 * Tests interface contract and method signatures.
 * Functional IndexedDB round-trip behavior requires a real browser environment
 * and is validated in E2E tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserFileSystem, type FileSystemInterface } from '../modules/fileSystem';

function createNotFoundError(): Error {
    const error = new Error('Not found');
    error.name = 'NotFoundError';
    return error;
}

describe('FileSystemInterface', () => {
    it('should define the required interface methods', () => {
        const fs: FileSystemInterface = new BrowserFileSystem();

        expect(typeof fs.writeFile).toBe('function');
        expect(typeof fs.readFile).toBe('function');
        expect(typeof fs.deleteFile).toBe('function');
        expect(typeof fs.listFiles).toBe('function');
    });

    it('should have correct method signatures', () => {
        const fs: FileSystemInterface = new BrowserFileSystem();

        expect(fs.writeFile.length).toBe(2);
        expect(fs.readFile.length).toBe(1);
        expect(fs.deleteFile.length).toBe(1);
        expect(fs.listFiles.length).toBe(0);
    });
});

describe('BrowserFileSystem', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should create an instance', () => {
        const fs = new BrowserFileSystem();
        expect(fs).toBeInstanceOf(BrowserFileSystem);
    });

    it('should be usable as FileSystemInterface', () => {
        const fs: FileSystemInterface = new BrowserFileSystem();
        expect(fs).toBeDefined();
    });

    it('stores files in OPFS when navigator.storage.getDirectory is available', async () => {
        const opfsFiles = new Map<string, Blob>();
        const root = {
            async getFileHandle(name: string, options?: { create?: boolean }) {
                if (!options?.create && !opfsFiles.has(name)) {
                    throw createNotFoundError();
                }

                return {
                    name,
                    async createWritable() {
                        return {
                            async write(data: Blob) {
                                opfsFiles.set(name, data);
                            },
                            async close() {
                                return undefined;
                            },
                        };
                    },
                    async getFile() {
                        const blob = opfsFiles.get(name);
                        if (!blob) {
                            throw createNotFoundError();
                        }

                        return new File([blob], name, { type: blob.type });
                    },
                };
            },
            async removeEntry(name: string) {
                if (!opfsFiles.delete(name)) {
                    throw createNotFoundError();
                }
            },
            async *entries() {
                for (const name of opfsFiles.keys()) {
                    yield [name, { kind: 'file', name }];
                }
            },
        };

        vi.stubGlobal('navigator', {
            storage: {
                getDirectory: vi.fn().mockResolvedValue(root),
            },
        });
        vi.stubGlobal('indexedDB', undefined);

        const fs = new BrowserFileSystem();
        const blob = new Blob(['opfs-data'], { type: 'text/plain' });

        await fs.writeFile('processing-result', blob);

        const roundTrip = await fs.readFile('processing-result');
        expect(await roundTrip?.text()).toBe('opfs-data');

        const files = await fs.listFiles();
        expect(files).toContain('processing-result');

        await fs.deleteFile('processing-result');
        await expect(fs.readFile('processing-result')).resolves.toBeNull();
    });
});
