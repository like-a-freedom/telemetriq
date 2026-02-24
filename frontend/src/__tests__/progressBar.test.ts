import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProgressBar from '../components/ProgressBar.vue';

function makeProgress(phase: string, percent: number, framesProcessed?: number, totalFrames?: number, estimatedRemaining?: number) {
    return {
        phase: phase as any,
        percent,
        framesProcessed: framesProcessed ?? 0,
        totalFrames: totalFrames ?? 0,
        estimatedRemainingSeconds: estimatedRemaining,
    };
}

describe('ProgressBar', () => {
    it('shows seconds when ETA < 60s', () => {
        const wrapper = mount(ProgressBar, {
            props: { progress: makeProgress('processing', 45, 50, 100, 35) },
        });
        expect(wrapper.text()).toContain('35 sec');
    });

    it('shows minutes when ETA >= 60s', () => {
        const wrapper = mount(ProgressBar, {
            props: { progress: makeProgress('processing', 60, 60, 100, 125) },
        });
        expect(wrapper.text()).toContain('2.1 min');
    });
});
