import fs from 'fs';
import path from 'path';
import { autoSync } from '../src/modules/sync-engine';

function parseGpxMinimal(xml: string) {
    const pts = [];
    const re = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const lat = parseFloat(m[1]);
        const lon = parseFloat(m[2]);
        const body = m[3];
        const timeMatch = body.match(/<time>([^<]+)<\/time>/);
        const hrMatch = body.match(/<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/);
        if (!timeMatch) continue;
        const time = new Date(timeMatch[1]);
        pts.push({ lat, lon, time, hr: hrMatch ? Number(hrMatch[1]) : undefined });
        if (pts.length >= 10) break; // enough for sync
    }
    return pts;
}

const gpxPath = path.resolve(__dirname, '../../test_data/iphone/iphone-track.gpx');
const xml = fs.readFileSync(gpxPath, 'utf-8');
const points = parseGpxMinimal(xml);

console.log('GPX first point:', points[0] && { time: points[0].time.toISOString(), lat: points[0].lat, lon: points[0].lon });

const videoCreate = new Date('2026-02-15T09:01:13.000Z');
console.log('Video create (assumed):', videoCreate.toISOString());

const res = autoSync(points, videoCreate, undefined, undefined);
console.log('autoSync result (time-only):', res);

// If video GPS were available, test with sample coords near first GPX point
const resWithGps = autoSync(points, videoCreate, points[0].lat, points[0].lon);
console.log('autoSync result (with GPS at GPX start):', resWithGps);
