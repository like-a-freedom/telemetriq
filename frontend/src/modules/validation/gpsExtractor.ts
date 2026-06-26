export function findIso6709Location(info: unknown): { lat: number; lon: number } | undefined {
    const isoRegex = /([+-]\d{2,3}\.\d+)([+-]\d{2,3}\.\d+)/;

    const stack: unknown[] = [info];
    while (stack.length) {
        const current = stack.pop();
        if (!current) continue;

        if (typeof current === 'string') {
            const match = current.match(isoRegex);
            if (match) {
                const lat = Number(match[1]);
                const lon = Number(match[2]);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                    return { lat, lon };
                }
            }
        } else if (Array.isArray(current)) {
            for (const item of current) stack.push(item);
        } else if (typeof current === 'object') {
            for (const value of Object.values(current as Record<string, unknown>)) {
                stack.push(value);
            }
        }
    }

    return undefined;
}