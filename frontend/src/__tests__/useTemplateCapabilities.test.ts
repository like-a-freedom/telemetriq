/**
 * Unit tests for useTemplateCapabilities composable.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { useTemplateCapabilities } from '../composables/useTemplateCapabilities';
import { useSettingsStore } from '../stores/settingsStore';
import { minimalRingTemplate } from '../modules/templates';

describe('useTemplateCapabilities', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('should return current template id', () => {
        const capabilities = useTemplateCapabilities();
        // Default is horizon
        expect(['horizon', 'margin', 'l-frame', 'classic']).toContain(capabilities.currentTemplateId.value);
    });

    it('should return capabilities for current template', () => {
        const capabilities = useTemplateCapabilities();
        expect(capabilities.currentCapabilities.value).toBeDefined();
        expect(capabilities.currentCapabilities.value.supportedMetrics).toBeDefined();
    });

    it('should return styles for current template', () => {
        const capabilities = useTemplateCapabilities();
        expect(capabilities.currentStyles.value).toBeDefined();
        expect(capabilities.currentStyles.value.typography).toBeDefined();
    });

    it('isMetricAvailable should return true for supported metrics', () => {
        const capabilities = useTemplateCapabilities();
        // Default template (horizon) supports all metrics
        expect(capabilities.isMetricAvailable('pace')).toBe(true);
        expect(capabilities.isMetricAvailable('hr')).toBe(true);
        expect(capabilities.isMetricAvailable('distance')).toBe(true);
    });

    it('isMetricRequired should return false for non-required metrics', () => {
        const capabilities = useTemplateCapabilities();
        // Default template has no required metrics
        expect(capabilities.isMetricRequired('pace')).toBe(false);
    });

    it('getMetricDisableReason should return empty string for available metrics', () => {
        const capabilities = useTemplateCapabilities();
        expect(capabilities.getMetricDisableReason('pace')).toBe('');
    });

    it('should update when template changes to minimal-ring', async () => {
        const settingsStore = useSettingsStore();
        const capabilities = useTemplateCapabilities();
        
        // Change to minimal-ring
        settingsStore.selectTemplate('minimal-ring');
        await nextTick();

        // Now pace should be available but time should not
        expect(capabilities.isMetricAvailable('pace')).toBe(true);
        expect(capabilities.isMetricAvailable('time')).toBe(false);
    });

    it('availableMetrics should include correct metrics for minimal-ring', async () => {
        const settingsStore = useSettingsStore();
        const capabilities = useTemplateCapabilities();
        
        settingsStore.selectTemplate('minimal-ring');
        await nextTick();

        // minimal-ring supports pace, hr, distance (not time)
        const metrics = capabilities.availableMetrics.value;
        expect(metrics).toContain('pace');
        expect(metrics).toContain('hr');
        expect(metrics).toContain('distance');
    });

    it('requiredMetrics should include pace for minimal-ring', async () => {
        const settingsStore = useSettingsStore();
        const capabilities = useTemplateCapabilities();
        
        settingsStore.selectTemplate('minimal-ring');
        await nextTick();

        // minimal-ring requires pace
        const required = capabilities.requiredMetrics.value;
        expect(required).toContain('pace');
    });

    it('supportsFeature should return correct values for horizon', () => {
        const capabilities = useTemplateCapabilities();
        
        // Horizon supports these
        expect(capabilities.supportsFeature('supportsBackgroundOpacity')).toBe(true);
        expect(capabilities.supportsFeature('supportsGradient')).toBe(true);
    });

    it('should reflect minimal-ring capabilities correctly', async () => {
        const settingsStore = useSettingsStore();
        const capabilities = useTemplateCapabilities();
        
        settingsStore.selectTemplate('minimal-ring');
        await nextTick();

        // Verify template ID changed
        expect(capabilities.currentTemplateId.value).toBe('minimal-ring');
        
        // Verify capabilities match template definition
        expect(capabilities.currentCapabilities.value.supportedMetrics)
            .toEqual(minimalRingTemplate.capabilities.supportedMetrics);
    });

    it('getMetricDisableReason should return reason for unsupported metric', async () => {
        const settingsStore = useSettingsStore();
        const capabilities = useTemplateCapabilities();
        
        settingsStore.selectTemplate('minimal-ring');
        await nextTick();

        const reason = capabilities.getMetricDisableReason('time');
        expect(reason).toBeTruthy();
        expect(reason.toLowerCase()).toContain('minimal ring');
    });
});
