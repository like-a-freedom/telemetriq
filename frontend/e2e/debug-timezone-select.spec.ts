/// <reference types="node" />
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve(process.cwd(), 'test-results');
const SCREENSHOT = path.join(OUT_DIR, 'preview-timezone-open.png');
const STYLES_JSON = path.join(OUT_DIR, 'preview-timezone-styles.json');

test.use({ viewport: { width: 1920, height: 1080 }, browserName: 'chromium' });

test('inspect timezone select — screenshot + computed styles', async ({ page }) => {
    // E2E store helper: create fake files so the app allows /preview to render
    await page.goto('/?e2e=1');
    await page.evaluate(() => {
        const stores = (window as any).__e2eStores;
        stores.files.videoFile = new File([new Uint8Array([1])], 'video.mp4', { type: 'video/mp4' });
        stores.files.videoMeta = { duration: 5, width: 640, height: 360, fps: 30, codec: 'avc1', fileSize: 1, fileName: 'video.mp4' };
        stores.files.gpxFile = new File(['<gpx></gpx>'], 'track.gpx', { type: 'application/gpx+xml' });
        stores.files.gpxData = { name: 'Test', points: [{ lat: 55, lon: 37, time: new Date('2024-01-01T10:00:00Z') }], metadata: {} };
    });

    // Use the UI 'Proceed' button so routing/state behaves same as real flow
    const proceed = page.getByTestId('proceed-btn');
    await expect(proceed).toBeEnabled({ timeout: 2000 });
    await proceed.click();
    await page.waitForSelector('.preview-view', { state: 'visible' });

    // Ensure sync panel is visible (toggle if collapsed)
    const syncSection = page.locator('#sync-section');
    if (!(await syncSection.isVisible())) {
        const toggle = page.locator('[data-testid="sync-collapse-toggle"]');
        await toggle.click();
        await syncSection.waitFor({ state: 'visible' });
    }

    const tzSelect = page.locator('.preview-view__timezone-row select.preview-view__select');
    await tzSelect.scrollIntoViewIfNeeded();
    await expect(tzSelect).toBeVisible();

    // Capture computed styles (before opening)
    const before = await page.evaluate(() => {
        const s = document.querySelector('.preview-view__timezone-row select.preview-view__select') as HTMLElement;
        const t = document.querySelector('.template-dropdown__select') as HTMLElement;
        const cs = s && window.getComputedStyle(s);
        const ts = t && window.getComputedStyle(t);
        const getPseudo = (el: Element | null, name: '::before' | '::after') => {
            if (!el) return null;
            const p = window.getComputedStyle(el as Element, name as any);
            return { content: p.content, backgroundImage: p.backgroundImage, zIndex: p.zIndex };
        };
        return {
            devicePixelRatio: window.devicePixelRatio,
            timezoneSelect: s ? {
                className: s.className,
                inlineStyle: s.getAttribute('style'),
                backgroundImage: cs.backgroundImage,
                backgroundPosition: cs.backgroundPosition,
                backgroundSize: cs.backgroundSize,
                paddingRight: cs.paddingRight,
                color: cs.color,
                backgroundColor: cs.backgroundColor,
                appearance: (cs.appearance || (cs as any).webkitAppearance || null),
                webkitAppearance: (cs as any).webkitAppearance || null,
                zIndex: cs.zIndex,
                overflow: cs.overflow,
                pseudoBefore: getPseudo(s, '::before'),
                pseudoAfter: getPseudo(s, '::after')
            } : null,
            templateSelect: t ? {
                className: t.className,
                inlineStyle: t.getAttribute('style'),
                backgroundImage: ts.backgroundImage,
                backgroundPosition: ts.backgroundPosition,
                backgroundSize: ts.backgroundSize,
                paddingRight: ts.paddingRight,
                color: ts.color,
                backgroundColor: ts.backgroundColor
            } : null
        };
    });

    // Open the native dropdown (click) and screenshot the opened state
    await tzSelect.click();
    await page.waitForTimeout(250); // allow native dropdown to render
    await page.screenshot({ path: SCREENSHOT, fullPage: false });

    // Attempt to detect a UI listbox created by Chromium (usually not in DOM)
    const listboxInfo = await page.evaluate(() => {
        const el = document.querySelector('[role="listbox"], .select-list, .menu');
        if (!el) return null;
        const cs = window.getComputedStyle(el as Element);
        return { tag: el.tagName, class: el.className, styles: { backgroundColor: cs.backgroundColor, zIndex: cs.zIndex, overflow: cs.overflow } };
    });

    // collect matching CSS rules that touch background/background-image
    const matchedRules = await page.evaluate(() => {
        const el = document.querySelector('.preview-view__timezone-row select.preview-view__select') as Element;
        if (!el) return null;
        const rules: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
            let cssRules: CSSRuleList | null = null;
            try { cssRules = (sheet as CSSStyleSheet).cssRules; } catch (err) { continue; }
            for (const r of Array.from(cssRules || [])) {
                // Only style rules
                if ((r as CSSStyleRule).selectorText) {
                    const sel = (r as CSSStyleRule).selectorText;
                    try {
                        if (el.matches(sel) && /(background|background-image)\s*:/i.test((r as CSSStyleRule).cssText)) {
                            rules.push((r as CSSStyleRule).cssText);
                        }
                    } catch (e) {
                        // ignore invalid/matching selectors
                    }
                }
            }
        }
        return rules;
    });

    const result = { before, listboxInfo, matchedRules };

    // Save JSON and attach to test artifacts
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(STYLES_JSON, JSON.stringify(result, null, 2));

    // Basic sanity asserts
    expect(result.before.timezoneSelect).not.toBeNull();
    // Platform-agnostic visual check: ensure caret/background-image is present
    expect(result.before.timezoneSelect!.backgroundImage).toMatch(/(data:image|var\(--ui-caret\))/i);
});

test('DateTimePicker popup shows HH MM SS labels (e2e)', async ({ page }) => {
    await page.goto('/?e2e=1');
    await page.evaluate(() => {
        const stores = (window as any).__e2eStores;
        stores.files.videoFile = new File([new Uint8Array([1])], 'video.mp4', { type: 'video/mp4' });
        stores.files.videoMeta = { duration: 5, width: 640, height: 360, fps: 30, codec: 'avc1', fileSize: 1, fileName: 'video.mp4' };
        stores.files.gpxFile = new File(['<gpx></gpx>'], 'track.gpx', { type: 'application/gpx+xml' });
        stores.files.gpxData = { name: 'Test', points: [{ lat: 55, lon: 37, time: new Date('2024-01-01T10:00:00Z') }], metadata: {} };
    });

    const proceed = page.getByTestId('proceed-btn');
    await expect(proceed).toBeEnabled({ timeout: 2000 });
    await proceed.click();
    await page.waitForSelector('.preview-view', { state: 'visible' });

    const syncSection = page.locator('#sync-section');
    if (!(await syncSection.isVisible())) {
        const toggle = page.locator('[data-testid="sync-collapse-toggle"]');
        await toggle.click();
        await syncSection.waitFor({ state: 'visible' });
    }

    const dtControl = page.locator('.datetime-picker__control');
    await expect(dtControl).toBeVisible();
    await dtControl.click();

    const popup = page.locator('.datetime-picker__popup');
    await expect(popup).toBeVisible();

    await expect(popup.getByText('HH', { exact: true })).toBeVisible();
    await expect(popup.getByText('MM', { exact: true })).toBeVisible();
    await expect(popup.getByText('SS', { exact: true })).toBeVisible();

    // save popup screenshot for visual regression if needed
    const fn = path.join(OUT_DIR, 'datetime-picker-popup.png');
    await popup.screenshot({ path: fn });
});