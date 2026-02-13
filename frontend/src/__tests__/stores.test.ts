import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
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

        it('should keep large manual offset value', () => {
            const store = useSyncStore();
            store.setManualOffset(999999);
            expect(store.offsetSeconds).toBe(999999);
        });

        it('should normalize non-finite manual offset to zero', () => {
            const store = useSyncStore();
            store.setManualOffset(Number.NaN);
            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(false);
        });

        it('should not clamp manual offset by video duration', () => {
            const store = useSyncStore();
            store.setManualOffset(999999, 120);
            expect(store.offsetSeconds).toBe(999999);

            store.setManualOffset(-999999, 120);
            expect(store.offsetSeconds).toBe(-999999);
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

        it('should auto-sync with GPS coordinates and set isAutoSynced', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.7558, lon: 37.6173, time: new Date('2024-01-15T10:00:00Z') },
                    { lat: 55.7567, lon: 37.6173, time: new Date('2024-01-15T10:00:30Z') },
                    { lat: 55.7576, lon: 37.6173, time: new Date('2024-01-15T10:01:00Z') },
                ],
                undefined,
                55.7576,
                37.6173
            );

            expect(store.offsetSeconds).toBe(60);
            expect(store.isAutoSynced).toBe(true);
            expect(store.syncError).toBeNull();
            expect(store.syncWarning).toBeNull();
        });

        it('should auto-sync with video time within threshold and set isAutoSynced', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') },
                    { lat: 55.76, lon: 37.62, time: new Date('2024-01-15T10:10:00Z') },
                ],
                new Date('2024-01-15T10:02:00Z')
            );

            expect(store.offsetSeconds).toBe(120);
            expect(store.isAutoSynced).toBe(true);
            expect(store.syncError).toBeNull();
            expect(store.syncWarning).toBeNull();
        });

        it('should auto-sync with large time difference and set warning', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') },
                    { lat: 55.76, lon: 37.62, time: new Date('2024-01-15T10:30:00Z') },
                ],
                new Date('2024-01-15T09:50:00Z') // 10 minutes before GPX start
            );

            expect(store.offsetSeconds).toBe(-600);
            expect(store.isAutoSynced).toBe(true);
            expect(store.syncError).toBeNull();
            expect(store.syncWarning).toContain('Large time difference');
        });

        it('should handle auto-sync failure (no GPS/time) and set error', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') },
                ]
                // No videoStartTime, no GPS coordinates
            );

            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(false);
            expect(store.syncError).toBe('Auto-sync failed. Use manual adjustment.');
            expect(store.syncWarning).toBe('Auto-sync is not possible without GPS or the video start time.');
        });

        it('should clear previous warning on successful auto-sync', async () => {
            const store = useSyncStore();

            // First sync with warning
            await store.performAutoSync(
                [{ lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') }],
                new Date('2024-01-15T09:40:00Z')
            );
            expect(store.syncWarning).toContain('Large time difference');

            // Second sync without warning
            await store.performAutoSync(
                [{ lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') }],
                new Date('2024-01-15T10:00:00Z')
            );

            expect(store.syncWarning).toBeNull();
            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(true);
        });

        it('should clear previous error on successful auto-sync', async () => {
            const store = useSyncStore();

            // First sync fails
            await store.performAutoSync([], new Date('2024-01-15T10:00:00Z'));
            expect(store.syncError).toBeTruthy();

            // Second sync succeeds
            await store.performAutoSync(
                [{ lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') }],
                new Date('2024-01-15T10:00:00Z')
            );

            expect(store.syncError).toBeNull();
            expect(store.isAutoSynced).toBe(true);
        });

        it('should reset manual override flag after successful auto-sync', async () => {
            const store = useSyncStore();

            store.setManualOffset(100);
            expect(store.isAutoSynced).toBe(false); // manual mode active

            await store.performAutoSync(
                [{ lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') }],
                new Date('2024-01-15T10:00:00Z'),
                undefined,
                undefined,
                undefined,
                true // allow override
            );

            // After successful auto-sync, should be in auto mode with offset from auto-sync
            expect(store.isAutoSynced).toBe(true);
            expect(store.offsetSeconds).toBe(0);
        });

        it('should set isAutoSyncing flag during async operation', async () => {
            const store = useSyncStore();

            const promise = store.performAutoSync(
                [{ lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') }],
                new Date('2024-01-15T10:00:00Z')
            );

            // Since performAutoSync is synchronous in tests, isAutoSyncing is set and then immediately cleared
            // We verify the final state after completion
            await promise;
            expect(store.isAutoSyncing).toBe(false);
        });

        it('should handle exception during auto-sync and set error', async () => {
            const store = useSyncStore();

            // Empty points will throw SyncError
            await store.performAutoSync([], new Date('2024-01-15T10:00:00Z'));

            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(false);
            expect(store.syncError).toBeTruthy();
            expect(store.isAutoSyncing).toBe(false);
        });

        it('should prioritize GPS over time when both provided', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.7558, lon: 37.6173, time: new Date('2024-01-15T10:00:00Z') },
                    { lat: 55.7567, lon: 37.6173, time: new Date('2024-01-15T10:01:00Z') },
                ],
                new Date('2024-01-15T10:05:00Z'), // video time suggests 5 min offset
                55.7558,
                37.6173 // GPS matches first point -> offset = 0
            );

            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(true);
        });

        it('should handle negative offset correctly', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:05:00Z') },
                    { lat: 55.76, lon: 37.62, time: new Date('2024-01-15T10:10:00Z') },
                ],
                new Date('2024-01-15T10:00:00Z') // 5 minutes before GPX start
            );

            expect(store.offsetSeconds).toBe(-300);
            expect(store.isAutoSynced).toBe(true);
        });

        it('should handle boundary case: exactly 5 minutes offset (no warning)', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:05:00Z') },
                    { lat: 55.76, lon: 37.62, time: new Date('2024-01-15T10:30:00Z') },
                ],
                new Date('2024-01-15T10:00:00Z') // exactly 5 minutes before
            );

            // 300 seconds is NOT > 300, so no warning
            expect(store.offsetSeconds).toBe(-300);
            expect(store.isAutoSynced).toBe(true);
            expect(store.syncWarning).toBeNull();
        });

        it('should warn for offset just over 5 minutes', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:05:01Z') },
                ],
                new Date('2024-01-15T10:00:00Z') // 5 min 1 sec before
            );

            expect(store.offsetSeconds).toBeCloseTo(-301, 0);
            expect(store.isAutoSynced).toBe(true);
            expect(store.syncWarning).toContain('Large time difference');
        });

        it('should not apply timezone offset twice (absolute Date)', async () => {
            const store = useSyncStore();

            // GPX and video at same UTC time
            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2026-02-11T10:00:00Z') },
                ],
                new Date('2026-02-11T10:00:00Z'),
                undefined,
                undefined,
                -180 // timezone offset should be ignored
            );

            expect(store.offsetSeconds).toBe(0);
            expect(store.isAutoSynced).toBe(true);
        });

        it('should keep large auto-sync offset even when video duration is passed', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.75, lon: 37.61, time: new Date('2024-01-15T10:00:00Z') },
                ],
                new Date('2024-01-15T10:10:00Z'),
                undefined,
                undefined,
                undefined,
                false,
                120,
            );

            expect(store.offsetSeconds).toBe(600);
            expect(store.isAutoSynced).toBe(true);
            expect(store.syncWarning).toContain('Large time difference');
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
            expect(store.progressPercent).toBe(49);
        });

        it('should not report 100% before complete phase', () => {
            const store = useProcessingStore();
            store.startProcessing(12660);

            store.updateProgress({
                phase: 'processing',
                percent: 100,
                framesProcessed: 12660,
                totalFrames: 12660,
            });
            expect(store.progressPercent).toBe(92);
            expect(store.isComplete).toBe(false);

            store.updateProgress({
                phase: 'muxing',
                percent: 0,
                framesProcessed: 12660,
                totalFrames: 12660,
            });
            expect(store.progressPercent).toBe(92);
            expect(store.isComplete).toBe(false);

            store.updateProgress({
                phase: 'muxing',
                percent: 100,
                framesProcessed: 12660,
                totalFrames: 12660,
            });
            expect(store.progressPercent).toBe(99);
            expect(store.isComplete).toBe(false);

            store.setResult(new Blob(['done'], { type: 'video/mp4' }));
            expect(store.progressPercent).toBe(100);
            expect(store.isComplete).toBe(true);
        });

        it('should keep progress monotonic across phase transitions', () => {
            const store = useProcessingStore();
            store.startProcessing(1000);

            store.updateProgress({
                phase: 'processing',
                percent: 90,
                framesProcessed: 900,
                totalFrames: 1000,
            });
            const beforeMux = store.progressPercent;

            store.updateProgress({
                phase: 'muxing',
                percent: 0,
                framesProcessed: 1000,
                totalFrames: 1000,
            });
            const muxStart = store.progressPercent;

            expect(muxStart).toBeGreaterThanOrEqual(beforeMux);
            expect(muxStart).toBeLessThan(100);
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

        it('should estimate remaining time while processing', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-02-12T12:00:00Z'));

            const store = useProcessingStore();
            store.startProcessing(1000);

            vi.setSystemTime(new Date('2026-02-12T12:01:00Z'));
            store.updateProgress({
                phase: 'processing',
                percent: 50,
                framesProcessed: 500,
                totalFrames: 1000,
            });

            expect(store.progress.estimatedRemainingSeconds).toBeDefined();
            expect(store.progress.estimatedRemainingSeconds!).toBeGreaterThan(0);
            expect(store.progress.estimatedRemainingSeconds!).toBeLessThan(5 * 60);

            vi.useRealTimers();
        });

        it('should set ETA to zero on complete', () => {
            const store = useProcessingStore();
            store.startProcessing(100);
            store.updateProgress({
                phase: 'muxing',
                percent: 50,
                framesProcessed: 100,
                totalFrames: 100,
            });

            store.setResult(new Blob(['done'], { type: 'video/mp4' }));
            expect(store.progress.estimatedRemainingSeconds).toBe(0);
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

        it('should update overlay config partially and keep fixed-template position locked', () => {
            const store = useSettingsStore();
            store.updateOverlayConfig({ position: 'bottom-right', showHr: false });
            expect(store.overlayConfig.position).toBe('bottom-left');
            expect(store.overlayConfig.showHr).toBe(false);
            expect(store.overlayConfig.showPace).toBe(true); // Unchanged
        });

        it('should allow position changes for classic template', () => {
            const store = useSettingsStore();
            store.selectTemplate('classic');
            store.updateOverlayConfig({ position: 'bottom-right' });
            expect(store.overlayConfig.position).toBe('bottom-right');
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
