function findMetadataDate(tags: { date?: unknown; raw?: unknown } | undefined): Date | undefined {
    const direct = toValidDate(tags?.date);
    if (direct) return direct;

    return findDateInUnknown(tags?.raw);
}

function findDateInUnknown(value: unknown): Date | undefined {
    const direct = toValidDate(value);
    if (direct) return direct;

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = findDateInUnknown(item);
            if (nested) return nested;
        }
        return undefined;
    }

    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;

        const prioritizedKeys = [
            'creation_time',
            'creationTime',
            'creationdate',
            'creationDate',
            'date',
            'time',
        ];

        for (const key of prioritizedKeys) {
            if (!(key in record)) continue;
            const fromKey = findDateInUnknown(record[key]);
            if (fromKey) return fromKey;
        }

        const skipKeys = new Set([
            'modification_time',
            'modificationTime',
            'modificationdate',
            'modificationDate',
            'modified_time',
            'modifiedTime',
            'mod_date',
            'modDate',
            'updated_at',
            'updatedAt',
        ]);

        for (const [key, nestedValue] of Object.entries(record)) {
            if (skipKeys.has(key)) continue;
            const nested = findDateInUnknown(nestedValue);
            if (nested) return nested;
        }
    }

    return undefined;
}

function toValidDate(value: unknown): Date | undefined {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value;
    }

    if (typeof value === 'string') {
        if (!/\d{4}-\d{2}-\d{2}|\d{8}_\d{6}/.test(value)) {
            return undefined;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
}

export { findMetadataDate, findDateInUnknown, toValidDate };