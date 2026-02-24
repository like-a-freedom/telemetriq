import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ExtendedOverlayConfig, AppScreen, TemplateId } from '../core/types';
import { DEFAULT_OVERLAY_CONFIG } from '../modules/overlayRenderer';
import { getTemplateConfig } from '../modules/templateConfigs';

export const useSettingsStore = defineStore('settings', () => {
    // State
    const currentScreen = ref<AppScreen>('upload');
    const overlayConfig = ref<ExtendedOverlayConfig>({ ...DEFAULT_OVERLAY_CONFIG });

    // Computed
    const isUploadScreen = computed(() => currentScreen.value === 'upload');
    const isPreviewScreen = computed(() => currentScreen.value === 'preview');
    const isProcessingScreen = computed(() => currentScreen.value === 'processing');
    const isResultScreen = computed(() => currentScreen.value === 'result');

    const currentTemplateId = computed<TemplateId>(() => overlayConfig.value.templateId as TemplateId);

    // Actions
    function setScreen(screen: AppScreen): void {
        currentScreen.value = screen;
    }

    function updateOverlayConfig(updates: Partial<ExtendedOverlayConfig>): void {
        const next = { ...updates };
        if (
            next.position !== undefined
            && overlayConfig.value.templateId !== 'classic'
        ) {
            delete next.position;
        }
        overlayConfig.value = { ...overlayConfig.value, ...next };
    }

    function resetOverlayConfig(): void {
        overlayConfig.value = { ...DEFAULT_OVERLAY_CONFIG };
    }

    function selectTemplate(templateId: TemplateId): void {
        const templateConfig = getTemplateConfig(templateId);
        // Preserve user overrides for fields that were customized
        const userOverrides: Partial<ExtendedOverlayConfig> = {};

        // Check if the current config is a custom one to preserve changes
        if (overlayConfig.value.templateId === 'custom' && templateId === 'classic') {
            // Save any custom changes before applying new template
            // This preserves user modifications when switching templates
            userOverrides.position = overlayConfig.value.position;
            userOverrides.showHr = overlayConfig.value.showHr;
            userOverrides.showPace = overlayConfig.value.showPace;
            userOverrides.showDistance = overlayConfig.value.showDistance;
            userOverrides.showTime = overlayConfig.value.showTime;
        } else if (overlayConfig.value.templateId === 'custom') {
            userOverrides.showHr = overlayConfig.value.showHr;
            userOverrides.showPace = overlayConfig.value.showPace;
            userOverrides.showDistance = overlayConfig.value.showDistance;
            userOverrides.showTime = overlayConfig.value.showTime;
        }

        // Apply template with any preserved user settings
        overlayConfig.value = { ...templateConfig, ...userOverrides };
    }

    function saveAsCustomTemplate(): void {
        overlayConfig.value = {
            ...overlayConfig.value,
            templateId: 'custom'
        };
    }

    function resetToTemplateDefaults(): void {
        if (overlayConfig.value.templateId !== 'custom') {
            selectTemplate(overlayConfig.value.templateId as TemplateId);
        }
    }

    function reset(): void {
        currentScreen.value = 'upload';
        overlayConfig.value = { ...DEFAULT_OVERLAY_CONFIG };
    }

    return {
        currentScreen,
        overlayConfig,
        currentTemplateId,
        isUploadScreen,
        isPreviewScreen,
        isProcessingScreen,
        isResultScreen,
        setScreen,
        updateOverlayConfig,
        resetOverlayConfig,
        selectTemplate,
        saveAsCustomTemplate,
        resetToTemplateDefaults,
        reset,
    };
});
