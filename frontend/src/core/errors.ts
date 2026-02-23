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

/** Check if error is an AppError */
export function isAppError(err: unknown): err is AppError {
    return err instanceof Error && 'code' in err && typeof (err as AppError).code === 'string';
}

/** Check if error is a ValidationError */
export function isValidationError(err: unknown): err is ValidationError {
    return err instanceof ValidationError;
}

/** Check if error is a ParseError */
export function isParseError(err: unknown): err is ParseError {
    return err instanceof ParseError;
}

/** Check if error is a SyncError */
export function isSyncError(err: unknown): err is SyncError {
    return err instanceof SyncError;
}

/** Check if error is a ProcessingError */
export function isProcessingError(err: unknown): err is ProcessingError {
    return err instanceof ProcessingError;
}

/** Check if error is a MemoryError */
export function isMemoryError(err: unknown): err is MemoryError {
    return err instanceof MemoryError;
}

/** Check if error is a NotSupportedError */
export function isNotSupportedError(err: unknown): err is NotSupportedError {
    return err instanceof NotSupportedError;
}

/** Check if error is a FileSystemError */
export function isFileSystemError(err: unknown): err is FileSystemError {
    return err instanceof FileSystemError;
}

/** Check if error is a CodecError */
export function isCodecError(err: unknown): err is CodecError {
    return err instanceof CodecError;
}
