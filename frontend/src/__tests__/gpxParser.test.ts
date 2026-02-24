import { describe, it, expect, beforeAll } from 'vitest';
import { parseGpx, validateGpxFile, readAndParseGpx } from '../modules/gpxParser';
import { ParseError, ValidationError } from '../core/errors';

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

// Check if we're in a browser environment with DOMParser
const hasDOMParser = typeof DOMParser !== 'undefined';

describe('GPX Parser', () => {
    beforeAll(() => {
        if (!hasDOMParser) {
            console.log('Note: GPX parser tests require DOMParser (browser environment)');
        }
    });

    describe('parseGpx', () => {
        const testOrSkip = hasDOMParser ? it : it.skip;

        testOrSkip('should parse a valid GPX with basic track points', () => {
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

        testOrSkip('should parse metadata', () => {
            const xml = makeGpx(makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z'));
            const result = parseGpx(xml);

            expect(result.metadata.creator).toBe('TestApp');
            expect(result.metadata.time).toBeInstanceOf(Date);
            expect(result.metadata.description).toBe('Test track');
        });

        testOrSkip('should extract Garmin heart rate from TrackPointExtension', () => {
            const hrExtension = `<TrackPointExtension><hr>145</hr></TrackPointExtension>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(145);
        });

        testOrSkip('should extract heart rate from generic <heartrate> element', () => {
            const hrExtension = `<heartrate>162</heartrate>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(162);
        });

        testOrSkip('should extract heart rate from <hr> element', () => {
            const hrExtension = `<hr>130</hr>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(130);
        });

        testOrSkip('should extract heart rate from <heart_rate> element', () => {
            const hrExtension = `<heart_rate>175</heart_rate>`;
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(175);
        });

        testOrSkip('should return undefined hr when no extensions', () => {
            const xml = makeGpx(makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z'));

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBeUndefined();
        });

        testOrSkip('should skip points without timestamp', () => {
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

        testOrSkip('should skip points with invalid coordinates', () => {
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

        testOrSkip('should throw ParseError for invalid XML', () => {
            expect(() => parseGpx('not xml at all >>>')).toThrow(ParseError);
        });

        testOrSkip('should throw ParseError when no <gpx> element', () => {
            expect(() => parseGpx('<?xml version="1.0"?><root></root>')).toThrow(ParseError);
        });

        testOrSkip('should throw ParseError when no track points', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1"><trk><name>Empty</name><trkseg></trkseg></trk></gpx>`;
            expect(() => parseGpx(xml)).toThrow(ParseError);
        });

        testOrSkip('should handle GPX with multiple track segments', () => {
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

        testOrSkip('should reject unreasonable heart rate values', () => {
            const hrExtension = `<hr>350</hr>`; // > 300 BPM - unreasonable
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, hrExtension),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBeUndefined();
        });

        testOrSkip('should handle missing elevation', () => {
            const xml = makeGpx(makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z'));

            const result = parseGpx(xml);
            expect(result.points[0]!.ele).toBeUndefined();
        });

        testOrSkip('should default track name to "Unnamed Track"', () => {
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

        it('should reject files over 50MB', () => {
            const file = new File(['data'], 'huge.gpx');
            Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 });

            const result = validateGpxFile(file);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('too large');
        });

        it('should accept files with uppercase extension', () => {
            const file = new File(['<gpx>test</gpx>'], 'track.GPX');
            const result = validateGpxFile(file);
            expect(result.valid).toBe(true);
        });

        it('should accept files with mixed case extension', () => {
            const file = new File(['<gpx>test</gpx>'], 'track.Gpx');
            const result = validateGpxFile(file);
            expect(result.valid).toBe(true);
        });
    });

    describe('readAndParseGpx', () => {
        const testOrSkip = hasDOMParser ? it : it.skip;

        testOrSkip('should read and parse a valid GPX file', async () => {
            const xml = makeGpx(makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z'));
            const file = new File([xml], 'test.gpx', { type: 'application/gpx+xml' });

            const result = await readAndParseGpx(file);

            expect(result.name).toBe('Morning Run');
            expect(result.points).toHaveLength(1);
            expect(result.points[0]!.lat).toBe(55.0);
        });

        it('should throw ValidationError for invalid file', async () => {
            const file = new File(['data'], 'test.xml', { type: 'text/xml' });

            await expect(readAndParseGpx(file)).rejects.toThrow(ValidationError);
        });

        testOrSkip('should throw ParseError for invalid XML', async () => {
            const file = new File(['not xml'], 'test.gpx');

            await expect(readAndParseGpx(file)).rejects.toThrow(ParseError);
        });

        testOrSkip('should throw ParseError for GPX without track points', async () => {
            const xml = '<?xml version="1.0"?><gpx version="1.1"><trk><name>Empty</name><trkseg></trkseg></trk></gpx>';
            const file = new File([xml], 'empty.gpx');

            await expect(readAndParseGpx(file)).rejects.toThrow(ParseError);
        });

        testOrSkip('should handle GPX with UTF-8 content', async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Тест">
  <trk><name>Трек утренней пробежки</name>
    <trkseg>
      <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;
            const file = new File([xml], 'utf8.gpx');

            const result = await readAndParseGpx(file);
            expect(result.name).toBe('Трек утренней пробежки');
        });
    });

    describe('edge cases and complex GPX', () => {
        const testOrSkip = hasDOMParser ? it : it.skip;

        testOrSkip('should handle GPX with no metadata', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1" creator="Test">
  <trk><name>Test</name><trkseg>
    <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.metadata.creator).toBe('Test');
            expect(result.metadata.time).toBeUndefined();
            expect(result.metadata.description).toBeUndefined();
        });

        testOrSkip('should handle GPX with negative coordinates', () => {
            const xml = makeGpx(`
        ${makeTrkpt(-33.8688, 151.2093, '2024-01-15T10:00:00Z')}
        ${makeTrkpt(-33.8690, 151.2095, '2024-01-15T10:00:30Z')}
      `);

            const result = parseGpx(xml);
            expect(result.points[0]!.lat).toBe(-33.8688);
            expect(result.points[0]!.lon).toBe(151.2093);
        });

        testOrSkip('should handle GPX with timezone offset in timestamps', () => {
            const xml = makeGpx(makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00+03:00'));

            const result = parseGpx(xml);
            expect(result.points[0]!.time).toBeInstanceOf(Date);
        });

        testOrSkip('should handle heart rate with namespace prefix', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk><name>Test</name>
    <trkseg>
      <trkpt lat="55.0" lon="37.0">
        <time>2024-01-15T10:00:00Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>155</gpxtpx:hr>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBe(155);
        });

        testOrSkip('should skip points with invalid timestamps', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><name>Test</name><trkseg>
    <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
    <trkpt lat="55.1" lon="37.1"><time>invalid-timestamp</time></trkpt>
    <trkpt lat="55.2" lon="37.2"><time>2024-01-15T10:00:10Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.points).toHaveLength(2);
        });

        testOrSkip('should skip points with out-of-range latitude', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><name>Test</name><trkseg>
    <trkpt lat="95.0" lon="37.0"><time>2024-01-15T10:00:00Z</time></trkpt>
    <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:05Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.points).toHaveLength(1);
            expect(result.points[0]!.lat).toBe(55.0);
        });

        testOrSkip('should skip points with out-of-range longitude', () => {
            const xml = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><name>Test</name><trkseg>
    <trkpt lat="55.0" lon="200.0"><time>2024-01-15T10:00:00Z</time></trkpt>
    <trkpt lat="55.0" lon="37.0"><time>2024-01-15T10:00:05Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

            const result = parseGpx(xml);
            expect(result.points).toHaveLength(1);
        });

        testOrSkip('should reject heart rate of 0', () => {
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, '<hr>0</hr>'),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBeUndefined();
        });

        testOrSkip('should reject negative heart rate', () => {
            const xml = makeGpx(
                makeTrkpt(55.0, 37.0, '2024-01-15T10:00:00Z', undefined, '<hr>-10</hr>'),
            );

            const result = parseGpx(xml);
            expect(result.points[0]!.hr).toBeUndefined();
        });

        testOrSkip('should handle many track points efficiently', () => {
            let trackpoints = '';
            for (let i = 0; i < 1000; i++) {
                const lat = 55.0 + i * 0.0001;
                const time = new Date(Date.UTC(2024, 0, 15, 10, 0, i)).toISOString();
                trackpoints += makeTrkpt(lat, 37.0, time);
            }

            const xml = makeGpx(trackpoints);
            const result = parseGpx(xml);
            expect(result.points).toHaveLength(1000);
        });
    });
});
