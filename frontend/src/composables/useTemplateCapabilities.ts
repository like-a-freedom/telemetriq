/**
 * Composable for accessing template capabilities.
 * Provides reactive access to current template's features and limitations.
 */

import { computed, type ComputedRef } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';
import { getTemplateDefinition } from '../modules/templates';
import {
    isMetricAvailable,
    isMetricRequired,
    getMetricUnavailableReason,
    DEFAULT_CAPABILITIES,
    DEFAULT_STYLES,
    type MetricType,
    type TemplateCapabilities,
    type TemplateStyles,
} from '../modules/templates/types';

export interface TemplateCapabilitiesComposable {
    // Computed
    currentTemplateId: ComputedRef<string>;
    currentTemplate: ComputedRef<unknown>;
    currentCapabilities: ComputedRef<TemplateCapabilities>;
    currentStyles: ComputedRef<TemplateStyles>;
    availableMetrics: ComputedRef<MetricType[]>;
    requiredMetrics: ComputedRef<MetricType[]>;

    // Methods
    isMetricAvailable: (metric: MetricType) => boolean;
    isMetricRequired: (metric: MetricType) => boolean;
    getMetricDisableReason: (metric: MetricType) => string;
    supportsFeature: (feature: string) => boolean;
}

export function useTemplateCapabilities(): TemplateCapabilitiesComposable {
    const settingsStore = useSettingsStore();

    const currentTemplateId = computed(() => settingsStore.currentTemplateId);

    const currentTemplate = computed(() => {
        const templateId = currentTemplateId.value;
        return getTemplateDefinition(templateId);
    });

    const currentCapabilities = computed((): TemplateCapabilities => {
        return currentTemplate.value?.capabilities ?? DEFAULT_CAPABILITIES;
    });

    const currentStyles = computed((): TemplateStyles => {
        return currentTemplate.value?.styles ?? DEFAULT_STYLES;
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
                || `${capitalizeFirst(metric)} is not supported`;
        }
        if (isMetricRequiredForCurrent(metric)) {
            return `${capitalizeFirst(metric)} is required for this template`;
        }
        return '';
    }

    /**
     * Check if a feature is supported by the current template.
     *
     * Reads through the keys of {@link TemplateCapabilities} (plus a few
     * `supports*` shortcuts) so unknown feature names always return `false`
     * without unsafe casts.
     */
    function supportsFeature(feature: string): boolean {
        const caps: Record<string, unknown> = { ...currentCapabilities.value };
        return feature in caps && caps[feature] === true;
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
        currentTemplateId,
        currentTemplate,
        currentCapabilities,
        currentStyles,
        availableMetrics,
        requiredMetrics,
        isMetricAvailable: isMetricAvailableForCurrent,
        isMetricRequired: isMetricRequiredForCurrent,
        getMetricDisableReason,
        supportsFeature,
    };
}

function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
