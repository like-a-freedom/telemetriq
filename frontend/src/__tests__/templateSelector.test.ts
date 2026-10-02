import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

import TemplateSelector from '../components/TemplateSelector.vue';
import { TEMPLATE_IDS, ghostRunTemplate } from '../modules/templates';

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
});
