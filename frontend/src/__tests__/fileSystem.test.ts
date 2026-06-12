/**
 * Unit tests for BrowserFileSystem.
 *
 * Tests interface contract and method signatures.
 * Functional IndexedDB round-trip behavior requires a real browser environment
 * and is validated in E2E tests.
 */
import { describe, it, expect } from 'vitest';
import { BrowserFileSystem, type FileSystemInterface } from '../modules/fileSystem';

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
    it('should create an instance', () => {
        const fs = new BrowserFileSystem();
        expect(fs).toBeInstanceOf(BrowserFileSystem);
    });

    it('should be usable as FileSystemInterface', () => {
        const fs: FileSystemInterface = new BrowserFileSystem();
        expect(fs).toBeDefined();
    });
});
