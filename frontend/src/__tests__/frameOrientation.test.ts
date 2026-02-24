import { describe, it, expect, vi } from 'vitest';
import { drawVideoFrameWithRotation, normalizeVideoRotation } from '../modules/frameOrientation';

describe('frame-orientation', () => {
    it('normalizes unexpected rotation to 0', () => {
        expect(normalizeVideoRotation(undefined)).toBe(0);
        expect(normalizeVideoRotation(45)).toBe(0);
        expect(normalizeVideoRotation(90)).toBe(90);
        expect(normalizeVideoRotation(180)).toBe(180);
        expect(normalizeVideoRotation(270)).toBe(270);
    });

    it('draws 90° frame with swapped dimensions and rotation transform', () => {
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            drawImage: vi.fn(),
        } as unknown as OffscreenCanvasRenderingContext2D;

        const frame = {} as VideoFrame;
        drawVideoFrameWithRotation(ctx, frame, 1080, 1920, 90);

        expect((ctx as any).save).toHaveBeenCalledTimes(1);
        expect((ctx as any).translate).toHaveBeenCalledWith(1080, 0);
        expect((ctx as any).rotate).toHaveBeenCalledWith(Math.PI / 2);
        expect((ctx as any).drawImage).toHaveBeenCalledWith(frame, 0, 0, 1920, 1080);
        expect((ctx as any).restore).toHaveBeenCalledTimes(1);
    });
});
