/**
 * Base application error class.
 * All domain errors extend this class.
 */
export class AppError extends Error {
    public readonly code: string;
    public readonly details?: Record<string, unknown>;

    constructor(message: string, code: string, details?: Record<string, unknown>) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;
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
