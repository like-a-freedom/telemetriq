/**
 * Heart-rate badge contract: the heart and the bpm unit form one column beside
 * the value — a shared left edge on the rail's unit gap, a tight vertical stack
 * inside the value's height, and the same unit baseline every other rail unit
 * uses (see docs/references/ghost-overlay.jpg for the pinned arrangement).
 *
 * The heart's painted box is computed here from the actual bezier path, so a
 * shape change that drifts away from the unit text fails these tests without
 * any constant updates.
 */
import { describe, it, expect, vi } from 'vitest';

import { renderGhostRunLayout } from '../modules/layouts/ghostRunLayout';
import { getTemplateConfig } from '../modules/templates/registry';
import type { OverlayContext2D } from '../modules/overlayUtils';
import type { ExtendedOverlayConfig, TelemetryFrame } from '../core/types';

interface DrawnText {
    value: string;
    x: number;
    y: number;
    size: number;
    ascent: number;
}

type PathOp =
    | { op: 'translate'; args: [number, number] }
    | { op: 'moveTo'; args: [number, number] }
    | { op: 'bezierCurveTo'; args: [number, number, number, number, number, number] };

interface PaintBox {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

interface DrawContext {
    ctx: OverlayContext2D;
    texts: DrawnText[];
    pathOps: PathOp[];
}

function createContext(): DrawContext {
    let currentFont = '';
    const texts: DrawnText[] = [];
    const pathOps: PathOp[] = [];
    const sizeOf = (): number => Number(currentFont.match(/([\d.]+)px/)?.[1] ?? 16);
    const stub = {
        canvas: { id: 'heart-badge' },
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        letterSpacing: '0px',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        lineJoin: 'round',
        lineCap: 'butt',
        lineWidth: 1,
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        get font() {
            return currentFont;
        },
        set font(value: string) {
            currentFont = value;
        },
        measureText: vi.fn((text: string) => ({
            width: text.length * sizeOf() * 0.5,
            actualBoundingBoxAscent: sizeOf() * 0.8,
        })),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        strokeText: vi.fn(),
        transform: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        translate: (x: number, y: number) => {
            pathOps.push({ op: 'translate', args: [x, y] });
        },
        moveTo: (x: number, y: number) => {
            pathOps.push({ op: 'moveTo', args: [x, y] });
        },
        bezierCurveTo: (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) => {
            pathOps.push({ op: 'bezierCurveTo', args: [c1x, c1y, c2x, c2y, x, y] });
        },
        fillText: (value: string, x: number, y: number) => {
            texts.push({ value, x, y, size: sizeOf(), ascent: sizeOf() * 0.8 });
        },
    };
    return { ctx: stub as unknown as OverlayContext2D, texts, pathOps };
}

function makeFrame(overrides: Partial<TelemetryFrame> = {}): TelemetryFrame {
    return {
        timeOffset: 60,
        hr: 158,
        paceSecondsPerKm: 314,
        distanceKm: 2.8,
        elapsedTime: '00:01:00',
        movingTimeSeconds: 60,
        totalElapsedSeconds: 60,
        ...overrides,
    };
}

function configWith(flags: Partial<ExtendedOverlayConfig>): ExtendedOverlayConfig {
    return {
        ...getTemplateConfig('ghost-run'),
        showPace: false,
        showDistance: false,
        showTime: false,
        showHr: false,
        showElevation: false,
        showGrade: false,
        ...flags,
    };
}

function find(texts: DrawnText[], value: string): DrawnText {
    const entry = texts.find((text) => text.value === value);
    expect(entry, `missing "${value}"`).toBeDefined();
    return entry!;
}

/** Painted bounds of the drawn heart, in the metric's tangent space. */
function heartPaintBox(pathOps: PathOp[]): PaintBox {
    const anchorOp = pathOps.find((entry) => entry.op === 'translate');
    expect(anchorOp, 'heart anchor not drawn').toBeDefined();
    const firstCurve = pathOps.findIndex((entry) => entry.op === 'bezierCurveTo');
    expect(firstCurve, 'heart path not drawn').toBeGreaterThan(0);

    const points: Array<[number, number]> = [];
    let cursor: [number, number] = (pathOps[firstCurve - 1] as { args: [number, number] }).args;
    points.push(cursor);
    for (let index = firstCurve; index < pathOps.length && pathOps[index]!.op === 'bezierCurveTo'; index++) {
        const [c1x, c1y, c2x, c2y, x, y] = (pathOps[index] as { args: [number, number, number, number, number, number] }).args;
        const p0 = cursor;
        const p1: [number, number] = [c1x, c1y];
        const p2: [number, number] = [c2x, c2y];
        const p3: [number, number] = [x, y];
        for (let step = 0; step <= 100; step++) {
            const t = step / 100;
            const u = 1 - t;
            points.push([
                u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
            ]);
        }
        cursor = p3;
    }

    const [anchorX, anchorY] = (anchorOp as { args: [number, number] }).args;
    const xs = points.map((point) => anchorX + point[0]);
    const ys = points.map((point) => anchorY + point[1]);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function badgeRows(width: number, height: number) {
    const draw = createContext();
    renderGhostRunLayout(draw.ctx, makeFrame(), width, height, configWith({ showHr: true }), {});

    return {
        value: find(draw.texts, '158'),
        unit: find(draw.texts, 'bpm'),
        heart: heartPaintBox(draw.pathOps),
    };
}

function plainUnitRow(width: number, height: number) {
    const draw = createContext();
    renderGhostRunLayout(draw.ctx, makeFrame(), width, height, configWith({ showDistance: true }), {});

    return { value: find(draw.texts, '2.8'), unit: find(draw.texts, 'km') };
}

function textInkWidth(text: DrawnText): number {
    return text.value.length * text.size * 0.5;
}

describe('Ghost Run heart-rate badge', () => {
    for (const [w, h] of [[1920, 1080], [1080, 1920]] as Array<[number, number]>) {
        const frame = `${w}x${h}`;

        it(`paints heart and bpm flush on one left edge beside the value (${frame})`, () => {
            const { value, unit, heart } = badgeRows(w, h);
            const heartWidth = heart.right - heart.left;

            expect(Math.abs(unit.x - heart.left), frame).toBeLessThanOrEqual(0.08 * heartWidth);
            // The whole badge clears the digits with positive space.
            expect(unit.x - textInkWidth(value), frame).toBeGreaterThan(0.08 * value.size);
        });

        it(`uses the rail unit gap and baseline like km and m (${frame})`, () => {
            const hr = badgeRows(w, h);
            const distance = plainUnitRow(w, h);

            const hrGap = hr.unit.x - textInkWidth(hr.value);
            const distanceGap = distance.unit.x - textInkWidth(distance.value);

            expect(hrGap, frame).toBeCloseTo(distanceGap, 5);
            expect(hr.unit.y, frame).toBeCloseTo(distance.unit.y, 5);
        });

        it(`stacks the heart tightly above bpm inside the value height (${frame})`, () => {
            const { value, unit, heart } = badgeRows(w, h);
            const unitTop = unit.y - unit.ascent;

            expect(heart.bottom, frame).toBeLessThan(unitTop);
            expect(unitTop - heart.bottom, frame).toBeLessThanOrEqual(value.size * 0.12);
            // The badge fits the value's band: no higher than the cap, never below the baseline.
            expect(heart.top, frame).toBeGreaterThanOrEqual(-value.size);
            expect(heart.bottom, frame).toBeLessThanOrEqual(-value.size * 0.05);
        });
    }

    it('drops the whole badge when the heart-rate metric is hidden', () => {
        const draw = createContext();

        renderGhostRunLayout(draw.ctx, makeFrame(), 1920, 1080, configWith({ showDistance: true }), {});

        expect(draw.pathOps.some((entry) => entry.op === 'bezierCurveTo')).toBe(false);
        expect(draw.texts.some((text) => text.value === 'bpm')).toBe(false);
        expect(draw.texts.some((text) => text.value === '158')).toBe(false);
    });

    it('keeps the badge aligned when the value degrades to N/A', () => {
        const draw = createContext();

        renderGhostRunLayout(draw.ctx, makeFrame({ hr: undefined }), 1920, 1080, configWith({ showHr: true }), {});

        const unit = find(draw.texts, 'bpm');
        const value = find(draw.texts, 'N/A');
        const heart = heartPaintBox(draw.pathOps);
        expect(Math.abs(unit.x - heart.left)).toBeLessThanOrEqual(0.08 * (heart.right - heart.left));
        expect(unit.x).toBeGreaterThan(textInkWidth(value));
    });
});
