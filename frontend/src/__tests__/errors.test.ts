import { describe, it, expect } from 'vitest';
import {
    AppError,
    ValidationError,
    ParseError,
    SyncError,
    ProcessingError,
    MemoryError,
    NotSupportedError,
    FileSystemError,
    CodecError,
    isAppError,
    isValidationError,
    isParseError,
    isSyncError,
    isProcessingError,
    isMemoryError,
    isNotSupportedError,
    isFileSystemError,
    isCodecError,
} from '../core/errors';

describe('Error Hierarchy', () => {
    describe('AppError base class', () => {
        it('should have code, message, and details', () => {
            const err = new ValidationError('test message', { key: 'value' });
            expect(err.message).toBe('test message');
            expect(err.code).toBe('VALIDATION_ERROR');
            expect(err.details).toEqual({ key: 'value' });
            expect(err.name).toBe('ValidationError');
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(AppError);
        });

        it('should freeze details to prevent mutation', () => {
            const err = new ValidationError('test', { key: 'value' });
            expect(() => {
                (err.details as Record<string, unknown>).newKey = 'nope';
            }).toThrow();
        });

        it('should handle undefined details', () => {
            const err = new ValidationError('test');
            expect(err.details).toBeUndefined();
        });

        it('should capture timestamp', () => {
            const before = new Date();
            const err = new ValidationError('test');
            const after = new Date();
            expect(err.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(err.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });

    describe('toJSON', () => {
        it('should serialize error for logging', () => {
            const err = new ParseError('parse failed', { line: 42 });
            const json = err.toJSON();

            expect(json).toEqual({
                name: 'ParseError',
                message: 'parse failed',
                code: 'PARSE_ERROR',
                timestamp: expect.any(String),
            });
            // timestamp should be ISO format
            expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
        });

        it('should not expose details in JSON', () => {
            const err = new ParseError('parse failed', { secret: 'sensitive' });
            const json = err.toJSON();

            expect(json).not.toHaveProperty('details');
            expect(json).not.toHaveProperty('secret');
        });
    });

    describe('all error classes', () => {
        it('ValidationError should have VALIDATION_ERROR code', () => {
            const err = new ValidationError('invalid');
            expect(err.code).toBe('VALIDATION_ERROR');
            expect(err).toBeInstanceOf(AppError);
        });

        it('ParseError should have PARSE_ERROR code', () => {
            const err = new ParseError('parse failed');
            expect(err.code).toBe('PARSE_ERROR');
            expect(err).toBeInstanceOf(AppError);
        });

        it('SyncError should have SYNC_ERROR code', () => {
            const err = new SyncError('sync failed');
            expect(err.code).toBe('SYNC_ERROR');
            expect(err).toBeInstanceOf(AppError);
        });

        it('ProcessingError should have PROCESSING_ERROR code', () => {
            const err = new ProcessingError('processing failed');
            expect(err.code).toBe('PROCESSING_ERROR');
            expect(err).toBeInstanceOf(AppError);
        });

        it('MemoryError should have MEMORY_ERROR code', () => {
            const err = new MemoryError('out of memory');
            expect(err.code).toBe('MEMORY_ERROR');
            expect(err).toBeInstanceOf(AppError);
        });

        it('NotSupportedError should have NOT_SUPPORTED_ERROR code', () => {
            const err = new NotSupportedError('WebGPU not available');
            expect(err.code).toBe('NOT_SUPPORTED_ERROR');
            expect(err).toBeInstanceOf(AppError);
        });

        it('FileSystemError should have FILE_SYSTEM_ERROR code', () => {
            const err = new FileSystemError('IndexedDB unavailable');
            expect(err.code).toBe('FILE_SYSTEM_ERROR');
            expect(err).toBeInstanceOf(AppError);
        });

        it('CodecError should have CODEC_ERROR code', () => {
            const err = new CodecError('encoder failed');
            expect(err.code).toBe('CODEC_ERROR');
            expect(err).toBeInstanceOf(AppError);
        });

        it('all errors should capture stack trace', () => {
            const errors = [
                new ValidationError('a'),
                new ParseError('b'),
                new SyncError('c'),
                new ProcessingError('d'),
                new MemoryError('e'),
                new NotSupportedError('f'),
                new FileSystemError('g'),
                new CodecError('h'),
            ];

            for (const err of errors) {
                expect(err.stack).toBeDefined();
                expect(err.stack).toContain(err.name);
            }
        });
    });

    describe('type guards', () => {
        it('isAppError should return true for AppError subclasses', () => {
            expect(isAppError(new ValidationError('a'))).toBe(true);
            expect(isAppError(new ParseError('a'))).toBe(true);
            expect(isAppError(new SyncError('a'))).toBe(true);
            expect(isAppError(new ProcessingError('a'))).toBe(true);
            expect(isAppError(new MemoryError('a'))).toBe(true);
            expect(isAppError(new NotSupportedError('a'))).toBe(true);
            expect(isAppError(new FileSystemError('a'))).toBe(true);
            expect(isAppError(new CodecError('a'))).toBe(true);
        });

        it('isAppError should return false for plain Error', () => {
            expect(isAppError(new Error('plain'))).toBe(false);
        });

        it('isAppError should return false for non-Error values', () => {
            expect(isAppError(null)).toBe(false);
            expect(isAppError(undefined)).toBe(false);
            expect(isAppError('string')).toBe(false);
            expect(isAppError(42)).toBe(false);
            expect(isAppError({ code: 'FAKE' })).toBe(false);
        });

        it('isValidationError should only match ValidationError', () => {
            expect(isValidationError(new ValidationError('a'))).toBe(true);
            expect(isValidationError(new ParseError('a'))).toBe(false);
            expect(isValidationError(new Error('a'))).toBe(false);
            expect(isValidationError(null)).toBe(false);
        });

        it('isParseError should only match ParseError', () => {
            expect(isParseError(new ParseError('a'))).toBe(true);
            expect(isParseError(new ValidationError('a'))).toBe(false);
            expect(isParseError(null)).toBe(false);
        });

        it('isSyncError should only match SyncError', () => {
            expect(isSyncError(new SyncError('a'))).toBe(true);
            expect(isSyncError(new ValidationError('a'))).toBe(false);
            expect(isSyncError(null)).toBe(false);
        });

        it('isProcessingError should only match ProcessingError', () => {
            expect(isProcessingError(new ProcessingError('a'))).toBe(true);
            expect(isProcessingError(new ValidationError('a'))).toBe(false);
            expect(isProcessingError(null)).toBe(false);
        });

        it('isMemoryError should only match MemoryError', () => {
            expect(isMemoryError(new MemoryError('a'))).toBe(true);
            expect(isMemoryError(new ValidationError('a'))).toBe(false);
            expect(isMemoryError(null)).toBe(false);
        });

        it('isNotSupportedError should only match NotSupportedError', () => {
            expect(isNotSupportedError(new NotSupportedError('a'))).toBe(true);
            expect(isNotSupportedError(new ValidationError('a'))).toBe(false);
            expect(isNotSupportedError(null)).toBe(false);
        });

        it('isFileSystemError should only match FileSystemError', () => {
            expect(isFileSystemError(new FileSystemError('a'))).toBe(true);
            expect(isFileSystemError(new ValidationError('a'))).toBe(false);
            expect(isFileSystemError(null)).toBe(false);
        });

        it('isCodecError should only match CodecError', () => {
            expect(isCodecError(new CodecError('a'))).toBe(true);
            expect(isCodecError(new ValidationError('a'))).toBe(false);
            expect(isCodecError(null)).toBe(false);
        });
    });
});
