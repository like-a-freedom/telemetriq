import { describe, expect, it } from 'vitest';
import {
    getVideoProcessingDeviceProfile,
    shouldAvoidInlineResultPreview,
} from '../modules/browserCapabilities';

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

describe('getVideoProcessingDeviceProfile', () => {
    it('returns a more conservative processing profile for iPhone WebKit', () => {
        expect(getVideoProcessingDeviceProfile({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
            maxTouchPoints: 5,
        })).toEqual({
            maxInFlightFrameTasks: 2,
            codecQueueHighWatermark: 12,
            profileName: 'apple-mobile-webkit',
        });
    });

    it('keeps the default processing profile for desktop browsers', () => {
        expect(getVideoProcessingDeviceProfile({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            maxTouchPoints: 0,
        })).toEqual({
            maxInFlightFrameTasks: 3,
            codecQueueHighWatermark: 24,
            profileName: 'default',
        });
    });
});