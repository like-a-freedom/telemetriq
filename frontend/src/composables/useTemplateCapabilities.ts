/**
 * Composable for accessing template capabilities.
 * Provides reactive access to current template's features and limitations.
 */

import { computed } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';
import { TEMPLATE_MAP } from '../modules/templates';
import {
    isMetricAvailable,
    isMetricRequired,
    getMetricUnavailableReason,
    DEFAULT_CAPABILITIES,
    DEFAULT_STYLES,
    type MetricType,
} from '../modules/templates/types';

export function useTemplateCapabilities() {
    const settingsStore = useSettingsStore();

    const currentTemplateId = computed(() => settingsStore.currentTemplateId);

    const currentTemplate = computed(() => {
        const templateId = currentTemplateId.value;
        return TEMPLATE_MAP[templateId];
    });

    const currentCapabilities = computed(() => {
        const template = currentTemplate.value;
        // Try metadata.capabilities first (new structure), then top-level capabilities, then defaults
        return template?.metadata?.capabilities ?? template?.capabilities ?? DEFAULT_CAPABILITIES;
    });

    const currentStyles = computed(() => {
        const template = currentTemplate.value;
        // Try metadata.styles first (new structure), then top-level styles, then defaults
        return template?.metadata?.styles ?? template?.styles ?? DEFAULT_STYLES;
    });

    /**
     * Check if a metric is available for the current template
     */
    function isMetricAvailableForCurrent(metric: MetricType): boolean {
        return isMetricAvailable(currentCapabilities.value, metric);
    }

    /**
     * Check if a metric is required (cannot be disabled)
     */
    function isMetricRequiredForCurrent(metric: MetricType): boolean {
        return isMetricRequired(currentCapabilities.value, metric);
    }

    /**
     * Get user-friendly reason why a metric is unavailable
     */
    function getMetricDisableReason(metric: MetricType): string {
        if (!isMetricAvailableForCurrent(metric)) {
            return getMetricUnavailableReason(currentCapabilities.value, metric)
                || `${metric.charAt(0).toUpperCase() + metric.slice(1)} is not supported`;
        }
        if (isMetricRequiredForCurrent(metric)) {
            return `${metric.charAt(0).toUpperCase() + metric.slice(1)} is required for this template`;
        }
        return '';
    }

    /**
     * Check if a feature is supported by the current template
     */
    function supportsFeature(feature: keyof typeof currentCapabilities.value): boolean {
        const caps = currentCapabilities.value;
        return feature in caps && caps[feature as keyof typeof caps] === true;
    }

    /**
     * Get available metrics for the current template
     */
    const availableMetrics = computed(() => currentCapabilities.value.supportedMetrics);

    /**
     * Get required metrics for the current template
     */
    const requiredMetrics = computed(() => currentCapabilities.value.requiredMetrics);

    return {
        // Computed
        currentTemplateId,
        currentTemplate,
        currentCapabilities,
        currentStyles,
        availableMetrics,
        requiredMetrics,

        // Methods
        isMetricAvailable: isMetricAvailableForCurrent,
        isMetricRequired: isMetricRequiredForCurrent,
        getMetricDisableReason,
        supportsFeature,
    };
}
