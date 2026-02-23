/**
 * Error formatting utilities for consistent error message display.
 */

import { isAppError } from '../core/errors';

/** Format unknown error to user-friendly string */
export function formatErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    return serializeUnknownError(err);
}

/** Format error details from AppError or generic object */
export function formatErrorDetails(details: Readonly<Record<string, unknown>>): string {
    // Handle nested AppError details
    if (typeof details.details === 'string') {
        return details.details;
    }
    try {
        const serialized = JSON.stringify(details, null, 2);
        return serialized === '{}' ? '' : serialized;
    } catch {
        return '';
    }
}

/** Normalize processing error for display */
export function normalizeProcessingError(err: unknown): string {
    if (isAppError(err) && err.details) {
        const details = formatErrorDetails(err.details);
        return details ? `${err.message}\n\n${details}` : err.message;
    }
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    return serializeUnknownError(err);
}

/** Serialize unknown error type to string */
function serializeUnknownError(err: unknown): string {
    try {
        const serialized = JSON.stringify(err);
        if (serialized === undefined || serialized === '{}') {
            return 'Unknown error';
        }
        return serialized;
    } catch {
        return 'Unknown error';
    }
}
