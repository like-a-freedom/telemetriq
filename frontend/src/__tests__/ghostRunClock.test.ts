/**
 * Ghost Run top-right clock: 24-hour wall-clock time taken from the track.
 *
 * - Absolute time comes from the frame's recording timestamp (with a route-start fallback).
 * - No usable absolute time in the track → no clock at all, the HUD keeps rendering.
 * - The test environment pins TZ so local-vs-UTC regressions are observable.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { formatGhostRunClock, renderGhostRunLayout } from '../modules/layouts/ghostRunLayout';
import { getGhostRunRoute, type GhostRunRoute } from '../modules/ghostRunRoute';
import { getTemplateConfig } from '../modules/templates/registry';
import type { OverlayContext2D } from '../modules/overlayUtils';
import type { ExtendedOverlayConfig, TelemetryFrame } from '../core/types';

const ORIGINAL_TZ = process.env.TZ;
/** UTC+3 without daylight saving, so expected wall-clock values are stable. */
const TEST_TZ = 'Europe/Moscow';
/** HH:MM exactly — a strict 24-hour clock with no zone label. */
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

beforeAll(() => {
    process.env.TZ = TEST_TZ;
});

afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
});

function makeFrame(overrides: Partial<TelemetryFrame> = {}): TelemetryFrame {
    return {
        timeOffset: 0,
        distanceKm: 0,
        elapsedTime: '00:00:00',
        movingTimeSeconds: 0,
        // Long enough that the ELAPSED rail value ('123:59:59') never looks like a clock.
        totalElapsedSeconds: 446_399,
        ...overrides,
    };
}

function makeRoute(overrides: Partial<GhostRunRoute> = {}): GhostRunRoute {
    return {
        points: [],
        trace: [],
        profile: [],
        totalDistanceKm: 0,
        bounds: { minX: 0, minY: 0, width: 0, height: 0 },
        ...overrides,
    };
}

/** Local wall-clock HH:MM of an instant, computed independently of the formatter. */
function localClock(timestampMs: number): string {
    const date = new Date(timestampMs);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

interface DrawnText {
    value: string;
    x: number;
    y: number;
    align: string;
    kind: 'fill' | 'stroke';
}

function createRenderContext(): { ctx: OverlayContext2D; texts: DrawnText[] } {
    let currentFont = '';
    const texts: DrawnText[] = [];
    const stub = {
        canvas: { id: 'ghost-clock' },
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        letterSpacing: '0px',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        lineJoin: 'round',
        lineCap: 'round',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        lineWidth: 1,
        get font() {
            return currentFont;
        },
        set font(value: string) {
            currentFont = value;
        },
        measureText: vi.fn((value: string) => {
            const size = Number(currentFont.match(/([\d.]+)px/)?.[1] ?? 16);
            return { width: value.length * size * 0.5 };
        }),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        translate: vi.fn(),
        transform: vi.fn(),
        fillText: vi.fn((value: string, x: number, y: number) => {
            texts.push({ value, x, y, align: stub.textAlign, kind: 'fill' });
        }),
        strokeText: vi.fn((value: string) => {
            texts.push({ value, x: Number.NaN, y: Number.NaN, align: stub.textAlign, kind: 'stroke' });
        }),
    };
    return { ctx: stub as unknown as OverlayContext2D, texts };
}

function clockConfig(overrides: Partial<ExtendedOverlayConfig> = {}): ExtendedOverlayConfig {
    // Only the clock and the ELAPSED rail value are drawn, so any HH:MM string is the clock.
    return {
        ...getTemplateConfig('ghost-run'),
        showPace: false,
        showDistance: false,
        showHr: false,
        showElevation: false,
        showGrade: false,
        showTime: true,
        ...overrides,
    };
}

function clocksIn(texts: DrawnText[]): DrawnText[] {
    return texts.filter((text) => CLOCK_PATTERN.test(text.value));
}

describe('test environment', () => {
    it('pins the time zone so local wall-clock expectations are deterministic', () => {
        expect(new Date(Date.UTC(2026, 9, 2, 12)).getHours()).toBe(15);
    });
});

describe('formatGhostRunClock (24-hour track clock)', () => {
    it('formats the track time as zero-padded 24-hour HH:MM without any zone label', () => {
        const frame = makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 12) });

        const clock = formatGhostRunClock(frame);

        expect(clock).toBe('11:12'); // 08:12 UTC is 11:12 in the pinned test zone
        expect(clock).toMatch(CLOCK_PATTERN);
        expect(clock).toHaveLength(5);
        expect(clock).not.toContain('UTC');
        expect(clock).not.toContain('Z');
        expect(clock).not.toMatch(/\b(am|pm)\b/i);
    });

    it('keeps the elapsed rail value irrelevant: time comes from the track, not from elapsed time', () => {
        const frame = makeFrame({
            timeOffset: 877,
            totalElapsedSeconds: 877,
            elapsedTime: '00:14:37',
            timestampMs: Date.UTC(2026, 9, 2, 8, 12),
        });

        expect(formatGhostRunClock(frame)).toBe('11:12');
    });

    it('zero-pads the midnight hour instead of showing 0:05, 24:05 or a previous day', () => {
        const frame = makeFrame({ timestampMs: Date.UTC(2026, 9, 1, 21, 5) });

        expect(formatGhostRunClock(frame)).toBe('00:05');
        expect(formatGhostRunClock(frame)).toMatch(CLOCK_PATTERN);
    });

    it('formats the last minute of the day', () => {
        expect(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 20, 59, 59) }))).toBe('23:59');
    });

    it('formats noon without a 12-hour meridiem or a rolled-over hour', () => {
        const clock = formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 9, 0) }));

        expect(clock).toBe('12:00');
        expect(clock).not.toContain('00:00');
    });

    it('zero-pads single-digit hours', () => {
        expect(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 3, 5) }))).toBe('06:05');
    });

    it('always produces a valid 24-hour value across every hour of the day', () => {
        for (let hour = 0; hour < 24; hour++) {
            const frame = makeFrame({ timestampMs: Date.UTC(2026, 9, 2, hour, 7, 30) });
            const clock = formatGhostRunClock(frame);

            expect(clock).toMatch(CLOCK_PATTERN);
            expect(clock).toBe(localClock(frame.timestampMs!));
            expect(clock!.startsWith('24')).toBe(false);
        }
    });

    it('truncates seconds instead of rounding into the next minute', () => {
        expect(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 12, 1) }))).toBe('11:12');
        expect(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 12, 59) }))).toBe('11:12');
        expect(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 59, 59) }))).toBe('11:59');
    });

    it('follows the renderer time zone instead of a fixed offset, including DST shifts', () => {
        process.env.TZ = 'America/New_York';
        try {
            expect(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 0, 15, 17, 0) }))).toBe('12:00'); // EST, UTC-5
            expect(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 6, 15, 16, 0) }))).toBe('12:00'); // EDT, UTC-4
        } finally {
            process.env.TZ = TEST_TZ;
        }
        expect(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 0, 15, 17, 0) }))).toBe('20:00');
    });

    it('advances with the time offset of the track', () => {
        const start = Date.UTC(2026, 9, 2, 8, 12);

        expect(formatGhostRunClock(makeFrame({ timeOffset: 0, timestampMs: start }))).toBe('11:12');
        expect(formatGhostRunClock(makeFrame({ timeOffset: 3600, timestampMs: start + 3_600_000 }))).toBe('12:12');
        expect(formatGhostRunClock(makeFrame({ timeOffset: 86_400, timestampMs: start + 86_400_000 }))).toBe('11:12');
    });
});

describe('formatGhostRunClock (sources and fallbacks)', () => {
    it('prefers the frame’s own recording time', () => {
        const frame = makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 12) });
        const route = makeRoute({ startTimestampMs: Date.UTC(2026, 9, 2, 20, 0) });

        expect(formatGhostRunClock(frame, route)).toBe('11:12');
    });

    it('falls back to the route start plus the time offset when the frame carries no timestamp', () => {
        const frame = makeFrame({ timeOffset: 120 });
        const route = makeRoute({ startTimestampMs: Date.UTC(2026, 9, 2, 8, 12) });

        expect(formatGhostRunClock(frame, route)).toBe('11:14');
        expect(formatGhostRunClock(frame, route)).toBe(localClock(Date.UTC(2026, 9, 2, 8, 14)));
    });

    it('agrees between the direct and the route-derived source for consistent data', () => {
        const start = Date.UTC(2026, 9, 2, 8, 12);
        const route = makeRoute({ startTimestampMs: start });
        const direct = makeFrame({ timeOffset: 600, timestampMs: start + 600_000 });
        const derived = makeFrame({ timeOffset: 600 });

        expect(formatGhostRunClock(derived, route)).toBe(formatGhostRunClock(direct, route));
    });

    it('crosses midnight when the offset pushes the instant into the next day', () => {
        const route = makeRoute({ startTimestampMs: Date.UTC(2026, 9, 2, 20, 30) }); // 23:30 local
        const frame = makeFrame({ timeOffset: 3600 });

        expect(formatGhostRunClock(frame, route)).toBe('00:30');
    });

    it('ignores an epoch placeholder on the frame when the route knows the real start', () => {
        const frame = makeFrame({ timestampMs: 0 });
        const route = makeRoute({ startTimestampMs: Date.UTC(2026, 9, 2, 8, 12) });

        expect(formatGhostRunClock(frame, route)).toBe('11:12');
    });

    it('derives the route start from the first frame, honouring a non-zero first offset', () => {
        const frames = [
            makeFrame({ timeOffset: 60, timestampMs: Date.UTC(2026, 9, 2, 10, 0) }),
            makeFrame({ timeOffset: 120 }),
        ];
        const route = getGhostRunRoute(frames);

        expect(route.startTimestampMs).toBe(Date.UTC(2026, 9, 2, 9, 59));
        expect(formatGhostRunClock(frames[1]!, route)).toBe('13:01');
        expect(formatGhostRunClock(frames[1]!, route)).toBe(formatGhostRunClock(makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 10, 1) }), route));
    });
});

describe('formatGhostRunClock (missing absolute time)', () => {
    it('returns undefined when neither the frame nor the route knows absolute time', () => {
        expect(formatGhostRunClock(makeFrame())).toBeUndefined();
        expect(formatGhostRunClock(makeFrame(), makeRoute())).toBeUndefined();
    });

    it('returns undefined for a non-finite frame timestamp', () => {
        expect(formatGhostRunClock(makeFrame({ timestampMs: Number.NaN }))).toBeUndefined();
        expect(formatGhostRunClock(makeFrame({ timestampMs: Number.POSITIVE_INFINITY }))).toBeUndefined();
        expect(formatGhostRunClock(makeFrame({ timestampMs: Number.NEGATIVE_INFINITY }))).toBeUndefined();
    });

    it('returns undefined when the route start is missing or not a number', () => {
        expect(formatGhostRunClock(makeFrame(), makeRoute({ startTimestampMs: undefined }))).toBeUndefined();
        expect(formatGhostRunClock(makeFrame(), makeRoute({ startTimestampMs: Number.NaN }))).toBeUndefined();
        expect(formatGhostRunClock(makeFrame(), makeRoute({ startTimestampMs: Number.POSITIVE_INFINITY }))).toBeUndefined();
    });

    it('returns undefined when the offset needed for the fallback is not usable', () => {
        const route = makeRoute({ startTimestampMs: Date.UTC(2026, 9, 2, 8, 12) });

        expect(formatGhostRunClock(makeFrame({ timeOffset: Number.NaN }), route)).toBeUndefined();
        expect(formatGhostRunClock(makeFrame({ timeOffset: Number.POSITIVE_INFINITY }), route)).toBeUndefined();
    });

    it('treats epoch and negative timestamps as “no absolute time”', () => {
        expect(formatGhostRunClock(makeFrame({ timestampMs: 0 }))).toBeUndefined();
        expect(formatGhostRunClock(makeFrame({ timestampMs: -1 }))).toBeUndefined();
        expect(formatGhostRunClock(makeFrame(), makeRoute({ startTimestampMs: 0 }))).toBeUndefined();
        expect(formatGhostRunClock(makeFrame(), makeRoute({ startTimestampMs: -86_400_000 }))).toBeUndefined();
    });

    it('returns undefined for timestamps outside the representable date range', () => {
        expect(formatGhostRunClock(makeFrame({ timestampMs: 1e21 }))).toBeUndefined();
        expect(formatGhostRunClock(makeFrame({ timestampMs: -1e21 }))).toBeUndefined();
    });

    it('returns undefined when the frame is entirely invalid, without throwing', () => {
        const broken = { timeOffset: Number.NaN, distanceKm: Number.NaN, elapsedTime: '', movingTimeSeconds: Number.NaN } as TelemetryFrame;

        expect(() => formatGhostRunClock(broken)).not.toThrow();
        expect(formatGhostRunClock(broken)).toBeUndefined();
    });

    it('builds a route without a start when the track itself has no timestamps', () => {
        const frames = [makeFrame({ timeOffset: 0 }), makeFrame({ timeOffset: 30 })];
        const route = getGhostRunRoute(frames);

        expect(route.startTimestampMs).toBeUndefined();
        expect(formatGhostRunClock(frames[1]!, route)).toBeUndefined();
    });
});

describe('renderGhostRunLayout clock', () => {
    const sizes: Array<[number, number]> = [[1920, 1080], [1080, 1920], [640, 360], [320, 180], [320, 568]];

    it('draws the clock in the top-right corner', () => {
        const { ctx, texts } = createRenderContext();
        const frame = makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 12) });

        renderGhostRunLayout(ctx, frame, 1920, 1080, clockConfig(), {});

        const clock = clocksIn(texts).filter((text) => text.align === 'right' && text.kind === 'fill');
        expect(clock).toHaveLength(1);
        expect(clock[0]!.value).toBe('11:12');
        expect(clock[0]!.x).toBeGreaterThanOrEqual(1920 - 1080 * 0.05); // flush with the right edge
        expect(clock[0]!.y).toBeLessThanOrEqual(1080 * 0.15); // inside the top strip
        expect(texts.some((text) => text.value.includes('UTC'))).toBe(false);
    });

    it('keeps the clock in the top-right corner across landscape and portrait sizes', () => {
        for (const [w, h] of sizes) {
            const { ctx, texts } = createRenderContext();
            const frame = makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 12) });

            renderGhostRunLayout(ctx, frame, w, h, clockConfig(), {});

            const clock = clocksIn(texts).filter((text) => text.align === 'right' && text.kind === 'fill');
            expect(clock.map((entry) => entry.value), `${w}x${h}`).toEqual(['11:12']);
            expect(clock[0]!.x, `${w}x${h}`).toBeGreaterThanOrEqual(w - Math.min(w, h) * 0.05);
            expect(clock[0]!.y, `${w}x${h}`).toBeLessThanOrEqual(h * 0.15);
        }
    });

    it('draws no clock at all when the track has no absolute time, while the HUD still renders', () => {
        const { ctx, texts } = createRenderContext();
        const frame = makeFrame();

        renderGhostRunLayout(ctx, frame, 1920, 1080, clockConfig(), {});

        expect(clocksIn(texts)).toHaveLength(0);
        expect(texts.some((text) => text.value.includes('UTC'))).toBe(false);
        // The rest of the HUD (the ELAPSED rail value) is unaffected.
        expect(texts.some((text) => text.value === '123:59:59')).toBe(true);
    });

    it('draws no clock when the route start cannot be trusted', () => {
        const { ctx, texts } = createRenderContext();

        renderGhostRunLayout(ctx, makeFrame({ timeOffset: 120 }), 1920, 1080, clockConfig(),
            { ghostRoute: makeRoute({ startTimestampMs: Number.NaN }) });

        expect(clocksIn(texts)).toHaveLength(0);
    });

    it('draws no clock when the template hides the time metric', () => {
        const { ctx, texts } = createRenderContext();
        const frame = makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 12) });

        renderGhostRunLayout(ctx, frame, 1920, 1080, clockConfig({ showTime: false }), {});

        expect(clocksIn(texts)).toHaveLength(0);
        expect(texts.some((text) => text.value === 'ELAPSED')).toBe(false);
    });

    it('draws the same clock with and without the route in the render context', () => {
        const frame = makeFrame({ timeOffset: 600 });
        const route = makeRoute({ startTimestampMs: Date.UTC(2026, 9, 2, 8, 12) });

        const withoutRoute = createRenderContext();
        renderGhostRunLayout(withoutRoute.ctx, makeFrame({ timeOffset: 600, timestampMs: Date.UTC(2026, 9, 2, 8, 22) }),
            1920, 1080, clockConfig(), {});

        const withRoute = createRenderContext();
        renderGhostRunLayout(withRoute.ctx, frame, 1920, 1080, clockConfig(), { ghostRoute: route });

        expect(clocksIn(withoutRoute.texts).map((entry) => entry.value))
            .toEqual(clocksIn(withRoute.texts).map((entry) => entry.value));
        expect(clocksIn(withRoute.texts)[0]!.value).toBe('11:22');
    });

    it('paints the clock contour and fill with the same value when text shadow is on', () => {
        const { ctx, texts } = createRenderContext();
        const frame = makeFrame({ timestampMs: Date.UTC(2026, 9, 2, 8, 12) });

        renderGhostRunLayout(ctx, frame, 1920, 1080, clockConfig({ textShadow: true }), {});

        expect(texts.filter((text) => text.value === '11:12')).toHaveLength(2); // stroke + fill
    });

    it('still renders the HUD without throwing for frames with unusable time data', () => {
        const { ctx, texts } = createRenderContext();
        const broken = makeFrame({ timeOffset: Number.NaN, timestampMs: Number.NaN });

        expect(() => renderGhostRunLayout(ctx, broken, 640, 360, clockConfig(), {})).not.toThrow();
        expect(clocksIn(texts)).toHaveLength(0);
    });
});
