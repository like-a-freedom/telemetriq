import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('Ghost Run keeps translucent metric panels inside the frame across metrics and sizes', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getGhostRunRoute } = await import('/src/modules/ghostRunRoute.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { GHOST_RUN_COLORS } = await import('/src/modules/templates/ghostRun.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const base = getTemplateConfig('ghost-run');
        const frame = { timeOffset: 446399, totalElapsedSeconds: 446399, movingTimeSeconds: 446399,
            elapsedTime: '123:59:59', paceSecondsPerKm: 7259, distanceKm: 12345.6,
            hr: 199, elevationM: 9999, gradePercent: -99.9 };
        const route = getGhostRunRoute(Array.from({ length: 60 }, (_, index) => ({
            ...frame, timeOffset: index * 8000, distanceKm: index * 230,
            latitude: 45 + index * 0.001, longitude: 10 + Math.sin(index / 6) * 0.01,
            timestampMs: Date.UTC(2026, 9, 2, 8, 12) + index * 8_000_000,
            elevationM: 100 + Math.sin(index / 5) * 70,
        })));
        const sizes = [[320, 180], [320, 568], [360, 640], [640, 360], [884, 151],
            [1080, 1080], [1080, 1920], [1920, 1080], [3840, 2160]];
        const variations = [base, { ...base, fontSizePercent: 8, valueSizeMultiplier: 2.5, labelSizeMultiplier: 1.2 },
            { ...base, fontSizePercent: 1, labelStyle: 'hidden', textShadow: false }];
        const keys = ['showPace', 'showDistance', 'showTime', 'showHr', 'showElevation', 'showGrade'] as const;
        const failures: string[] = [];
        let cases = 0;
        for (const [w, h] of sizes) {
            const canvas = document.createElement('canvas');
            canvas.width = w!;
            canvas.height = h!;
            const ctx = canvas.getContext('2d')!;
            const text: Array<{ value: string; left: number; right: number; top: number; bottom: number }> = [];
            const fillText = ctx.fillText.bind(ctx);
            ctx.fillText = (value, x, y) => {
                const box = ctx.measureText(value);
                const transform = ctx.getTransform();
                const corners = [
                    [x - box.actualBoundingBoxLeft, y - box.actualBoundingBoxAscent],
                    [x + box.actualBoundingBoxRight, y - box.actualBoundingBoxAscent],
                    [x + box.actualBoundingBoxRight, y + box.actualBoundingBoxDescent],
                    [x - box.actualBoundingBoxLeft, y + box.actualBoundingBoxDescent],
                ].map(([px, py]) => transform.transformPoint({ x: px!, y: py! }));
                text.push({ value, left: Math.min(...corners.map((p) => p.x)), right: Math.max(...corners.map((p) => p.x)),
                    top: Math.min(...corners.map((p) => p.y)), bottom: Math.max(...corners.map((p) => p.y)) });
                fillText(value, x, y);
            };
            let panelFills = 0;
            let invalidPanelOpacity = false;
            let pathPoints: DOMPoint[] = [];
            const panels: Array<{ left: number; right: number; top: number; bottom: number }> = [];
            const beginPath = ctx.beginPath.bind(ctx);
            ctx.beginPath = () => { pathPoints = []; beginPath(); };
            const fill = ctx.fill.bind(ctx);
            ctx.fill = () => {
                if (ctx.fillStyle === GHOST_RUN_COLORS.panel.toLowerCase()) {
                    panelFills++;
                    invalidPanelOpacity ||= ctx.globalAlpha <= 0 || ctx.globalAlpha >= 1;
                    panels.push({ left: Math.min(...pathPoints.map((p) => p.x)), right: Math.max(...pathPoints.map((p) => p.x)),
                        top: Math.min(...pathPoints.map((p) => p.y)), bottom: Math.max(...pathPoints.map((p) => p.y)) });
                }
                fill();
            };
            let outsidePath = false;
            const checkPoint = (x: number, y: number) => {
                const point = ctx.getTransform().transformPoint({ x, y });
                pathPoints.push(point);
                outsidePath ||= point.x < 0 || point.x > w! || point.y < 0 || point.y > h!;
            };
            const moveTo = ctx.moveTo.bind(ctx);
            const lineTo = ctx.lineTo.bind(ctx);
            const quadraticCurveTo = ctx.quadraticCurveTo.bind(ctx);
            const bezierCurveTo = ctx.bezierCurveTo.bind(ctx);
            const arc = ctx.arc.bind(ctx);
            ctx.moveTo = (x, y) => { checkPoint(x, y); moveTo(x, y); };
            ctx.lineTo = (x, y) => { checkPoint(x, y); lineTo(x, y); };
            ctx.quadraticCurveTo = (cx, cy, x, y) => { checkPoint(cx, cy); checkPoint(x, y); quadraticCurveTo(cx, cy, x, y); };
            ctx.bezierCurveTo = (cx1, cy1, cx2, cy2, x, y) => {
                checkPoint(cx1, cy1); checkPoint(cx2, cy2); checkPoint(x, y); bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
            };
            ctx.arc = (x, y, radius, start, end, counterclockwise) => {
                for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) checkPoint(x + dx, y + dy);
                arc(x, y, radius, start, end, counterclockwise);
            };
            for (let mask = 0; mask < 64; mask++) {
                for (const [variation, baseConfig] of variations.entries()) {
                    const config = { ...baseConfig };
                    keys.forEach((key, index) => { config[key] = Boolean(mask & (1 << index)); });
                    const id = `${w}x${h}/${mask}/${variation}`;
                    text.length = 0;
                    panelFills = 0;
                    panels.length = 0;
                    invalidPanelOpacity = false;
                    outsidePath = false;
                    ctx.clearRect(0, 0, w!, h!);
                    renderGhostRunLayout(ctx, frame, w!, h!, config, { ghostRoute: route });
                    const railMetrics = [config.showPace, config.showDistance, config.showTime, config.showHr].filter(Boolean).length;
                    if (panelFills < railMetrics) failures.push(`${id}: missing metric panel`);
                    if (mask === 0 && panelFills) failures.push(`${id}: panel for hidden metrics`);
                    if (invalidPanelOpacity) failures.push(`${id}: opaque panel`);
                    if (outsidePath) failures.push(`${id}: outside projected geometry`);
                    const frameInset = Math.max(12, Math.min(w!, h!) * 0.06);
                    const columns = w! >= h! && h! < 240 ? Math.min(2, Math.max(1, railMetrics)) : 1;
                    for (const [index, panel] of panels.entries()) {
                        if (panel.left < frameInset - 0.5 || w! - panel.right < frameInset - 0.5) {
                            failures.push(`${id}: panel violates frame inset`);
                        }
                        if (index < railMetrics && index % columns === 0 && Math.abs(panel.left - frameInset) > 0.5) {
                            failures.push(`${id}: drifting rail frame inset`);
                        }
                    }
                    if (w! < h!) {
                        const progress = panels.find((p) => p.top > h! * 0.5 && p.left < w! * 0.2 && p.right > w! * 0.9);
                        const elevation = panels.find((p) => p.top > h! * 0.5 && p.left > w! * 0.4);
                        if (progress && elevation && progress.top - elevation.bottom < Math.max(3, w! * 0.012)) {
                            failures.push(`${id}: cramped elevation/progress panels`);
                        }
                    }
                    const expected = [config.showPace && '120:59', config.showDistance && '12345.6',
                        config.showTime && '123:59:59', config.showHr && '199', config.showElevation && '9999'];
                    for (const value of expected) if (value && !text.some((entry) => entry.value === value)) failures.push(`${id}: missing ${value}`);
                    if (!config.showPace && text.some((entry) => entry.value === 'PACE')) failures.push(`${id}: hidden pace`);
                    for (const box of text) {
                        if (box.left < -0.5 || box.right > w! + 0.5 || box.top < -0.5 || box.bottom > h! + 0.5) failures.push(`${id}: outside ${box.value}`);
                    }
                    for (let a = 0; a < text.length; a++) for (let b = a + 1; b < text.length; b++) {
                        const first = text[a]!;
                        const second = text[b]!;
                        if (first.left < second.right - 0.5 && second.left < first.right - 0.5
                            && first.top < second.bottom - 0.5 && second.top < first.bottom - 0.5) failures.push(`${id}: collision ${first.value}/${second.value}`);
                    }
                    cases++;
                }
            }
        }
        return { cases, failures: failures.slice(0, 40) };
    });
    expect(result.cases).toBe(1728);
    expect(result.failures).toEqual([]);
});

test('Ghost Run balances painted content inside every panel and keeps a steady rail rhythm', async ({ page }) => {
    await page.goto('/?e2e');
    const failures = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getGhostRunRoute } = await import('/src/modules/ghostRunRoute.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { GHOST_RUN_COLORS } = await import('/src/modules/templates/ghostRun.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        type Point = { x: number; y: number };
        type Box = { left: number; right: number; top: number; bottom: number };
        const box = (points: Point[]): Box => ({ left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
            top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) });
        const frame = { timeOffset: 1005, totalElapsedSeconds: 1005, paceSecondsPerKm: 326, distanceKm: 2.8,
            hr: 156, elevationM: 156, gradePercent: 0.7, timestampMs: Date.UTC(2026, 9, 2, 8, 28) };
        const route = getGhostRunRoute(Array.from({ length: 60 }, (_, i) => ({ ...frame, timeOffset: i * 30,
            distanceKm: i / 59 * 7.5, latitude: 45 + Math.sin(i / 59 * Math.PI * 2) * 0.01,
            longitude: 10 + Math.cos(i / 59 * Math.PI * 2) * 0.01, elevationM: 100 + Math.sin(i / 5) * 35 })));
        route.ascentM = 119; route.descentM = 140;
        const failures: string[] = [];
        for (const [w, h] of [[960, 540], [390, 844], [640, 640], [884, 151], [320, 568],
            [1188, 669]]) {
            for (const missing of [false, true]) {
                const canvas = document.createElement('canvas'); canvas.width = w!; canvas.height = h!;
                const ctx = canvas.getContext('2d')!;
                const panels: Array<{ bounds: Box; content: Point[]; text: Map<string, Box> }> = [];
                let points: Point[] = [];
                let cursor: Point | undefined;
                const project = (x: number, y: number) => ctx.getTransform().transformPoint({ x, y });
                const begin = ctx.beginPath.bind(ctx);
                ctx.beginPath = () => { points = []; cursor = undefined; begin(); };
                const move = ctx.moveTo.bind(ctx);
                ctx.moveTo = (x, y) => { points.push(project(x, y)); cursor = { x, y }; move(x, y); };
                const line = ctx.lineTo.bind(ctx);
                ctx.lineTo = (x, y) => { points.push(project(x, y)); cursor = { x, y }; line(x, y); };
                const quadratic = ctx.quadraticCurveTo.bind(ctx);
                ctx.quadraticCurveTo = (cx, cy, x, y) => { points.push(project(cx, cy), project(x, y)); cursor = { x, y }; quadratic(cx, cy, x, y); };
                const bezier = ctx.bezierCurveTo.bind(ctx);
                ctx.bezierCurveTo = (x1, y1, x2, y2, x, y) => {
                    if (cursor) for (let i = 1; i <= 32; i++) {
                        const t = i / 32, u = 1 - t;
                        points.push(project(u ** 3 * cursor.x + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x,
                            u ** 3 * cursor.y + 3 * u ** 2 * t * y1 + 3 * u * t ** 2 * y2 + t ** 3 * y));
                    }
                    cursor = { x, y }; bezier(x1, y1, x2, y2, x, y);
                };
                const arc = ctx.arc.bind(ctx);
                ctx.arc = (x, y, r, start, end, ccw) => {
                    points.push(project(x - r, y - r), project(x + r, y + r)); arc(x, y, r, start, end, ccw);
                };
                const fill = ctx.fill.bind(ctx);
                ctx.fill = () => {
                    if (ctx.fillStyle === GHOST_RUN_COLORS.panel.toLowerCase()) {
                        panels.push({ bounds: box(points), content: [], text: new Map() });
                    } else panels.at(-1)?.content.push(...points);
                    fill();
                };
                const stroke = ctx.stroke.bind(ctx);
                ctx.stroke = () => { if (ctx.fillStyle !== GHOST_RUN_COLORS.panel.toLowerCase()) panels.at(-1)?.content.push(...points); stroke(); };
                const fillText = ctx.fillText.bind(ctx);
                ctx.fillText = (value, x, y) => {
                    const ink = ctx.measureText(value);
                    const corners = [project(x - ink.actualBoundingBoxLeft, y - ink.actualBoundingBoxAscent),
                        project(x + ink.actualBoundingBoxRight, y + ink.actualBoundingBoxDescent)];
                    panels.at(-1)?.content.push(...corners);
                    panels.at(-1)?.text.set(value.trim(), box(corners));
                    fillText(value, x, y);
                };
                renderGhostRunLayout(ctx, missing ? { ...frame, paceSecondsPerKm: undefined, hr: undefined,
                    elevationM: undefined, gradePercent: undefined } : frame, w!, h!, getTemplateConfig('ghost-run'), { ghostRoute: route });
                const id = `${w}x${h}/${missing ? 'missing' : 'normal'}`;
                const padding = Math.max(1, Math.min(w!, h!) * 0.005) * 4;
                const gap = padding * 0.75;
                const stackGap = padding * 0.75;
                const frameInset = Math.max(12, Math.min(w!, h!) * 0.06);
                const compact = w! >= h! && h! < 240;
                if (panels.length !== 8) failures.push(`${id}: expected eight panel roles`);
                for (const [i, panel] of panels.entries()) {
                    if ((i < 5 && !(compact && (i === 1 || i === 3))) || (i === 6 && w! < h!)) {
                        if (Math.abs(panel.bounds.left - frameInset) > 0.5) failures.push(`${id}/${i}: drifting left panel inset`);
                    }
                    if (i >= 5 && Math.abs(w! - panel.bounds.right - frameInset) > 0.5) {
                        failures.push(`${id}/${i}: drifting right panel inset`);
                    }
                    if (!panel.content.length) { failures.push(`${id}/${i}: empty panel`); continue; }
                    const content = box(panel.content);
                    const margins = { left: content.left - panel.bounds.left, right: panel.bounds.right - content.right,
                        top: content.top - panel.bounds.top, bottom: panel.bounds.bottom - content.bottom };
                    for (const [side, margin] of Object.entries(margins)) {
                        if (margin < padding - 1.5) failures.push(`${id}/${i}: tight ${side} margin ${margin.toFixed(2)}`);
                    }
                    // Aspect-ratio preserving route geometry has deliberate spare space.
                    // Compact cells share their row's height; other panels hug measured ink.
                    if (i !== 4 && !(h! < 240 && i < 4)
                        && Math.abs(margins.top - margins.bottom) > 2) failures.push(`${id}/${i}: unbalanced vertical margins`);
                    const labels = ['PACE', 'DISTANCE', 'ELAPSED', 'HEART RATE'];
                    if (i < 4 && panel.text.has(labels[i]!)) {
                        const label = panel.text.get(labels[i]!)!;
                        if (Math.abs(label.left - panel.bounds.left - padding) > 0.5) {
                            failures.push(`${id}/${i}: drifting label edge`);
                        }
                        const values = [missing ? 'N/A' : '5:26', '2.8', '16:45', missing ? 'N/A' : '156'];
                        const value = panel.text.get(values[i]!);
                        if (!value || value.top - label.bottom < stackGap - 0.5) {
                            failures.push(`${id}/${i}: cramped label/value gap`);
                        }
                    }
                }
                const terrain = panels[5]!;
                const terrainLabel = terrain.text.get('ELEVATION');
                const terrainValue = terrain.text.get(missing ? 'N/A' : '156');
                const terrainUnit = terrain.text.get('m');
                const grade = terrain.text.get(missing ? 'N/A% grade' : '0.7% grade');
                if (!terrainLabel || !terrainValue || terrainValue.top - terrainLabel.bottom < stackGap - 0.5) {
                    failures.push(`${id}: cramped elevation label/value gap`);
                }
                if (!terrainValue || !terrainUnit || !grade
                    || grade.top - Math.max(terrainValue.bottom, terrainUnit.bottom) < stackGap - 0.5) {
                    failures.push(`${id}: cramped space above grade`);
                }
                for (let i = compact ? 2 : 1; i < 4; i++) {
                    const previous = panels[i - (compact ? 2 : 1)]!.bounds;
                    if (Math.abs(panels[i]!.bounds.top - previous.bottom - gap) > 0.5) failures.push(`${id}: uneven rail gap`);
                }
                if (compact && Math.abs(panels[1]!.bounds.left - panels[0]!.bounds.right - gap) > 0.5) {
                    failures.push(`${id}: detached compact column`);
                }
                const summary = panels[6]!;
                const current = summary.text.get('2.8');
                const remaining = summary.text.get('/ 7.5 km');
                if (!current || !remaining) failures.push(`${id}: missing distance caption`);
                else if (remaining.left - current.right < padding / 4 - 0.5) failures.push(`${id}: cramped distance suffix`);
            }
        }
        return failures;
    });
    expect(failures).toEqual([]);
});

test('Ghost Run renders missing data explicitly and leaves the center transparent', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderOverlay } = await import('/src/modules/overlayRenderer.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const canvas = document.createElement('canvas');
        canvas.width = 1188;
        canvas.height = 669;
        const ctx = canvas.getContext('2d')!;
        await renderOverlay(ctx, { timeOffset: 877, distanceKm: 2.8, movingTimeSeconds: 850, elapsedTime: '14:10' },
            1188, 669, getTemplateConfig('ghost-run'));
        const center = ctx.getImageData(300, 50, 500, 550).data;
        return { centerClear: center.every((value, index) => index % 4 !== 3 || value === 0),
            hasInk: ctx.getImageData(0, 0, 1188, 669).data.some((value, index) => index % 4 === 3 && value > 0) };
    });
    expect(result).toEqual({ centerClear: true, hasInk: true });
});

test('Ghost Run keeps the heart aligned and separated from heart rate and bpm', async ({ page }) => {
    await page.goto('/?e2e');
    const results = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const config = { ...getTemplateConfig('ghost-run'), showPace: false, showDistance: false,
            showTime: false, showHr: true, showElevation: false, showGrade: false };
        const frame = { timeOffset: 0, distanceKm: 0, elapsedTime: '00:00:00', hr: 135 };
        const sizes = [[286, 195], [320, 180], [360, 640], [1188, 669]];
        const output: Array<{ width: number; value: Box; bpm: Box; heart: Box }> = [];
        type Point = { x: number; y: number };
        type Box = { left: number; right: number; top: number; bottom: number };
        const bounds = (points: Point[]): Box => ({
            left: Math.min(...points.map((point) => point.x)),
            right: Math.max(...points.map((point) => point.x)),
            top: Math.min(...points.map((point) => point.y)),
            bottom: Math.max(...points.map((point) => point.y)),
        });

        for (const [width, height] of sizes) {
            const canvas = document.createElement('canvas');
            canvas.width = width!;
            canvas.height = height!;
            const ctx = canvas.getContext('2d')!;
            const texts = new Map<string, Box>();
            let pathPoints: Point[] = [];
            let current: Point | undefined;
            let heart: Box | undefined;

            const originalFillText = ctx.fillText.bind(ctx);
            ctx.fillText = (value, x, y) => {
                const metrics = ctx.measureText(value);
                const transform = ctx.getTransform();
                const corners = [
                    [x - metrics.actualBoundingBoxLeft, y - metrics.actualBoundingBoxAscent],
                    [x + metrics.actualBoundingBoxRight, y - metrics.actualBoundingBoxAscent],
                    [x + metrics.actualBoundingBoxRight, y + metrics.actualBoundingBoxDescent],
                    [x - metrics.actualBoundingBoxLeft, y + metrics.actualBoundingBoxDescent],
                ].map(([px, py]) => transform.transformPoint({ x: px!, y: py! }));
                if (value === '135' || value === 'bpm') {
                    texts.set(value, bounds(corners));
                }
                originalFillText(value, x, y);
            };

            const originalBeginPath = ctx.beginPath.bind(ctx);
            ctx.beginPath = () => {
                pathPoints = [];
                current = undefined;
                originalBeginPath();
            };
            const project = (x: number, y: number): Point => ctx.getTransform().transformPoint({ x, y });
            const originalMoveTo = ctx.moveTo.bind(ctx);
            ctx.moveTo = (x, y) => {
                current = { x, y };
                pathPoints.push(project(x, y));
                originalMoveTo(x, y);
            };
            const originalBezierCurveTo = ctx.bezierCurveTo.bind(ctx);
            ctx.bezierCurveTo = (x1, y1, x2, y2, x, y) => {
                if (current) {
                    const start = current;
                    for (let step = 1; step <= 32; step++) {
                        const t = step / 32;
                        const inverse = 1 - t;
                        const px = inverse ** 3 * start.x + 3 * inverse ** 2 * t * x1
                            + 3 * inverse * t ** 2 * x2 + t ** 3 * x;
                        const py = inverse ** 3 * start.y + 3 * inverse ** 2 * t * y1
                            + 3 * inverse * t ** 2 * y2 + t ** 3 * y;
                        pathPoints.push(project(px, py));
                    }
                }
                current = { x, y };
                originalBezierCurveTo(x1, y1, x2, y2, x, y);
            };
            const originalFill = ctx.fill.bind(ctx);
            ctx.fill = () => {
                if (pathPoints.length) heart = bounds(pathPoints);
                originalFill();
            };

            renderGhostRunLayout(ctx, frame, width!, height!, config);
            const value = texts.get('135');
            const bpm = texts.get('bpm');
            if (!value || !bpm || !heart) {
                throw new Error(`Missing heart-rate geometry at ${width}x${height}: value=${Boolean(value)}, bpm=${Boolean(bpm)}, heart=${Boolean(heart)}`);
            }
            output.push({ width: width!, value, bpm, heart });
        }
        return output;
    });

    for (const { width, value, bpm, heart } of results) {
        const pulseSize = value.bottom - value.top;
        const valueHeartGap = heart.left - value.right;
        const heartBpmGap = bpm.top - heart.bottom;
        expect(valueHeartGap, `${width}px: heart should have a clear horizontal gap from the pulse value`)
            .toBeGreaterThanOrEqual(pulseSize * 0.1);
        expect(valueHeartGap, `${width}px: heart should remain visually grouped with the pulse value`)
            .toBeLessThanOrEqual(pulseSize * 0.5);
        expect(Math.abs(heart.left - bpm.left), `${width}px: heart and bpm should share a left alignment`)
            .toBeLessThanOrEqual(pulseSize * 0.12);
        expect(heartBpmGap, `${width}px: heart must not collide with the bpm label`)
            .toBeGreaterThanOrEqual(Math.max(1.5, pulseSize * 0.03));
    }
});

test('Ghost Run never exposes invalid numbers or invents an elapsed time', async ({ page }) => {
    await page.goto('/?e2e');
    const failures = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const canvas = document.createElement('canvas');
        canvas.width = 390; canvas.height = 844;
        const ctx = canvas.getContext('2d')!;
        const text: string[] = [];
        const fillText = ctx.fillText.bind(ctx);
        ctx.fillText = (value, x, y) => { text.push(value); fillText(value, x, y); };
        const failures: string[] = [];
        for (const pace of [undefined, NaN, Infinity, -Infinity, -30]) {
            text.length = 0;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            renderGhostRunLayout(ctx, { timeOffset: NaN, totalElapsedSeconds: NaN, distanceKm: NaN,
                paceSecondsPerKm: pace, hr: Infinity, elevationM: NaN, gradePercent: Infinity },
                canvas.width, canvas.height, getTemplateConfig('ghost-run'));
            if (text.some((value) => /NaN|Infinity/.test(value))) failures.push(`${pace}: invalid number exposed`);
            // Pace, distance, elapsed, heart rate and elevation are all unavailable.
            if (text.filter((value) => value === 'N/A').length !== 5) failures.push(`${pace}: unavailable measurement formatted as data`);
            if (!text.includes('N/A% grade')) failures.push(`${pace}: unavailable grade not explicit`);
            if (text.includes('0:00')) failures.push(`${pace}: invented elapsed time`);
        }
        text.length = 0;
        renderGhostRunLayout(ctx, { timeOffset: 0, totalElapsedSeconds: 0, distanceKm: 0, paceSecondsPerKm: 314 },
            canvas.width, canvas.height, getTemplateConfig('ghost-run'));
        if (!text.includes('5:14') || !text.includes('0:00') || !text.includes('0.0')) failures.push('valid values lost');
        return failures;
    });
    expect(failures).toEqual([]);
});

test('Ghost Run keeps ordinary terrain totals readable in small landscape videos', async ({ page }) => {
    await page.goto('/?e2e');
    const failures = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getGhostRunRoute } = await import('/src/modules/ghostRunRoute.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const frame = { timeOffset: 877, totalElapsedSeconds: 877, paceSecondsPerKm: 314, distanceKm: 2.8,
            hr: 162, elevationM: 78, gradePercent: -2.1 };
        const route = getGhostRunRoute(Array.from({ length: 60 }, (_, i) => ({ ...frame,
            timeOffset: i * 30, distanceKm: i / 59 * 5.1, latitude: 45 + i * 0.001, longitude: 10 + Math.sin(i / 5) * 0.01,
            elevationM: 100 + Math.sin(i / 5) * 70 })));
        const failures: string[] = [];
        for (const [w, h] of [[640, 360], [960, 540], [540, 540]]) {
            const canvas = document.createElement('canvas');
            canvas.width = w!; canvas.height = h!;
            const ctx = canvas.getContext('2d')!;
            const fillText = ctx.fillText.bind(ctx);
            let totals = 0;
            ctx.fillText = (value, x, y) => {
                if (/^[+−]\d+ m$/.test(value)) {
                    totals++;
                    if (Number(ctx.font.match(/([\d.]+)px/)?.[1]) < 11) failures.push(`${w}x${h}: tiny ${value}`);
                }
                fillText(value, x, y);
            };
            renderGhostRunLayout(ctx, frame, w!, h!, getTemplateConfig('ghost-run'), { ghostRoute: route });
            if (totals !== 2) failures.push(`${w}x${h}: missing terrain totals`);
        }
        return failures;
    });
    expect(failures).toEqual([]);
});

test('Ghost Run keeps portrait type and its contrasting edges visible across footage palettes', async ({ page }) => {
    await page.goto('/?e2e');
    const failures = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const frame = { timeOffset: 877, totalElapsedSeconds: 877, paceSecondsPerKm: 314, distanceKm: 2.8,
            hr: 162, elevationM: 78, gradePercent: -2.1 };
        const failures: string[] = [];
        for (const [w, h] of [[320, 568], [390, 844]]) {
            for (const ground of ['#F7FBFA', '#152321', '#D5B58F', '#7DE6E3', '#24502D', '#888888']) {
                for (const darkInk of [false, true]) {
                    const canvas = document.createElement('canvas');
                    canvas.width = w!; canvas.height = h!;
                    const ctx = canvas.getContext('2d')!;
                    ctx.fillStyle = ground; ctx.fillRect(0, 0, w!, h!);
                    const config = getTemplateConfig('ghost-run');
                    if (darkInk) { config.textColor = '#152321'; config.accentColor = '#213547'; }
                    let label: { x: number; y: number; width: number; height: number } | undefined;
                    let valueHeight = 0;
                    const fillText = ctx.fillText.bind(ctx);
                    ctx.fillText = (value, x, y) => {
                        const metrics = ctx.measureText(value);
                        const transform = ctx.getTransform();
                        const corners = [[x - metrics.actualBoundingBoxLeft, y - metrics.actualBoundingBoxAscent],
                            [x + metrics.actualBoundingBoxRight, y - metrics.actualBoundingBoxAscent],
                            [x + metrics.actualBoundingBoxRight, y + metrics.actualBoundingBoxDescent],
                            [x - metrics.actualBoundingBoxLeft, y + metrics.actualBoundingBoxDescent]]
                            .map(([px, py]) => transform.transformPoint({ x: px!, y: py! }));
                        const top = Math.min(...corners.map((p) => p.y));
                        const bottom = Math.max(...corners.map((p) => p.y));
                        if (value === '5:14') valueHeight = bottom - top;
                        if (value === 'PACE') {
                            const left = Math.floor(Math.min(...corners.map((p) => p.x))) - 2;
                            const right = Math.ceil(Math.max(...corners.map((p) => p.x))) + 2;
                            label = { x: left, y: Math.floor(top) - 2, width: right - left, height: Math.ceil(bottom) - Math.floor(top) + 4 };
                        }
                        fillText(value, x, y);
                    };
                    renderGhostRunLayout(ctx, frame, w!, h!, config);
                    const id = `${w}x${h}/${ground}/${darkInk ? 'dark' : 'light'} ink`;
                    if (valueHeight < w! * 0.055) failures.push(`${id}: undersized portrait pace`);
                    if (!label) { failures.push(`${id}: missing label`); continue; }
                    const pixels = ctx.getImageData(label.x, label.y, label.width, label.height).data;
                    const background = [1, 3, 5].map((offset) => parseInt(ground.slice(offset, offset + 2), 16));
                    let visible = 0;
                    for (let i = 0; i < pixels.length; i += 4) {
                        if (Math.max(...background.map((channel, index) => Math.abs(channel - pixels[i + index]!))) > 64) visible++;
                    }
                    // Test painted contrast, including same-colored footage and foreground.
                    if (visible < label.width * label.height * 0.12) failures.push(`${id}: invisible label edges`);
                }
            }
        }
        return failures;
    });
    expect(failures).toEqual([]);
});

test('Ghost Run uses identical route data in preview and video-frame export (chromium only)', async ({ page }) => {
    await page.goto('/?e2e');
    const result = await page.evaluate(async () => {
        const { renderOverlay, renderOverlayOnFrame } = await import('/src/modules/overlayRenderer.ts');
        const { getGhostRunRoute } = await import('/src/modules/ghostRunRoute.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const frame = { timeOffset: 877, totalElapsedSeconds: 877, movingTimeSeconds: 850, elapsedTime: '14:10',
            paceSecondsPerKm: 314, distanceKm: 2.8, hr: 162, elevationM: 78, gradePercent: -2.1 };
        const timeline = Array.from({ length: 40 }, (_, i) => ({ ...frame, timeOffset: i * 40,
            latitude: 45 + i * 0.001, longitude: 10 + i * 0.001, distanceKm: i / 39 * 5.1,
            timestampMs: Date.UTC(2026, 9, 2, 8, 12) + i * 40_000, elevationM: 100 + Math.sin(i / 3) * 30 }));
        const context = { ghostRoute: getGhostRunRoute(timeline) };
        const config = getTemplateConfig('ghost-run');
        const preview = new OffscreenCanvas(640, 360);
        const previewCtx = preview.getContext('2d')!;
        previewCtx.fillStyle = '#3C5141';
        previewCtx.fillRect(0, 0, 640, 360);
        const base = new VideoFrame(preview, { timestamp: 0 });
        await renderOverlay(previewCtx, frame, 640, 360, config, context);
        const exported = await renderOverlayOnFrame(base, frame, config, context);
        const result = new OffscreenCanvas(640, 360);
        const exportedCtx = result.getContext('2d')!;
        exportedCtx.drawImage(exported, 0, 0);
        const expected = previewCtx.getImageData(0, 0, 640, 360).data;
        const actual = exportedCtx.getImageData(0, 0, 640, 360).data;
        let maximumDifference = 0;
        for (let i = 0; i < expected.length; i++) maximumDifference = Math.max(maximumDifference, Math.abs(expected[i]! - actual[i]!));
        exported.close();
        base.close();
        return maximumDifference;
    });
    expect(result).toBeLessThanOrEqual(2);
});

test('Ghost Run preserves portrait right edges and proportional type up to 4K video', async ({ page }) => {
    await page.goto('/?e2e');
    const failures = await page.evaluate(async () => {
        const { renderGhostRunLayout } = await import('/src/modules/layouts/ghostRunLayout.ts');
        const { getGhostRunRoute } = await import('/src/modules/ghostRunRoute.ts');
        const { getTemplateConfig } = await import('/src/modules/templates/registry.ts');
        const { ensureTrailRunFonts } = await import('/src/modules/trailRunFonts.ts');
        await ensureTrailRunFonts();
        const config = getTemplateConfig('ghost-run');
        const frame = { timeOffset: 877, totalElapsedSeconds: 877, paceSecondsPerKm: 314, distanceKm: 2.8,
            hr: 162, elevationM: 78, gradePercent: -2.1 };
        const route = getGhostRunRoute(Array.from({ length: 60 }, (_, i) => ({ ...frame,
            timeOffset: i * 30, distanceKm: i / 59 * 5.1, latitude: 45 + i * 0.001, longitude: 10 + Math.sin(i / 5) * 0.01,
            timestampMs: Date.UTC(2026, 9, 2, 8, 12) + i * 30_000, elevationM: 100 + Math.sin(i / 5) * 70 })));
        const reference = new Map<boolean, number>();
        const failures: string[] = [];
        for (const [w, h] of [[390, 844], [780, 1688], [2160, 3840], [1188, 669], [2376, 1338], [3840, 2160]]) {
            const canvas = document.createElement('canvas');
            canvas.width = w!; canvas.height = h!;
            const ctx = canvas.getContext('2d')!;
            const portrait = w! < h!;
            const short = Math.min(w!, h!);
            const edge = w! - Math.max(12, short * 0.06) - Math.max(4, short * 0.02);
            const fillText = ctx.fillText.bind(ctx);
            let paceHeight = 0;
            ctx.fillText = (value, x, y) => {
                const metrics = ctx.measureText(value);
                const matrix = ctx.getTransform();
                const horizontalScale = Math.hypot(matrix.a, matrix.b);
                const verticalScale = Math.hypot(matrix.c, matrix.d);
                const perpendicular = matrix.a * matrix.c + matrix.b * matrix.d;
                if (Math.abs(horizontalScale - verticalScale) > 0.0001 || Math.abs(perpendicular) > 0.0001) {
                    failures.push(`${w}x${h}: distorted glyph proportions for ${value}`);
                }
                if (portrait && (Math.abs(matrix.b) > 0.0001 || Math.abs(matrix.c) > 0.0001)) {
                    failures.push(`${w}x${h}: tilted portrait text ${value}`);
                }
                const top = matrix.transformPoint({ x: x - metrics.actualBoundingBoxLeft, y: y - metrics.actualBoundingBoxAscent });
                const bottom = matrix.transformPoint({ x: x + metrics.actualBoundingBoxRight, y: y + metrics.actualBoundingBoxDescent });
                if (value === '5:14') paceHeight = (bottom.y - top.y) / short;
                const isClock = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && ctx.textAlign === 'right';
                if (portrait && (value === 'ELEVATION' || value === 'm' || value.endsWith('% grade') || isClock || /^[+−]\d+ m$/.test(value))) {
                    if (Math.abs(bottom.x - edge) > short * 0.006) failures.push(`${w}x${h}: misaligned right edge ${value}`);
                }
                fillText(value, x, y);
            };
            renderGhostRunLayout(ctx, frame, w!, h!, config, { ghostRoute: route });
            const ratio = reference.get(portrait);
            if (ratio === undefined) reference.set(portrait, paceHeight);
            else if (Math.abs(paceHeight - ratio) > 0.005) failures.push(`${w}x${h}: inconsistent relative type size`);
        }
        return failures;
    });
    expect(failures).toEqual([]);
});

test('Ghost Run is selectable and draws imported telemetry on a real video', async ({ page }) => {
    const video = readFileSync(new URL('./fixtures/sample-3s.mp4', import.meta.url));
    await page.route('**/ghost-e2e.mp4', (route) => route.fulfill({ contentType: 'video/mp4', body: video }));
    await page.goto('/?e2e');
    await page.evaluate(async () => {
        const stores = (window as unknown as { __e2eStores: {
            files: { videoFile: File; videoMeta: unknown; gpxFile: File; gpxData: unknown };
            settings: { selectTemplate: (id: string) => void };
        } }).__e2eStores;
        Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
            request: async () => ({ release: async () => {}, addEventListener: () => {}, removeEventListener: () => {} }),
        } });
        const blob = await (await fetch('/ghost-e2e.mp4')).blob();
        stores.files.videoFile = new File([blob], 'ghost-e2e.mp4', { type: 'video/mp4' });
        stores.files.videoMeta = { duration: 3, width: 640, height: 360, fps: 30, codec: 'avc1.640028',
            fileSize: blob.size, fileName: 'ghost-e2e.mp4', startTime: new Date('2026-10-02T08:12:00Z'), timezoneOffsetMinutes: 0 };
        stores.files.gpxFile = new File(['<gpx/>'], 'track.gpx', { type: 'application/gpx+xml' });
        stores.files.gpxData = { name: 'Ghost Run browser fixture', metadata: {}, points: [0, 1, 2, 3].map((i) => ({
            lat: 45 + i * 0.00001, lon: 10 + i * 0.00001,
            time: new Date(Date.UTC(2026, 9, 2, 8, 12) + i * 1000), hr: 160, ele: 100 + i, power: 300,
        })) };
        stores.settings.selectTemplate('ghost-run');
    });
    await page.getByTestId('proceed-btn').click();
    await expect(page).toHaveURL(/\/preview/);
    await expect(page.locator('#template-select')).toHaveValue('ghost-run');
    await expect(page.getByRole('checkbox', { name: /^Heart rate / })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Time Elapsed time including pauses.' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /^Power / })).toHaveCount(0);
    const canvas = page.locator('.video-player__overlay');
    await expect(canvas).toHaveAttribute('width', '640');
    await expect(canvas).toHaveAttribute('height', '360');
    await expect.poll(() => canvas.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        return ctx.getImageData(400, 270, 220, 60).data.some((value, index) => index % 4 === 3 && value > 0);
    })).toBe(true);
    await page.getByRole('checkbox', { name: /^Distance / }).uncheck();
    await expect(page.getByRole('checkbox', { name: /^Distance / })).not.toBeChecked();
});
