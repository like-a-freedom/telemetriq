import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFilesStore } from '../stores/filesStore';
import { useSyncStore } from '../stores/syncStore';
import { useProcessingStore } from '../stores/processingStore';
import { useSettingsStore } from '../stores/settingsStore';

describe('Pinia Stores', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    describe('filesStore', () => {
        it('should have correct initial state', () => {
            const store = useFilesStore();
            expect(store.videoFile).toBeNull();
            expect(store.gpxFile).toBeNull();
            expect(store.videoMeta).toBeNull();
            expect(store.gpxData).toBeNull();
            expect(store.hasVideo).toBe(false);
            expect(store.hasGpx).toBe(false);
            expect(store.isReady).toBe(false);
            expect(store.error).toBeNull();
        });

        it('should reject invalid video file', async () => {
            const store = useFilesStore();
            const file = new File([], 'bad.avi');
            await store.setVideoFile(file);
            expect(store.hasVideo).toBe(false);
            expect(store.error).not.toBeNull();
        });

        it('should reject invalid GPX file', async () => {
            const store = useFilesStore();
            const file = new File([], 'bad.txt');
            await store.setGpxFile(file);
            expect(store.hasGpx).toBe(false);
            expect(store.error).not.toBeNull();
        });

        it('should reset all state', () => {
            const store = useFilesStore();
            store.error = 'some error';
            store.reset();
            expect(store.error).toBeNull();
            expect(store.videoFile).toBeNull();
            expect(store.gpxFile).toBeNull();
        });
    });

    describe('syncStore', () => {
        it('should have correct initial state', () => {
            const store = useSyncStore();
            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(false);
            expect(store.syncError).toBeNull();
            expect(store.syncWarning).toBeNull();
        });

        it('should set manual offset', () => {
            const store = useSyncStore();
            store.setManualOffset(15.5);
            expect(store.offsetSeconds).toBe(15.5);
            expect(store.isAutoSynced).toBe(false);
        });

        it('should clamp manual offset to range', () => {
            const store = useSyncStore();
            store.setManualOffset(999999);
            expect(store.offsetSeconds).toBe(1800); // Max range
        });

        it('should normalize non-finite manual offset to zero', () => {
            const store = useSyncStore();
            store.setManualOffset(Number.NaN);
            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(false);
        });

        it('should reset state', () => {
            const store = useSyncStore();
            store.setManualOffset(100);
            store.reset();
            expect(store.offsetSeconds).toBe(0);
        });

        it('should keep manual offset when auto-sync runs without override', async () => {
            const store = useSyncStore();
            store.setManualOffset(12.5);

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') },
                    { lat: 55.76, lon: 37.62, time: new Date('2024-01-15T10:00:30Z') },
                ],
                new Date('2024-01-15T11:00:00Z'),
            );

            expect(store.offsetSeconds).toBe(12.5);
            expect(store.isAutoSynced).toBe(false);
        });

        it('should allow explicit auto-sync override after manual offset', async () => {
            const store = useSyncStore();
            store.setManualOffset(12.5);

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') },
                    { lat: 55.76, lon: 37.62, time: new Date('2024-01-15T10:10:00Z') },
                ],
                new Date('2024-01-15T10:02:00Z'),
                undefined,
                undefined,
                undefined,
                true,
            );

            expect(store.offsetSeconds).toBe(120);
            expect(store.isAutoSynced).toBe(true);
        });

        it('should set error and reset config when auto-sync throws', async () => {
            const store = useSyncStore();
            store.setManualOffset(25);

            await store.performAutoSync([], new Date('2024-01-15T10:00:00Z'), undefined, undefined, undefined, true);

            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(false);
            expect(store.syncError).toBeTruthy();
        });
    });

    describe('processingStore', () => {
        it('should have correct initial state', () => {
            const store = useProcessingStore();
            expect(store.isProcessing).toBe(false);
            expect(store.isComplete).toBe(false);
            expect(store.hasResult).toBe(false);
            expect(store.progressPercent).toBe(0);
        });

        it('should start processing', () => {
            const store = useProcessingStore();
            store.startProcessing(1000);
            expect(store.isProcessing).toBe(true);
            expect(store.progress.totalFrames).toBe(1000);
        });

        it('should update progress', () => {
            const store = useProcessingStore();
            store.startProcessing(1000);
            store.updateProgress({
                phase: 'processing',
                percent: 50,
                framesProcessed: 500,
                totalFrames: 1000,
            });
            expect(store.progressPercent).toBe(50);
        });

        it('should set result', () => {
            const store = useProcessingStore();
            store.startProcessing(100);
            const blob = new Blob(['test'], { type: 'video/mp4' });
            store.setResult(blob);
            expect(store.hasResult).toBe(true);
            expect(store.isComplete).toBe(true);
            expect(store.isProcessing).toBe(false);
            expect(store.resultUrl).toBeTruthy();
        });

        it('should set error', () => {
            const store = useProcessingStore();
            store.startProcessing(100);
            store.setError('Something went wrong');
            expect(store.processingError).toBe('Something went wrong');
            expect(store.isProcessing).toBe(false);
        });

        it('should cancel processing', () => {
            const store = useProcessingStore();
            store.startProcessing(100);
            store.cancelProcessing();
            expect(store.isProcessing).toBe(false);
        });

        it('should clean up URL on reset', () => {
            const store = useProcessingStore();
            store.startProcessing(100);
            store.setResult(new Blob(['test']));
            expect(store.resultUrl).toBeTruthy();
            store.reset();
            expect(store.resultUrl).toBeNull();
            expect(store.resultBlob).toBeNull();
        });
    });

    describe('settingsStore', () => {
        it('should have correct initial state', () => {
            const store = useSettingsStore();
            expect(store.currentScreen).toBe('upload');
            expect(store.overlayConfig.position).toBe('bottom-left');
            expect(store.overlayConfig.showHr).toBe(true);
            expect(store.overlayConfig.showPace).toBe(true);
            expect(store.overlayConfig.showDistance).toBe(true);
            expect(store.overlayConfig.templateId).toBe('horizon');
        });

        it('should change screen', () => {
            const store = useSettingsStore();
            store.setScreen('preview');
            expect(store.isPreviewScreen).toBe(true);
            expect(store.isUploadScreen).toBe(false);
        });

        it('should update overlay config partially', () => {
            const store = useSettingsStore();
            store.updateOverlayConfig({ position: 'bottom-right', showHr: false });
            expect(store.overlayConfig.position).toBe('bottom-right');
            expect(store.overlayConfig.showHr).toBe(false);
            expect(store.overlayConfig.showPace).toBe(true); // Unchanged
        });

        it('should reset overlay config', () => {
            const store = useSettingsStore();
            store.updateOverlayConfig({ position: 'bottom-right' });
            store.resetOverlayConfig();
            expect(store.overlayConfig.position).toBe('bottom-left');
        });

        it('should reset everything', () => {
            const store = useSettingsStore();
            store.setScreen('result');
            store.updateOverlayConfig({ showHr: false });
            store.reset();
            expect(store.currentScreen).toBe('upload');
            expect(store.overlayConfig.showHr).toBe(true);
        });
    });
});
