import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { OverlayConfig, AppScreen } from '../core/types';
import { DEFAULT_OVERLAY_CONFIG } from '../modules/overlay-renderer';

export const useSettingsStore = defineStore('settings', () => {
    // State
    const currentScreen = ref<AppScreen>('upload');
    const overlayConfig = ref<OverlayConfig>({ ...DEFAULT_OVERLAY_CONFIG });

    // Computed
    const isUploadScreen = computed(() => currentScreen.value === 'upload');
    const isPreviewScreen = computed(() => currentScreen.value === 'preview');
    const isProcessingScreen = computed(() => currentScreen.value === 'processing');
    const isResultScreen = computed(() => currentScreen.value === 'result');

    // Actions
    function setScreen(screen: AppScreen): void {
        currentScreen.value = screen;
    }

    function updateOverlayConfig(updates: Partial<OverlayConfig>): void {
        overlayConfig.value = { ...overlayConfig.value, ...updates };
    }

    function resetOverlayConfig(): void {
        overlayConfig.value = { ...DEFAULT_OVERLAY_CONFIG };
    }

    function reset(): void {
        currentScreen.value = 'upload';
        overlayConfig.value = { ...DEFAULT_OVERLAY_CONFIG };
    }

    return {
        currentScreen,
        overlayConfig,
        isUploadScreen,
        isPreviewScreen,
        isProcessingScreen,
        isResultScreen,
        setScreen,
        updateOverlayConfig,
        resetOverlayConfig,
        reset,
    };
});
