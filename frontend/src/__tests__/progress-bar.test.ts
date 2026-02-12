import { mount } from '@vue/test-utils';
import ProgressBar from '../components/ProgressBar.vue';

describe('ProgressBar', () => {
    it('shows seconds when ETA < 60s', () => {
        const wrapper = mount(ProgressBar, {
            props: {
                progress: {
                    phase: 'processing',
                    percent: 10,
                    framesProcessed: 10,
                    totalFrames: 100,
                    estimatedRemainingSeconds: 45,
                },
            },
        });

        expect(wrapper.text()).toContain('45 sec');
    });

    it('shows minutes when ETA >= 60s', () => {
        const wrapper = mount(ProgressBar, {
            props: {
                progress: {
                    phase: 'processing',
                    percent: 50,
                    framesProcessed: 50,
                    totalFrames: 100,
                    estimatedRemainingSeconds: 150,
                },
            },
        });

        expect(wrapper.text()).toContain('2.5 min');
    });
});
