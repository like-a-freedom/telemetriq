import { describe, expect, it } from 'vitest';
import { shouldAvoidInlineResultPreview } from '../modules/browserCapabilities';

describe('shouldAvoidInlineResultPreview', () => {
    it('returns true for iPhone Safari', () => {
        expect(shouldAvoidInlineResultPreview({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
            maxTouchPoints: 5,
        })).toBe(true);
    });

    it('returns true for iPad desktop-mode Safari', () => {
        expect(shouldAvoidInlineResultPreview({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            maxTouchPoints: 5,
        })).toBe(true);
    });

    it('returns false for desktop Safari without touch input', () => {
        expect(shouldAvoidInlineResultPreview({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            maxTouchPoints: 0,
        })).toBe(false);
    });
});