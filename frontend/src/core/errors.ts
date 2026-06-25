/**
 * Base application error class.
 * All domain errors extend this class.
 */
export abstract class AppError extends Error {
    public readonly code: string;
    public readonly details?: Readonly<Record<string, unknown>>;
    public readonly timestamp: Date;

    constructor(message: string, code: string, details?: Record<string, unknown>) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details ? Object.freeze({ ...details }) : undefined;
        this.timestamp = new Date();
    }

    /** Serialize error for logging without exposing sensitive data */
    toJSON(): { name: string; message: string; code: string; timestamp: string } {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            timestamp: this.timestamp.toISOString(),
        };
    }
}

/** Thrown when file or data validation fails */
export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', details);
    }
}

/** Thrown when GPX/XML parsing fails */
export class ParseError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'PARSE_ERROR', details);
    }
}

/** Thrown when GPS/time synchronization fails */
export class SyncError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'SYNC_ERROR', details);
    }
}

/** Thrown when video processing fails */
export class ProcessingError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'PROCESSING_ERROR', details);
    }
}

/** Thrown when memory limits are exceeded */
export class MemoryError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'MEMORY_ERROR', details);
    }
}

/** Thrown when browser API is not supported */
export class NotSupportedError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'NOT_SUPPORTED_ERROR', details);
    }
}

/** Thrown when file system access fails */
export class FileSystemError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'FILE_SYSTEM_ERROR', details);
    }
}

/** Thrown when codec operations fail */
export class CodecError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'CODEC_ERROR', details);
    }
}

// ── Type guards ──────────────────────────────────────────────────────────

function createErrorTypeGuard<T extends AppError>(ctor: new (...args: any[]) => T): (err: unknown) => err is T {
    return (err: unknown): err is T => err instanceof ctor;
}

/** Check if error is an AppError */
export function isAppError(err: unknown): err is AppError {
    return err instanceof Error && 'code' in err && typeof (err as AppError).code === 'string';
}

export const isValidationError = createErrorTypeGuard(ValidationError);
export const isParseError = createErrorTypeGuard(ParseError);
export const isSyncError = createErrorTypeGuard(SyncError);
export const isProcessingError = createErrorTypeGuard(ProcessingError);
export const isMemoryError = createErrorTypeGuard(MemoryError);
export const isNotSupportedError = createErrorTypeGuard(NotSupportedError);
export const isFileSystemError = createErrorTypeGuard(FileSystemError);
export const isCodecError = createErrorTypeGuard(CodecError);
