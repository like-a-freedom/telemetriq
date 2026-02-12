import { describe, it, expect } from 'vitest';
import {
    AppError,
    ValidationError,
    ParseError,
    SyncError,
    ProcessingError,
    MemoryError,
} from '../core/errors';

describe('Error Hierarchy', () => {
    it('AppError should have code and message', () => {
        const err = new AppError('test message', 'TEST_CODE', { key: 'value' });
        expect(err.message).toBe('test message');
        expect(err.code).toBe('TEST_CODE');
        expect(err.details).toEqual({ key: 'value' });
        expect(err.name).toBe('AppError');
        expect(err).toBeInstanceOf(Error);
    });

    it('ValidationError should extend AppError', () => {
        const err = new ValidationError('invalid file');
        expect(err).toBeInstanceOf(AppError);
        expect(err).toBeInstanceOf(Error);
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.name).toBe('ValidationError');
    });

    it('ParseError should extend AppError', () => {
        const err = new ParseError('invalid GPX');
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('PARSE_ERROR');
        expect(err.name).toBe('ParseError');
    });

    it('SyncError should extend AppError', () => {
        const err = new SyncError('sync failed');
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('SYNC_ERROR');
    });

    it('ProcessingError should extend AppError', () => {
        const err = new ProcessingError('processing failed');
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('PROCESSING_ERROR');
    });

    it('MemoryError should extend AppError', () => {
        const err = new MemoryError('out of memory');
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('MEMORY_ERROR');
    });

    it('all errors should capture stack trace', () => {
        const err = new ValidationError('test');
        expect(err.stack).toBeDefined();
        expect(err.stack).toContain('ValidationError');
    });
});
