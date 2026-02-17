import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DateTimePicker from '../components/DateTimePicker.vue';

describe('DateTimePicker', () => {
    it('renders formatted display from modelValue', () => {
        const wrapper = mount(DateTimePicker, {
            props: { modelValue: '2026-02-17T12:34:56' },
        });

        const input = wrapper.find('input.datetime-picker__display');
        expect((input.element as HTMLInputElement).value).toContain('2026.02.17');
        expect((input.element as HTMLInputElement).value).toContain('12:34:56');
    });

    it('opens popup, selects date/time and emits update', async () => {
        const wrapper = mount(DateTimePicker, { props: { modelValue: '' } });

        // open popup
        await wrapper.find('.datetime-picker__control').trigger('click');
        expect(wrapper.find('.datetime-picker__popup').exists()).toBe(true);

        // pick first enabled calendar cell
        const cells = wrapper.findAll('.calendar-cell');
        const enabled = cells.find((c) => !c.classes().includes('is-disabled'))!;
        await enabled.trigger('click');

        // time inputs & labels exist
        const labels = wrapper.findAll('.time-label');
        expect(labels.map(l => l.text())).toEqual(['HH', 'MM', 'SS']);

        // set time
        const hh = wrapper.find('input.time-input[type="number"]');
        await hh.setValue('08');
        const mins = wrapper.findAll('input.time-input')[1];
        await mins.setValue('30');
        const secs = wrapper.findAll('input.time-input')[2];
        await secs.setValue('15');

        // apply
        await wrapper.find('.popup-actions .btn').trigger('click');

        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        const value = emitted![0][0] as string;
        expect(value).toMatch(/\d{4}-\d{2}-\d{2}T08:30:15/);
    });
});