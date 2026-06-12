import { describe, it, expect, vi, beforeEach } from 'vitest';

const compositeOverlayMock = vi.fn(async () => true);
const isEnabledMock = vi.fn(() => true);

vi.mock('../modules/webgpu/webgpuAdapter', () => ({
    WebGPUAdapter: {
        isSupported: () => true,
        getInstance: () => ({
            isEnabled: isEnabledMock,
            compositeOverlay: compositeOverlayMock,
        }),
    },
}));

import { renderOverlay, DEFAULT_OVERLAY_CONFIG } from '../modules/overlayRenderer';
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
        this.width = width;
        this.height = height;
        this.ctx = createStubContext(this);
    }

    getContext(type: '2d'): StubContext | null {
        if (type !== '2d') return null;
        return this.ctx;
    }
}

const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

const frame: TelemetryFrame = {
    timeOffset: 60,
    hr: 150,
    paceSecondsPerKm: 300,
    distanceKm: 2.5,
    elapsedTime: '00:01:00',
    movingTimeSeconds: 60,
};

describe('overlayRenderer preview compositing mode', () => {
    beforeEach(() => {
        compositeOverlayMock.mockClear();
        isEnabledMock.mockClear();
        (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = FakeOffscreenCanvas;
    });

    it('skips WebGPU compositing for transparent preview-layer canvases', async () => {
        const ctx = createStubContext({ id: 'preview-layer' }) as unknown as CanvasRenderingContext2D;

        await renderOverlay(ctx, frame, 640, 360, DEFAULT_OVERLAY_CONFIG);

        expect(compositeOverlayMock).not.toHaveBeenCalled();
        expect((ctx as unknown as StubContext).drawImage).toHaveBeenCalledTimes(1);
    });

    it('uses WebGPU compositing when destination already contains a base frame', async () => {
        const ctx = createStubContext({ id: 'video-frame' }) as unknown as CanvasRenderingContext2D;

        await renderOverlay(ctx, frame, 641, 360, DEFAULT_OVERLAY_CONFIG, {
            destinationHasBaseFrame: true,
        });

        expect(isEnabledMock).toHaveBeenCalled();
        expect(compositeOverlayMock).toHaveBeenCalledTimes(1);
    });
});

afterEach(() => {
    (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas;
});
