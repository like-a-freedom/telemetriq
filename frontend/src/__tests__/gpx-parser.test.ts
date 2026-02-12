import { describe, it, expect } from 'vitest';
import { parseGpx, validateGpxFile } from '../modules/gpx-parser';
import { ParseError } from '../core/errors';

/** Helper to create a minimal valid GPX string */
function makeGpx(trackpoints: string, extensions = ''): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TestApp"
  xmlns="http://www.topografix.com/GPX/1/1"
  ${extensions}>
  <metadata>
    <time>2024-01-15T10:00:00Z</time>
    <desc>Test track</desc>
  </metadata>
  <trk>
    <name>Morning Run</name>
    <trkseg>
      ${trackpoints}
    </trkseg>
  </trk>
</gpx>`;
}

function makeTrkpt(lat: number, lon: number, time: string, ele?: number, hrExt = ''): string {
    return `<trkpt lat="${lat}" lon="${lon}">
    ${ele !== undefined ? `<ele>${ele}</ele>` : ''}
    <time>${time}</time>
    ${hrExt ? `<extensions>${hrExt}</extensions>` : ''}
  </trkpt>`;
}

describe('GPX Parser', () => {
    describe('parseGpx', () => {
        it('should parse a valid GPX with basic track points', () => {
            const xml = makeGpx(`
        ${makeTrkpt(55.7558, 37.6173, '2024-01-15T10:00:00Z', 150)}
        ${makeTrkpt(55.7560, 37.6175, '2024-01-15T10:00:05Z', 151)}
        ${makeTrkpt(55.7562, 37.6177, '2024-01-15T10:00:10Z', 152)}
      `);

            const result = parseGpx(xml);

            expect(result.name).toBe('Morning Run');
            expect(result.points).toHaveLength(3);
            expect(result.points[0]!.lat).toBeCloseTo(55.7558);
            expect(result.points[0]!.lon).toBeCloseTo(37.6173);
            expect(result.points[0]!.ele).toBe(150);
            expect(result.points[0]!.time).toBeInstanceOf(Date);
        });

        it('should parse metadata', () => {
            const xml = makeGpx(makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z'));
            const result = parseGpx(xml);

            expect(result.metadata.creator).toBe('TestApp');
            expect(result.metadata.time).toBeInstanceOf(Date);
            expect(result.metadata.description).toBe('Test track');
        });

        it('should extract Garmin heart rate from TrackPointExtension', () => {
            const hrExtension = `<TrackPointExtension><hr>145</hr></TrackPointExtension>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(145);
        });

        it('should extract heart rate from generic <heartrate> element', () => {
            const hrExtension = `<heartrate>162</heartrate>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(162);
        });

        it('should extract heart rate from <hr> element', () => {
            const hrExtension = `<hr>130</hr>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(130);
        });

        it('should extract heart rate from <heart_rate> element', () => {
            const hrExtension = `<heart_rate>175</heart_rate>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(175);
        });

        it('should return undefined hr when no extensions', () => {
            const xml = makeGpx(makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z'));

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBeUndefined();
        });

        it('should skip points without timestamp', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1" creator="Test">
  <trk><name>Test</name><trkseg>
    <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
    <trkpt lat="55.1" lon="37.1"></trkpt>
    <trkpt lat="55.2" lon="37.2"><time>2024-01-15T10:00:10Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.points).toHaveLength(2);
        });

        it('should skip points with invalid coordinates', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1" creator="Test">
  <trk><name>Test</name><trkseg>
    <trkpt lat="95.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
    <trkpt lat="55.0" lon="200.0"><time>2024-01-15T10:00:05Z</time></trkpt>
    <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:10Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.points).toHaveLength(1);
            expect(result.points[0]!.lat).toBeCloseTo(55.0);
        });

        it('should throw ParseError for invalid XML', () => {
            expect(() => parseGpx('not xml at all >>>')).toThrow(ParseError);
        });

        it('should throw ParseError when no <gpx> element', () => {
            expect(() => parseGpx('<?xml version="1.0"?><root></root>')).toThrow(ParseError);
        });

        it('should throw ParseError when no track points', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1"><trk><name>Empty</name><trkseg></trkseg></trk></gpx>`;
            expect(() => parseGpx(xml)).toThrow(ParseError);
        });

        it('should handle GPX with multiple track segments', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1" creator="Test">
  <trk><name>Multi Seg</name>
    <trkseg>
      <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="55.1" lon="37.1"><time>2024-01-15T10:01:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.points).toHaveLength(2);
        });

        it('should reject unreasonable heart rate values', () => {
            const hrExtension = `<hr>350</hr>`; // > 300 BPM - unreasonable
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBeUndefined();
        });

        it('should extract cadence from extensions', () => {
            const ext = `<TrackPointExtension><hr>150</hr><cad>85</cad></TrackPointExtension>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, ext),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.cadence).toBe(85);
        });

        it('should handle missing elevation', () => {
            const xml = makeGpx(makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z'));

            const result = parseGpx(xml);
            expect(result.points[0]!.ele).toBeUndefined();
        });

        it('should default track name to "Unnamed Track"', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1" creator="Test">
  <trk><trkseg>
    <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.name).toBe('Unnamed Track');
        });
    });

    describe('validateGpxFile', () => {
        it('should accept a valid .gpx file', () => {
            const file = new File(['<gpx>test</gpx>'], 'track.gpx', { type: 'application/gpx+xml' });
            const result = validateGpxFile(file);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject non-gpx extension', () => {
            const file = new File(['data'], 'track.xml', { type: 'text/xml' });
            const result = validateGpxFile(file);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('.xml');
        });

        it('should reject empty file', () => {
            const file = new File([], 'track.gpx');
            const result = validateGpxFile(file);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('File is empty');
        });
    });
});
