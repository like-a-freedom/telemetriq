import { describe, expect, it, vi } from 'vitest';

import type { OverlayContext2D } from '../core/types';
import { drawHeroNumber } from '../modules/layouts/heroNumberLayout';
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

describe('Hero Number typography', () => {
    it('keeps the headline dominant and applies fitted tracking to labels only', () => {
        const config = getTemplateConfig('hero-number');
        expect(config.labelSizeMultiplier).toBe(0.65);
        expect(config.labelLetterSpacing).toBe(0.14);

        const context = createContext();
        drawHeroNumber(context, {
            pace: '05:42', heartRate: '172', distance: '18.42', time: '01:42:35',
        } as never, 1280, 720, config, getOrientation(1280, 720), getResolutionTuning(1280, 720));

        const pace = context.drawnText.find((entry) => entry.text === '05:42');
        const paceLabel = context.drawnText.find((entry) => entry.text === 'MIN / KM');
        expect(Number.parseFloat(pace?.font.match(/([\d.]+)px/)?.[1] ?? '0'))
            .toBeGreaterThan(Number.parseFloat(context.drawnText.find((entry) => entry.text === '172')
                ?.font.match(/([\d.]+)px/)?.[1] ?? '0'));
        expect(pace?.font).toMatch(/^700 /);
        expect(pace?.letterSpacing).toBe('0px');
        expect(paceLabel?.font).toMatch(/^600 /);
        expect(Number.parseFloat(paceLabel?.letterSpacing ?? '0')).toBeGreaterThan(0);

        for (const label of ['HR', 'DIST', 'ELAPSED']) {
            const entry = context.drawnText.find((drawn) => drawn.text === label);
            expect(entry?.font).toMatch(/^600 /);
            expect(Number.parseFloat(entry?.letterSpacing ?? '0')).toBeGreaterThan(0);
        }
        for (const unit of ['bpm', 'km']) {
            const entry = context.drawnText.find((drawn) => drawn.text === unit);
            expect(entry?.font).toMatch(/^500 /);
            expect(entry?.letterSpacing).toBe('0px');
        }
    });

    it('keeps the selected template typography metadata aligned with its renderer defaults', () => {
        const template = getTemplateDefinition('hero-number');
        expect(template?.capabilities.supportedMetrics).toEqual(['pace', 'hr', 'distance', 'time']);
        expect(template?.styles.typography.fontFamily).toBe(template?.config.fontFamily);
        expect(template?.styles.typography.valueFontWeight).toBe(template?.config.valueFontWeight);
        expect(template?.styles.typography.labelFontWeight).toBe('semibold');
        expect(template?.styles.typography.labelSizeMultiplier).toBe(template?.config.labelSizeMultiplier);
        expect(template?.styles.typography.labelLetterSpacing).toBe(template?.config.labelLetterSpacing);
    });
});
