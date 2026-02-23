/**
 * Composable for accessing template capabilities.
 * Provides reactive access to current template's features and limitations.
 */

import { computed, type ComputedRef } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';
import { TEMPLATE_MAP } from '../modules/templates';
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
        return TEMPLATE_MAP[templateId];
    });

    const currentCapabilities = computed((): TemplateCapabilities => {
        const template = currentTemplate.value as { metadata?: { capabilities?: TemplateCapabilities }; capabilities?: TemplateCapabilities } | undefined;
        // Try metadata.capabilities first (new structure), then top-level capabilities, then defaults
        return template?.metadata?.capabilities ?? template?.capabilities ?? DEFAULT_CAPABILITIES;
    });

    const currentStyles = computed((): TemplateStyles => {
        const template = currentTemplate.value as { metadata?: { styles?: TemplateStyles }; styles?: TemplateStyles } | undefined;
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
                || `${capitalizeFirst(metric)} is not supported`;
        }
        if (isMetricRequiredForCurrent(metric)) {
            return `${capitalizeFirst(metric)} is required for this template`;
        }
        return '';
    }

    /**
     * Check if a feature is supported by the current template
     */
    function supportsFeature(feature: string): boolean {
        const caps = currentCapabilities.value as unknown as Record<string, unknown>;
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
