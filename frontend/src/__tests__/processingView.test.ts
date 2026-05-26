/// <reference path="../../env.d.ts" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const push = vi.fn();

const { mockWakeLock } = vi.hoisted(() => {
    const isActive = { value: false };
    return {
        mockWakeLock: {
            isSupported: true,
            isActive,
            request: vi.fn().mockResolvedValue(undefined),
            release: vi.fn().mockResolvedValue(undefined),
            ensureVisibilityListener: vi.fn(),
        },
    };
});

vi.mock('vue-router', () => ({
    useRouter: () => ({ push }),
}));

vi.mock('../composables/useSeo', () => ({ useSeo: () => { } }));
vi.mock('../composables/useWakeLock', () => ({
    useWakeLock: () => mockWakeLock,
}));
vi.mock('../modules/videoProcessor', () => ({
    VideoProcessor: class MockVideoProcessor {
        cancel(): void { }
        async process(): Promise<Blob> {
            return new Blob([], { type: 'video/mp4' });
        }
    },
}));
vi.mock('../modules/webgpu', () => ({
    getWebGPUStatus: () => ({ supported: false, enabled: false, available: false }),
    toggleWebGPU: () => { },
}));
vi.mock('../modules/telemetryCore', () => ({
    buildTelemetryTimeline: () => [],
}));

import ProcessingView from '../views/ProcessingView.vue';
import { useFilesStore } from '../stores/filesStore';
import { useProcessingStore } from '../stores/processingStore';

describe('ProcessingView', () => {
    beforeEach(() => {
        push.mockReset();
        mockWakeLock.request.mockReset();
        mockWakeLock.release.mockReset();
        mockWakeLock.ensureVisibilityListener.mockReset();
        mockWakeLock.isActive.value = false;
        setActivePinia(createPinia());
    });

    describe('recovery flow', () => {
        it('redirects to result when a processed result was restored after reload', () => {
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

        it('redirects to upload when neither source files nor processed result exist', () => {
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

    describe('smarter guard: stale result + new files', () => {
        function setupFilesReady(): void {
            const filesStore = useFilesStore();
            filesStore.videoMeta = {
                duration: 60,
                fps: 30,
                width: 1920,
                height: 1080,
                codec: 'avc1',
                fileSize: 1_000_000,
                fileName: 'test.mp4',
            };
            filesStore.videoFile = new File([''], 'test.mp4', { type: 'video/mp4' });
            filesStore.gpxData = {
                name: 'test',
                points: [{ lat: 55.0, lon: 37.0, time: new Date('2024-01-15T10:00:00Z') }],
                metadata: { creator: 'test' },
            };
            filesStore.gpxFile = new File([''], 'test.gpx', { type: 'application/gpx+xml' });
        }

        it('should reset stale result and NOT redirect when files are ready', () => {
            const processingStore = useProcessingStore();
            processingStore.setResult(new Blob(['old-result'], { type: 'video/mp4' }));
            expect(processingStore.hasResult).toBe(true);

            setupFilesReady();

            mount(ProcessingView, {
                global: {
                    stubs: {
                        ProgressBar: true,
                    },
                },
            });

            expect(push).not.toHaveBeenCalledWith('/result');
            expect(push).not.toHaveBeenCalledWith('/');
            expect(processingStore.hasResult).toBe(false);
        });

        it('should start processing when stale result is cleared and files are ready', async () => {
            const processingStore = useProcessingStore();
            processingStore.setResult(new Blob(['old-result'], { type: 'video/mp4' }));

            setupFilesReady();

            mount(ProcessingView, {
                global: {
                    stubs: {
                        ProgressBar: true,
                    },
                },
            });

            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(processingStore.isProcessing).toBe(true);
            expect(processingStore.hasResult).toBe(false);
        });
    });

    describe('wake lock integration', () => {
        function setupFilesReady(): void {
            const filesStore = useFilesStore();
            filesStore.videoMeta = {
                duration: 60,
                fps: 30,
                width: 1920,
                height: 1080,
                codec: 'avc1',
                fileSize: 1_000_000,
                fileName: 'test.mp4',
            };
            filesStore.videoFile = new File([''], 'test.mp4', { type: 'video/mp4' });
            filesStore.gpxData = {
                name: 'test',
                points: [{ lat: 55.0, lon: 37.0, time: new Date('2024-01-15T10:00:00Z') }],
                metadata: { creator: 'test' },
            };
            filesStore.gpxFile = new File([''], 'test.gpx', { type: 'application/gpx+xml' });
        }

        it('should request wake lock when processing starts', async () => {
            setupFilesReady();

            mount(ProcessingView, {
                global: {
                    stubs: {
                        ProgressBar: true,
                    },
                },
            });

            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(mockWakeLock.request).toHaveBeenCalled();
        });

        it('should register visibility listener on mount', () => {
            setupFilesReady();

            mount(ProcessingView, {
                global: {
                    stubs: {
                        ProgressBar: true,
                    },
                },
            });

            expect(mockWakeLock.ensureVisibilityListener).toHaveBeenCalled();
        });

        it('should release wake lock when processing completes', async () => {
            setupFilesReady();

            mount(ProcessingView, {
                global: {
                    stubs: {
                        ProgressBar: true,
                    },
                },
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockWakeLock.release).toHaveBeenCalled();
        });
    });
});
