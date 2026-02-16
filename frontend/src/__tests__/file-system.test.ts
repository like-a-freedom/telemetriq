/**
 * Unit tests for BrowserFileSystem (IndexedDB file storage).
 *
 * Note: These tests verify the interface contract. Full IndexedDB functionality
 * is tested in E2E tests with a real browser environment.
 */
import { describe, it, expect } from 'vitest';
import { BrowserFileSystem, type FileSystemInterface } from '../modules/file-system';

describe('FileSystemInterface', () => {
    it('should define the required interface methods', () => {
        const fs: FileSystemInterface = new BrowserFileSystem();

        // Verify all interface methods are defined
        expect(typeof fs.writeFile).toBe('function');
        expect(typeof fs.readFile).toBe('function');
        expect(typeof fs.deleteFile).toBe('function');
        expect(typeof fs.listFiles).toBe('function');
    });

    it('should have correct method signatures', () => {
        const fs: FileSystemInterface = new BrowserFileSystem();

        // Method signatures should accept correct parameters
        expect(fs.writeFile.length).toBe(2); // key: string, data: Blob
        expect(fs.readFile.length).toBe(1); // key: string
        expect(fs.deleteFile.length).toBe(1); // key: string
        expect(fs.listFiles.length).toBe(0); // no parameters
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
