import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderOverlay, DEFAULT_OVERLAY_CONFIG } from '../modules/overlay-renderer';
import type { TelemetryFrame } from '../core/types';

type StubContext = {
    canvas: unknown;
    font: string;
    fillStyle: string | CanvasGradient;
    strokeStyle: string;
    textBaseline: CanvasTextBaseline;
    textAlign: string;
    lineWidth: number;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    measureText: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    roundRect: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    arc: ReturnType<typeof vi.fn>;
    createLinearGradient: ReturnType<typeof vi.fn>;
    translate: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
};

let offscreenCreateCount = 0;
const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

const fakeGradient = {
    addColorStop: vi.fn(),
};

function createStubContext(canvasRef: unknown): StubContext {
    return {
        canvas: canvasRef,
        font: '',
        fillStyle: '',
        strokeStyle: '',
        textBaseline: 'top',
        textAlign: 'left',
        lineWidth: 1,
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        createLinearGradient: vi.fn(() => fakeGradient),
        translate: vi.fn(),
        rotate: vi.fn(),
    };
}

class FakeOffscreenCanvas {
    width = 0;
    height = 0;
    private readonly ctx: StubContext;

    constructor(width: number, height: number) {
        offscreenCreateCount += 1;
        this.width = width;
        this.height = height;
        this.ctx = createStubContext(this);
    }

    getContext(type: '2d'): StubContext | null {
        if (type !== '2d') return null;
        return this.ctx;
    }
}

describe('Overlay Renderer', () => {
    beforeEach(() => {
        offscreenCreateCount = 0;
        (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = FakeOffscreenCanvas;
    });

    afterEach(() => {
        (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas;
    });

    it('should skip drawing when all overlay fields are disabled', () => {
        const destinationCtx = createStubContext({ id: 'dest-empty' }) as unknown as CanvasRenderingContext2D;
        const frame: TelemetryFrame = {
            timeOffset: 10,
            distanceKm: 1.2,
            elapsedTime: '00:00:10',
            movingTimeSeconds: 10,
        };

        renderOverlay(destinationCtx, frame, 640, 360, {
            ...DEFAULT_OVERLAY_CONFIG,
            showHr: false,
            showPace: false,
            showDistance: false,
            showTime: false,
            showElevation: false,
            showCadence: false,
        });

        const drawCalls = (destinationCtx as unknown as StubContext).drawImage;
        expect(drawCalls).not.toHaveBeenCalled();
    });

    it('should render overlay without throwing', () => {
        const ctx = createStubContext({ id: 'dest-basic' }) as unknown as CanvasRenderingContext2D;

        const frame: TelemetryFrame = {
            timeOffset: 60,
            hr: 150,
            paceSecondsPerKm: 300,
            distanceKm: 2.5,
            elapsedTime: '00:01:00',
            movingTimeSeconds: 60,
        };

        expect(() => renderOverlay(ctx, frame, 640, 360, DEFAULT_OVERLAY_CONFIG)).not.toThrow();
        expect((ctx as unknown as StubContext).drawImage).toHaveBeenCalledTimes(1);
    });

    it('should use cache for repeated render with identical frame/config', () => {
        const frame: TelemetryFrame = {
            timeOffset: 120,
            hr: 147,
            paceSecondsPerKm: 320,
            distanceKm: 3.42,
            elapsedTime: '00:02:00',
            movingTimeSeconds: 120,
        };

        const ctx1 = createStubContext({ id: 'dest-first' }) as unknown as CanvasRenderingContext2D;
        const ctx2 = createStubContext({ id: 'dest-second' }) as unknown as CanvasRenderingContext2D;

        renderOverlay(ctx1, frame, 1280, 720, DEFAULT_OVERLAY_CONFIG);
        const createdAfterFirstRender = offscreenCreateCount;

        renderOverlay(ctx2, frame, 1280, 720, DEFAULT_OVERLAY_CONFIG);

        expect((ctx2 as unknown as StubContext).drawImage).toHaveBeenCalledTimes(1);
        expect(offscreenCreateCount).toBe(createdAfterFirstRender);
    });
});
