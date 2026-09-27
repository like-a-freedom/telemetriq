import { describe, expect, it, vi } from 'vitest';

import type { OverlayContext2D } from '../core/types';
import { drawArcGauge } from '../modules/layouts/arcGaugeLayout';
import { getOrientation } from '../modules/layouts/shared';
import { getResolutionTuning } from '../modules/overlayUtils';
import { getTemplateConfig } from '../modules/templateConfigs';
import { getTemplateDefinition } from '../modules/templates/registry';

type DrawnText = { text: string; font: string; letterSpacing: string };

function createContext(): OverlayContext2D & { drawnText: DrawnText[] } {
    const drawnText: DrawnText[] = [];
    const context: Partial<OverlayContext2D> & { drawnText: DrawnText[] } = { drawnText };
    Object.assign(context, {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: text.length * 8 } as TextMetrics)),
        strokeText: vi.fn(),
        fillText: vi.fn((text: string) => {
            drawnText.push({
                text,
                font: String(context.font),
                letterSpacing: String(context.letterSpacing),
            });
        }),
    });
    return context as OverlayContext2D & { drawnText: DrawnText[] };
}

describe('Arc Gauge typography', () => {
    it('aligns track and progress geometry and uses round caps for every layer', () => {
        for (const pace of ['03:00', '05:30', '10:00']) {
            const ctx = createContext();
            const caps: string[] = [];
            vi.mocked(ctx.stroke).mockImplementation(() => { caps.push(ctx.lineCap); });
            drawArcGauge(ctx, { pace } as never, 1280, 720, getTemplateConfig('arc-gauge'),
                getOrientation(1280, 720), getResolutionTuning(1280, 720));
            const arcs = vi.mocked(ctx.arc).mock.calls;
            expect(arcs).toHaveLength(pace === '10:00' ? 2 : 3);
            expect(arcs[0]).toEqual(arcs[1]);
            expect(arcs[0]?.slice(3)).toEqual([Math.PI, Math.PI * 2, false]);
            if (pace !== '10:00') expect(arcs[2]?.slice(0, 4)).toEqual(arcs[1]?.slice(0, 4));
            expect(caps.every((cap) => cap === 'round')).toBe(true);
            expect(ctx.fill).not.toHaveBeenCalled();
        }
    });

    it('hides labels while retaining values and units', () => {
        const ctx = createContext();
        drawArcGauge(ctx, { pace: '05:30', heartRate: '150', distance: '10.2', time: '00:45:12' } as never,
            320, 568, { ...getTemplateConfig('arc-gauge'), labelStyle: 'hidden' },
            getOrientation(320, 568), getResolutionTuning(320, 568));
        const text = ctx.drawnText.map((entry) => entry.text);
        for (const label of ['HR', 'DIST', 'ELAPSED']) expect(text).not.toContain(label);
        for (const value of ['05:30', '150', '10.2', '00:45:12', 'bpm', 'km', 'MIN / KM']) expect(text).toContain(value);
    });

    it('uses one medium value weight and tracked semibold labels from its template defaults', () => {
        const config = getTemplateConfig('arc-gauge');
        expect(config.valueFontWeight).toBe('normal');
        expect(config.labelSizeMultiplier).toBe(0.55);

        const context = createContext();
        drawArcGauge(context, {
            pace: '05:42', heartRate: '172', distance: '18.42', time: '01:42:35',
        } as never, 1280, 720, config, getOrientation(1280, 720), getResolutionTuning(1280, 720));

        for (const value of ['05:42', '172', '18.42', '01:42:35']) {
            expect(context.drawnText.find((entry) => entry.text === value)?.font).toMatch(/^500 /);
        }
        for (const label of ['HR', 'DIST', 'ELAPSED']) {
            const entry = context.drawnText.find((drawn) => drawn.text === label);
            expect(entry?.font).toMatch(/^600 /);
            expect(Number.parseFloat(entry?.letterSpacing ?? '0')).toBeGreaterThan(0);
        }
        expect(context.drawnText.find((entry) => entry.text === 'MIN / KM')?.font).toMatch(/^500 /);
        expect(context.drawnText.find((entry) => entry.text === 'bpm')?.font).toMatch(/^500 /);
        expect(context.drawnText.find((entry) => entry.text === 'km')?.font).toMatch(/^500 /);
    });

    it('respects the bold value setting across the dial and side metrics', () => {
        const context = createContext();
        drawArcGauge(context, {
            pace: '05:42', heartRate: '172', distance: '18.42', time: '01:42:35',
        } as never, 1280, 720, {
            ...getTemplateConfig('arc-gauge'),
            valueFontWeight: 'bold',
        }, getOrientation(1280, 720), getResolutionTuning(1280, 720));

        for (const value of ['05:42', '172', '18.42', '01:42:35']) {
            expect(context.drawnText.find((entry) => entry.text === value)?.font).toMatch(/^700 /);
        }
    });

    it('keeps its declared type system aligned with the renderer', () => {
        const template = getTemplateDefinition('arc-gauge');
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe('medium');
        expect(template?.styles.typography.labelFontWeight).toBe('semibold');
        expect(template?.styles.typography.valueSizeMultiplier).toBe(template?.config.valueSizeMultiplier);
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.spacing.lineSpacing).toBe(template?.config.lineSpacing);
    });

    it('keeps the light setting consistent across the dial and side metrics', () => {
        const context = createContext();
        drawArcGauge(context, {
            pace: '05:42', heartRate: '172', distance: '18.42', time: '01:42:35',
        } as never, 1280, 720, {
            ...getTemplateConfig('arc-gauge'),
            valueFontWeight: 'light',
        }, getOrientation(1280, 720), getResolutionTuning(1280, 720));

        for (const value of ['05:42', '172', '18.42', '01:42:35']) {
            expect(context.drawnText.find((entry) => entry.text === value)?.font).toMatch(/^300 /);
        }
    });
});
