import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

import TemplateSelector from '../components/TemplateSelector.vue';
import { TEMPLATE_IDS, ghostRunTemplate, getTemplateMetadata } from '../modules/templates';
import { useSettingsStore } from '../stores/settingsStore';

describe('TemplateSelector (template list)', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('renders an option for every registered template except custom', () => {
        const wrapper = mount(TemplateSelector);

        const optionValues = wrapper.findAll('option').map((option) => option.attributes('value'));

        const expected = TEMPLATE_IDS.filter((id) => id !== 'custom');
        for (const id of expected) {
            expect(optionValues, `template "${id}" missing from selector`).toContain(id);
        }
        expect(optionValues).not.toContain('custom');
        expect(optionValues).toHaveLength(expected.length);
    });

    it('includes Ghost Run, a template defined in its own module', () => {
        const wrapper = mount(TemplateSelector);

        const optionValues = wrapper.findAll('option').map((option) => option.attributes('value'));
        const optionLabels = wrapper.findAll('option').map((option) => option.text().trim());

        // A template file can exist and export a valid definition while still being
        // absent from the dropdown if it was never added to REGISTERED_TEMPLATES.
        expect(optionValues).toContain(ghostRunTemplate.id);
        expect(optionLabels).toContain(ghostRunTemplate.metadata.name);
    });

    it('shows the selected template in the control and its description below', () => {
        const settingsStore = useSettingsStore();
        settingsStore.selectTemplate('ghost-run');

        const wrapper = mount(TemplateSelector);

        expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('ghost-run');
        expect(wrapper.find('.template-dropdown__description').text().trim()).toBe(
            getTemplateMetadata('ghost-run').description,
        );
    });

    it('writes the chosen option back to the settings store', async () => {
        const settingsStore = useSettingsStore();
        const wrapper = mount(TemplateSelector);

        await wrapper.find('select').setValue('ghost-run');

        expect(settingsStore.currentTemplateId).toBe('ghost-run');
        expect(settingsStore.overlayConfig.layoutMode).toBe('ghost-run');
        expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('ghost-run');
    });

    it('stays usable when the stored template id is no longer registered', () => {
        const settingsStore = useSettingsStore();
        settingsStore.updateOverlayConfig({ templateId: 'removed-template' as never });

        const wrapper = mount(TemplateSelector);

        const optionValues = wrapper.findAll('option').map((option) => option.attributes('value'));
        expect(optionValues).toEqual(TEMPLATE_IDS.filter((id) => id !== 'custom'));
        expect(wrapper.find('.template-dropdown__description').exists()).toBe(false);
    });
});
