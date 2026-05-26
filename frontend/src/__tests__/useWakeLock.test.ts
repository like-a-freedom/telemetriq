import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock onUnmounted to be safe outside component context
vi.mock('vue', async () => {
    const vue = await vi.importActual<typeof import('vue')>('vue');
    return {
        ...vue,
        onUnmounted: vi.fn(),
    };
});

describe('useWakeLock', () => {
    let visibilityHandlers: Array<(event: Event) => void> = [];
    let onWakeLockRelease: (() => void) | null = null;

    function fireVisibilityChange(visible: boolean): void {
        Object.defineProperty(document, 'visibilityState', {
            value: visible ? 'visible' : 'hidden',
            configurable: true,
        });
        // Invoke registered handlers manually because addEventListener is spied on
        const event = new Event('visibilitychange');
        for (const handler of visibilityHandlers) {
            handler(event);
        }
    }

    function setWakeLockSupported(): void {
        onWakeLockRelease = null;

        const mockSentinel = {
            release: vi.fn().mockResolvedValue(undefined),
            addEventListener: vi.fn((_event: string, handler: () => void) => {
                onWakeLockRelease = handler;
            }),
            type: 'screen' as WakeLockType,
        };

        Object.defineProperty(navigator, 'wakeLock', {
            value: {
                request: vi.fn().mockResolvedValue(mockSentinel),
            },
            configurable: true,
            writable: true,
        });

        vi.spyOn(document, 'addEventListener').mockImplementation((_event, handler) => {
            visibilityHandlers.push(handler as (e: Event) => void);
            return () => { };
        });

        vi.spyOn(document, 'removeEventListener').mockImplementation((_event, handler) => {
            visibilityHandlers = visibilityHandlers.filter((h) => h !== handler);
        });
    }

    function setWakeLockUnsupported(): void {
        delete (navigator as Record<string, unknown>).wakeLock;
    }

    function simulateBrowserRelease(): void {
        if (onWakeLockRelease) {
            onWakeLockRelease();
        }
    }

    beforeEach(async () => {
        visibilityHandlers = [];
        onWakeLockRelease = null;
        setWakeLockUnsupported();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        visibilityHandlers = [];
        onWakeLockRelease = null;
    });

    describe('initial state', () => {
        it('should report unsupported when navigator.wakeLock is absent', async () => {
            setWakeLockUnsupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            expect(lock.isSupported).toBe(false);
            expect(lock.isActive.value).toBe(false);
        });

        it('should report supported when navigator.wakeLock is present', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            expect(lock.isSupported).toBe(true);
            expect(lock.isActive.value).toBe(false);
        });
    });

    describe('request()', () => {
        it('should not throw when wake lock is unsupported', async () => {
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            await expect(lock.request()).resolves.toBeUndefined();
            expect(lock.isActive.value).toBe(false);
        });

        it('should acquire wake lock and set isActive', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            await lock.request();

            expect(navigator.wakeLock!.request).toHaveBeenCalledWith('screen');
            expect(lock.isActive.value).toBe(true);
        });

        it('should not re-request wake lock if already held', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            await lock.request();
            await lock.request();

            expect(navigator.wakeLock!.request).toHaveBeenCalledTimes(1);
        });

        it('should handle wake lock request rejection gracefully', async () => {
            setWakeLockSupported();
            (navigator.wakeLock!.request as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('permission denied'),
            );

            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            await expect(lock.request()).resolves.toBeUndefined();
            expect(lock.isActive.value).toBe(false);
        });
    });

    describe('release()', () => {
        it('should be safe to call without an active lock', async () => {
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            await expect(lock.release()).resolves.toBeUndefined();
        });

        it('should release wake lock and update state', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            await lock.request();
            expect(lock.isActive.value).toBe(true);

            await lock.release();
            expect(lock.isActive.value).toBe(false);
        });

        it('should be safe to call release() multiple times', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            await lock.request();
            await lock.release();
            await expect(lock.release()).resolves.toBeUndefined();
            expect(lock.isActive.value).toBe(false);
        });
    });

    describe('wake lock lifecycle', () => {
        it('should track wakeLockHeld flag for reacquisition after browser release', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            await lock.request();
            expect(lock.isActive.value).toBe(true);

            // Simulate browser releasing the lock (e.g., tab went to background)
            simulateBrowserRelease();
            expect(lock.isActive.value).toBe(false);

            await lock.release();
        });

        it('should reacquire wake lock on visibility change if previously held', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            lock.ensureVisibilityListener();

            // Acquire lock
            await lock.request();

            // Simulate browser releasing the lock
            simulateBrowserRelease();
            expect(lock.isActive.value).toBe(false);

            // Clear call count to verify reacquisition
            (navigator.wakeLock!.request as ReturnType<typeof vi.fn>).mockClear();

            // Fire visibility change to visible
            fireVisibilityChange(true);

            // Should have reacquired
            expect(navigator.wakeLock!.request).toHaveBeenCalledWith('screen');
        });

        it('should NOT reacquire wake lock on visibility change if never held', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            lock.ensureVisibilityListener();

            (navigator.wakeLock!.request as ReturnType<typeof vi.fn>).mockClear();
            fireVisibilityChange(true);

            expect(navigator.wakeLock!.request).not.toHaveBeenCalled();
        });

        it('should NOT reacquire wake lock on visibility change if released explicitly', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            lock.ensureVisibilityListener();

            await lock.request();
            await lock.release();

            (navigator.wakeLock!.request as ReturnType<typeof vi.fn>).mockClear();
            fireVisibilityChange(true);

            expect(navigator.wakeLock!.request).not.toHaveBeenCalled();
        });

        it('should NOT reacquire on visibility change to hidden', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            lock.ensureVisibilityListener();
            await lock.request();
            (navigator.wakeLock!.request as ReturnType<typeof vi.fn>).mockClear();

            fireVisibilityChange(false);

            expect(navigator.wakeLock!.request).not.toHaveBeenCalled();
        });
    });

    describe('ensureVisibilityListener()', () => {
        it('should register visibility change listener once', async () => {
            setWakeLockSupported();
            const { useWakeLock } = await import('../composables/useWakeLock');
            const lock = useWakeLock();

            lock.ensureVisibilityListener();
            expect(visibilityHandlers).toHaveLength(1);

            // Second call should not register another
            lock.ensureVisibilityListener();
            expect(visibilityHandlers).toHaveLength(1);
        });
    });
});
