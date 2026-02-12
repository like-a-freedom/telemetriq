import { describe, it, expect } from 'vitest';
import { renderOverlay, DEFAULT_OVERLAY_CONFIG } from '../modules/overlay-renderer';
import type { TelemetryFrame } from '../core/types';

describe('Overlay Renderer', () => {
    it('should render overlay without throwing', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d') || (function () {
            // Minimal 2D context stub for environments without canvas support
            return {
                font: '',
                textBaseline: 'top',
                measureText: (t: string) => ({ width: t.length * 6 }),
                beginPath: () => { },
                roundRect: () => { },
                fill: () => { },
                save: () => { },
                restore: () => { },
                fillText: () => { },
                drawImage: () => { },
            } as unknown as CanvasRenderingContext2D;
        })();

        const frame: TelemetryFrame = {
            timeOffset: 60,
            hr: 150,
            paceSecondsPerKm: 300,
            distanceKm: 2.5,
            elapsedTime: '00:01:00',
            movingTimeSeconds: 60,
        };

        expect(() => renderOverlay(ctx!, frame, 640, 360, DEFAULT_OVERLAY_CONFIG)).not.toThrow();
    });
});
