/**
 * Regression tests for pace calculation with real GPX files.
 * These tests require DOMParser (browser API).
 */
import { describe, it } from 'vitest';

describe('pace real GPX regression', () => {
    it.skip('dji track should not produce running pace in walking range (20+ min/km) within active segment - requires DOMParser', async () => {});
    it.skip('iphone track pace fallback should stay stable within one second - requires DOMParser', async () => {});
});
