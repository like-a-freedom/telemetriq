/// <reference path="../../env.d.ts" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const push = vi.fn();

vi.mock('vue-router', () => ({
    useRouter: () => ({ push }),
}));

vi.mock('../composables/useSeo', () => ({ useSeo: () => {} }));
vi.mock('../modules/videoProcessor', () => ({
    VideoProcessor: class MockVideoProcessor {
        cancel(): void {}
        async process(): Promise<Blob> {
            return new Blob([], { type: 'video/mp4' });
        }
    },
}));
vi.mock('../modules/webgpu', () => ({
    getWebGPUStatus: () => ({ supported: false, enabled: false, available: false }),
    toggleWebGPU: () => {},
}));
vi.mock('../modules/telemetryCore', () => ({
    buildTelemetryTimeline: () => [],
}));

import ProcessingView from '../views/ProcessingView.vue';
import { useFilesStore } from '../stores/filesStore';
import { useProcessingStore } from '../stores/processingStore';

describe('ProcessingView recovery flow', () => {
    beforeEach(() => {
        push.mockReset();
        setActivePinia(createPinia());
    });

    it('redirects to result instead of upload when a processed result was restored after reload', () => {
        const filesStore = useFilesStore();
        filesStore.reset();

        const processingStore = useProcessingStore();
        processingStore.setResult(new Blob(['processed-video'], { type: 'video/mp4' }));

        mount(ProcessingView, {
            global: {
                stubs: {
                    ProgressBar: true,
                },
            },
        });

        expect(push).toHaveBeenCalledWith('/result');
        expect(push).not.toHaveBeenCalledWith('/');
    });

    it('still redirects to upload when neither source files nor processed result exist', () => {
        const filesStore = useFilesStore();
        filesStore.reset();

        const processingStore = useProcessingStore();
        processingStore.reset();

        mount(ProcessingView, {
            global: {
                stubs: {
                    ProgressBar: true,
                },
            },
        });

        expect(push).toHaveBeenCalledWith('/');
    });
});
