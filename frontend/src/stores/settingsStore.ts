import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ExtendedOverlayConfig, AppScreen, TemplateId } from '../core/types';
import { DEFAULT_OVERLAY_CONFIG } from '../modules/overlayRenderer';
import { getTemplateConfig, getTemplateDefinition } from '../modules/templates';
import type { MetricType } from '../modules/templates';

type MetricFlagKey = 'showHr' | 'showPace' | 'showDistance' | 'showTime' | 'showSpeed' | 'showGrade' | 'showElevation' | 'showCadence' | 'showPower';

const METRIC_FLAG_BY_TYPE: Record<MetricType, MetricFlagKey> = {
    hr: 'showHr',
    pace: 'showPace',
    distance: 'showDistance',
    time: 'showTime',
    speed: 'showSpeed',
    grade: 'showGrade',
    elevation: 'showElevation',
    cadence: 'showCadence',
    power: 'showPower',
};

const METRIC_FLAG_KEYS = Object.values(METRIC_FLAG_BY_TYPE);

function templateSupportsPosition(templateId: TemplateId): boolean {
    const template = getTemplateDefinition(templateId);
    return template?.metadata.capabilities?.supportsPosition
        ?? template?.capabilities?.supportsPosition
        ?? false;
}

function applyTemplateMetricConstraints(config: ExtendedOverlayConfig): ExtendedOverlayConfig {
    const template = getTemplateDefinition(config.templateId);
    const capabilities = template?.metadata.capabilities ?? template?.capabilities;

    if (!capabilities) {
        return config;
    }

    const next = { ...config };

    for (const [metric, flagKey] of Object.entries(METRIC_FLAG_BY_TYPE) as Array<[MetricType, MetricFlagKey]>) {
        if (!capabilities.supportedMetrics.includes(metric)) {
            next[flagKey] = false;
            continue;
        }

        if (capabilities.requiredMetrics.includes(metric)) {
            next[flagKey] = true;
        }
    }

    return next;
}

export const useSettingsStore = defineStore('settings', () => {
    // State
    const currentScreen = ref<AppScreen>('upload');
    const overlayConfig = ref<ExtendedOverlayConfig>({ ...DEFAULT_OVERLAY_CONFIG });
    const runnerWeightKg = ref<number | null>(null);

    // Computed
    const isUploadScreen = computed(() => currentScreen.value === 'upload');
    const isPreviewScreen = computed(() => currentScreen.value === 'preview');
    const isProcessingScreen = computed(() => currentScreen.value === 'processing');
    const isResultScreen = computed(() => currentScreen.value === 'result');

    const currentTemplateId = computed<TemplateId>(() => overlayConfig.value.templateId);

    // Actions
    function setScreen(screen: AppScreen): void {
        currentScreen.value = screen;
    }

    function updateOverlayConfig(updates: Partial<ExtendedOverlayConfig>): void {
        const next = { ...updates };
        if (
            next.position !== undefined
            && !templateSupportsPosition(overlayConfig.value.templateId)
        ) {
            delete next.position;
        }
        overlayConfig.value = applyTemplateMetricConstraints({ ...overlayConfig.value, ...next });
    }

    function resetOverlayConfig(): void {
        overlayConfig.value = { ...DEFAULT_OVERLAY_CONFIG };
    }

    function selectTemplate(templateId: TemplateId): void {
        const templateConfig = getTemplateConfig(templateId);
        // Preserve user overrides for fields that were customized
        const userOverrides: Partial<ExtendedOverlayConfig> = {};

        // Check if the current config is a custom one to preserve changes
        if (overlayConfig.value.templateId === 'custom' && templateSupportsPosition(templateId)) {
            // Save any custom changes before applying new template
            // This preserves user modifications when switching templates
            userOverrides.position = overlayConfig.value.position;
            for (const metricFlagKey of METRIC_FLAG_KEYS) {
                userOverrides[metricFlagKey] = overlayConfig.value[metricFlagKey];
            }
        } else if (overlayConfig.value.templateId === 'custom') {
            for (const metricFlagKey of METRIC_FLAG_KEYS) {
                userOverrides[metricFlagKey] = overlayConfig.value[metricFlagKey];
            }
        }

        // Apply template with any preserved user settings
        overlayConfig.value = applyTemplateMetricConstraints({ ...templateConfig, ...userOverrides });
    }

    function saveAsCustomTemplate(): void {
        overlayConfig.value = {
            ...overlayConfig.value,
            templateId: 'custom'
        };
    }

    function resetToTemplateDefaults(): void {
        if (overlayConfig.value.templateId !== 'custom') {
            selectTemplate(overlayConfig.value.templateId);
        }
    }

    function reset(): void {
        currentScreen.value = 'upload';
        overlayConfig.value = { ...DEFAULT_OVERLAY_CONFIG };
        runnerWeightKg.value = null;
    }

    function setRunnerWeight(weightKg: number | null): void {
        runnerWeightKg.value = weightKg;
    }

    return {
        currentScreen,
        overlayConfig,
        runnerWeightKg,
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
        setRunnerWeight,
        reset,
    };
});
