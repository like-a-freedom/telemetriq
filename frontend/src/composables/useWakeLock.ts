import { ref, onUnmounted } from 'vue';

export function useWakeLock() {
    const isSupported = 'wakeLock' in navigator;
    const isActive = ref(false);
    let sentinel: WakeLockSentinel | null = null;
    let visibilityListenerRegistered = false;
    let wakeLockHeld = false;

    async function request(): Promise<void> {
        if (!isSupported) return;
        if (sentinel) return;

        try {
            sentinel = await navigator.wakeLock.request('screen');
            isActive.value = true;
            wakeLockHeld = true;

            sentinel.addEventListener('release', () => {
                isActive.value = false;
                sentinel = null;
            });
        } catch {
            // WakeLock request denied or unavailable
        }
    }

    async function release(): Promise<void> {
        wakeLockHeld = false;

        if (!sentinel) return;

        try {
            await sentinel.release();
        } catch {
            // Ignore release errors
        }

        sentinel = null;
        isActive.value = false;
    }

    function handleVisibilityChange(): void {
        // Reacquire only if we had the lock before and lost it
        if (document.visibilityState === 'visible' && wakeLockHeld && !sentinel) {
            void request();
        }
    }

    /**
     * Register a one-time visibility change listener for wake lock reacquisition.
     * Safe to call multiple times — only registers once.
     */
    function ensureVisibilityListener(): void {
        if (visibilityListenerRegistered) return;
        visibilityListenerRegistered = true;
        document.addEventListener('visibilitychange', handleVisibilityChange);

        onUnmounted(() => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        });
    }

    onUnmounted(() => {
        void release();
    });

    return {
        isSupported,
        isActive,
        request,
        release,
        ensureVisibilityListener,
    };
}
