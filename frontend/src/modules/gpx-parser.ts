import type { TrackPoint, GpxData, GpxMetadata, FileValidation } from '../core/types';
import { ParseError, ValidationError } from '../core/errors';

/** Maximum GPX file size: 50 MB */
const MAX_GPX_SIZE = 50 * 1024 * 1024;

/** Supported GPX extensions */
const ALLOWED_EXTENSIONS = ['.gpx'];

/**
 * Validate a GPX file before parsing.
 */
export function validateGpxFile(file: File): FileValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`Unsupported file format: ${ext}. Expected .gpx`);
    }

    if (file.size > MAX_GPX_SIZE) {
        errors.push(`File is too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max ${MAX_GPX_SIZE / 1024 / 1024} MB`);
    }

    if (file.size === 0) {
        errors.push('File is empty');
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Parse a GPX file and extract track points with telemetry data.
 * Supports GPX 1.0 and 1.1, and multiple heart rate extension formats.
 */
export function parseGpx(xmlString: string): GpxData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const parseErrors = doc.querySelectorAll('parsererror');
    if (parseErrors.length > 0) {
        throw new ParseError('Failed to parse GPX file: invalid XML', {
            details: parseErrors[0]?.textContent ?? 'Unknown parse error',
        });
    }

    const gpxElement = doc.querySelector('gpx');
    if (!gpxElement) {
        throw new ParseError('Root <gpx> element not found');
    }

    const metadata = parseMetadata(doc);
    const name = parseTrackName(doc);
    const points = parseTrackPoints(doc);

    if (points.length === 0) {
        throw new ParseError('GPX file contains no track points');
    }

    return { name, points, metadata };
}

/**
 * Parse GPX metadata.
 */
function parseMetadata(doc: Document): GpxMetadata {
    const gpxElement = doc.querySelector('gpx');
    const metaElement = doc.querySelector('metadata');

    const creator = gpxElement?.getAttribute('creator') ?? undefined;
    const timeStr = metaElement?.querySelector('time')?.textContent;
    const description = metaElement?.querySelector('desc')?.textContent ?? undefined;

    return {
        creator,
        time: timeStr ? new Date(timeStr) : undefined,
        description: description ?? undefined,
    };
}

/**
 * Parse track name.
 */
function parseTrackName(doc: Document): string {
    const nameElement = doc.querySelector('trk > name');
    return nameElement?.textContent ?? 'Unnamed Track';
}

/**
 * Parse all track points from the GPX document.
 */
function parseTrackPoints(doc: Document): TrackPoint[] {
    const trkpts = doc.querySelectorAll('trkpt');
    const points: TrackPoint[] = [];

    for (const trkpt of trkpts) {
        const lat = parseFloat(trkpt.getAttribute('lat') ?? '');
        const lon = parseFloat(trkpt.getAttribute('lon') ?? '');

        if (isNaN(lat) || isNaN(lon)) {
            continue; // Skip invalid points
        }

        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            continue; // Skip out-of-range coordinates
        }

        const eleElement = trkpt.querySelector('ele');
        const ele = eleElement ? parseFloat(eleElement.textContent ?? '') : undefined;

        const timeElement = trkpt.querySelector('time');
        if (!timeElement?.textContent) {
            continue; // Skip points without timestamp
        }
        const time = new Date(timeElement.textContent);
        if (isNaN(time.getTime())) {
            continue; // Skip invalid timestamps
        }

        const hr = extractHeartRate(trkpt);

        points.push({
            lat,
            lon,
            ele: ele !== undefined && !isNaN(ele) ? ele : undefined,
            time,
            hr,
        });
    }

    return points;
}

/**
 * Extract heart rate from various GPX extension formats.
 * Supports: Garmin (gpxtpx:hr), Strava (heartrate), Polar (hr), Suunto (suunto:hr), Generic (heart_rate)
 */
function extractHeartRate(trkpt: Element): number | undefined {
    const extensions = trkpt.querySelector('extensions');
    if (!extensions) return undefined;

    // Garmin TrackPointExtension v2: <gpxtpx:hr> or <ns3:hr>
    const garminHr = extensions.querySelector('TrackPointExtension > hr');
    if (garminHr?.textContent) {
        const val = parseInt(garminHr.textContent, 10);
        if (!isNaN(val) && val > 0 && val < 300) return val;
    }

    // Also try with namespace prefix patterns
    const allElements = extensions.getElementsByTagName('*');
    for (const el of allElements) {
        const localName = el.localName || el.nodeName.split(':').pop();
        if (localName === 'hr' || localName === 'heartrate' || localName === 'heart_rate') {
            const val = parseInt(el.textContent ?? '', 10);
            if (!isNaN(val) && val > 0 && val < 300) return val;
        }
    }

    return undefined;
}

/**
 * Read a File object and parse as GPX.
 */
export async function readAndParseGpx(file: File): Promise<GpxData> {
    const validation = validateGpxFile(file);
    if (!validation.valid) {
        throw new ValidationError(validation.errors.join('; '));
    }

    const text = await file.text();
    return parseGpx(text);
}
