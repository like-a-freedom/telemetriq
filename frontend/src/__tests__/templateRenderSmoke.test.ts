/**
 * Cross-cutting render smoke tests:
 * every registered template must reach a working renderer through
 * `renderOverlay` (a registered-but-unwired layout would draw nothing),
 * and the Ghost Run HUD must request its bundled fonts first.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { fontSpy } = vi.hoisted(() => ({ fontSpy: vi.fn(async () => undefined) }));

vi.mock('../modules/trailRunFonts', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../modules/trailRunFonts')>();
    return { ...actual, ensureTrailRunFonts: fontSpy };
});

import { renderOverlay } from '../modules/overlayRenderer';
import { TEMPLATE_IDS, getTemplateConfig } from '../modules/templates';
import type { TelemetryFrame } from '../core/types';

const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

interface StubContext {
    canvas: unknown;
    ink: number;
    texts: string[];
    font: string;
    fillStyle: string | CanvasGradient;
    strokeStyle: string;
    globalAlpha: number;
    letterSpacing: string;
    textAlign: string;
    textBaseline: string;
    lineJoin: string;
    lineCap: string;
    lineWidth: number;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    measureText: (text: string) => { width: number };
    [method: string]: unknown;
}

function createStubContext(canvasRef: unknown): StubContext {
    let currentFont = '';
    const paint = () => {
        stub.ink += 1;
    };
    const stub = {
        canvas: canvasRef,
        ink: 0,
        texts: [] as string[],
        get font() {
            return currentFont;
        },
        set font(value: string) {
            currentFont = value;
        },
        measureText: (text: string) => {
            const size = Number(currentFont.match(/([\d.]+)px/)?.[1] ?? 16);
            return { width: text.length * size * 0.5 };
        },
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
        fillText: (value: string) => {
            stub.ink += 1;
            stub.texts.push(value);
        },
        strokeText: (value: string) => {
            stub.ink += 1;
            stub.texts.push(value);
        },
        fill: paint,
        stroke: paint,
        fillRect: paint,
        strokeRect: paint,
        roundRect: paint,
        save: () => undefined,
        restore: () => undefined,
        beginPath: () => undefined,
        closePath: () => undefined,
        moveTo: () => undefined,
        lineTo: () => undefined,
        quadraticCurveTo: () => undefined,
        bezierCurveTo: () => undefined,
        arc: () => undefined,
        arcTo: () => undefined,
        translate: () => undefined,
        rotate: () => undefined,
        transform: () => undefined,
        scale: () => undefined,
        clip: () => undefined,
        setLineDash: () => undefined,
        clearRect: () => undefined,
        drawImage: () => undefined,
        createLinearGradient: () => ({ addColorStop: () => undefined }),
        createRadialGradient: () => ({ addColorStop: () => undefined }),
    };
    return stub as unknown as StubContext;
}

class FakeOffscreenCanvas {
    width = 0;
    height = 0;
    private readonly ctx: StubContext;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.ctx = createStubContext(this);
    }

    getContext(type: '2d'): StubContext | null {
        return type === '2d' ? this.ctx : null;
    }
}

const overlayCanvases: StubContext[] = [];

function createDestination(id: string): CanvasRenderingContext2D {
    return createStubContext({ id }) as unknown as CanvasRenderingContext2D;
}

const fullFrame: TelemetryFrame = {
    timeOffset: 120,
    hr: 158,
    paceSecondsPerKm: 314,
    speedKmh: 18.4,
    distanceKm: 2.8,
    elapsedTime: '00:02:00',
    movingTimeSeconds: 120,
    totalElapsedSeconds: 120,
    gradePercent: 4.2,
    elevationM: 512,
    cadenceRpm: 86,
    powerWatts: 240,
    latitude: 46.5,
    longitude: 8.02,
    timestampMs: Date.UTC(2026, 9, 2, 8, 14),
};

function inkDrawnIn(overlayCanvasesForRender: StubContext[]): number {
    return overlayCanvasesForRender.reduce((total, ctx) => total + ctx.ink, 0);
}

/** Text that must never reach the video: broken numbers and missing placeholders. */
const INVALID_TEXT = /NaN|undefined|Infinity|Invalid|\[object/;

const sparseFrame: TelemetryFrame = {
    timeOffset: 0,
    distanceKm: 0,
    elapsedTime: '0:00',
    movingTimeSeconds: 0,
};

const brokenFrame: TelemetryFrame = {
    timeOffset: 0,
    distanceKm: Number.NaN,
    elapsedTime: 'NaN:NaN',
    movingTimeSeconds: Number.NaN,
    hr: Number.NaN,
    paceSecondsPerKm: Number.NaN,
    speedKmh: Number.NaN,
    gradePercent: Number.NaN,
    elevationM: Number.NaN,
    cadenceRpm: Number.NaN,
    powerWatts: Number.POSITIVE_INFINITY,
};

const mixedFrame: TelemetryFrame = {
    timeOffset: 60,
    distanceKm: 2.5,
    elapsedTime: '00:01:00',
    movingTimeSeconds: 60,
    hr: 148,
    paceSecondsPerKm: Number.NaN,
    speedKmh: Number.NaN,
    gradePercent: Number.NaN,
    elevationM: 123,
    cadenceRpm: Number.NaN,
    powerWatts: Number.NaN,
};

async function renderFor(
    templateId: string,
    frame: TelemetryFrame,
    size: [number, number],
    configOverride?: Record<string, unknown>,
): Promise<string[]> {
    const before = overlayCanvases.length;
    const ctx = createDestination(`dest-${templateId}-${before}`);
    await renderOverlay(ctx, frame, size[0], size[1], {
        ...getTemplateConfig(templateId),
        ...(configOverride ?? {}),
    });
    return overlayCanvases.slice(before).flatMap((canvas) => canvas.texts);
}

function invalidTexts(texts: string[]): string[] {
    return [...new Set(texts.filter((value) => INVALID_TEXT.test(value)))];
}

describe('renderOverlay template smoke', () => {
    beforeEach(() => {
        overlayCanvases.length = 0;
        fontSpy.mockClear();
        (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = class extends FakeOffscreenCanvas {
            getContext(type: '2d'): StubContext | null {
                const ctx = super.getContext(type);
                if (ctx && !overlayCanvases.includes(ctx)) overlayCanvases.push(ctx);
                return ctx;
            }
        };
    });

    afterEach(() => {
        (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas;
    });

    it('draws visible ink for every registered template', async () => {
        const failures: string[] = [];

        for (const templateId of TEMPLATE_IDS) {
            const before = overlayCanvases.length;
            const ctx = createDestination(`dest-${templateId}`);

            await renderOverlay(ctx, fullFrame, 640, 360, getTemplateConfig(templateId));

            const canvases = overlayCanvases.slice(before);
            if (!canvases.length || inkDrawnIn(canvases) === 0) {
                failures.push(templateId);
            }
        }

        expect(failures).toEqual([]);
    });

    it('requests the Ghost Run HUD fonts before drawing the overlay', async () => {
        const ctx = createDestination('dest-ghost-fonts');

        await renderOverlay(ctx, fullFrame, 640, 360, getTemplateConfig('ghost-run'));

        expect(fontSpy).toHaveBeenCalledTimes(1);
        expect(inkDrawnIn(overlayCanvases)).toBeGreaterThan(0);
    });

    it('never paints invalid numbers when every value in the frame is broken', async () => {
        const leaks: Record<string, string[]> = {};

        for (const templateId of TEMPLATE_IDS) {
            const invalid = invalidTexts(await renderFor(templateId, brokenFrame, [1280, 720]));
            if (invalid.length) leaks[templateId] = invalid;
        }

        expect(leaks).toEqual({});
    });

    it('renders partial metric sets while silently dropping broken neighbours', async () => {
        const leaks: Record<string, string[]> = {};

        for (const templateId of TEMPLATE_IDS) {
            const invalid = invalidTexts(await renderFor(templateId, mixedFrame, [1280, 720]));
            if (invalid.length) leaks[templateId] = invalid;
        }

        expect(leaks).toEqual({});
    });

    it('never paints invalid numbers for a frame with no telemetry at all', async () => {
        const leaks: Record<string, string[]> = {};

        for (const templateId of TEMPLATE_IDS) {
            const invalid = invalidTexts(await renderFor(templateId, sparseFrame, [1280, 720]));
            if (invalid.length) leaks[templateId] = invalid;
        }

        expect(leaks).toEqual({});
    });

    it('renders every template on degenerate frame sizes without throwing', async () => {
        const failures: string[] = [];

        for (const templateId of TEMPLATE_IDS) {
            for (const [width, height] of [[48, 48], [80, 60], [96, 96], [40, 1000], [1000, 40], [64, 0], [0, 0]] as Array<[number, number]>) {
                try {
                    await renderFor(templateId, brokenFrame, [width, height]);
                } catch (error) {
                    failures.push(`${templateId}@${width}x${height}: ${(error as Error).message}`);
                }
            }
        }

        expect(failures).toEqual([]);
    });

    it('keeps extreme typography controls free of invalid text on a broken frame', async () => {
        const leaks: Record<string, string[]> = {};
        const extreme = { fontSizePercent: 8, valueSizeMultiplier: 2.5, labelSizeMultiplier: 1.2, labelLetterSpacing: 0.4, lineSpacing: 1.6 };

        for (const templateId of TEMPLATE_IDS) {
            const invalid = invalidTexts(await renderFor(templateId, brokenFrame, [320, 568], extreme));
            if (invalid.length) leaks[templateId] = invalid;
        }

        expect(leaks).toEqual({});
    });
});
