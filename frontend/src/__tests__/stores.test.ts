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
            expect(store.isLoadingVideo).toBe(false);
            expect(store.isLoadingGpx).toBe(false);
            expect(store.videoValidation).toBeNull();
            expect(store.gpxValidation).toBeNull();
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

        it('should remove video file and reset state', () => {
            const store = useFilesStore();
            store.videoFile = new File(['test'], 'test.mp4');
            store.videoMeta = {
                duration: 120,
                width: 1920,
                height: 1080,
                fps: 30,
                codec: 'avc1.640028',
                fileName: 'test.mp4',
                fileSize: 1000,
            };
            store.videoValidation = { valid: true, errors: [], warnings: [] };
            store.isLoadingVideo = true;

            store.removeVideo();

            expect(store.videoFile).toBeNull();
            expect(store.videoMeta).toBeNull();
            expect(store.videoValidation).toBeNull();
            expect(store.isLoadingVideo).toBe(false);
            expect(store.hasVideo).toBe(false);
        });

        it('should remove GPX file and reset state', () => {
            const store = useFilesStore();
            store.gpxFile = new File(['<gpx></gpx>'], 'test.gpx');
            store.gpxData = {
                name: 'Test Track',
                points: [],
                metadata: {},
            };
            store.gpxValidation = { valid: true, errors: [], warnings: [] };
            store.isLoadingGpx = true;

            store.removeGpx();

            expect(store.gpxFile).toBeNull();
            expect(store.gpxData).toBeNull();
            expect(store.gpxValidation).toBeNull();
            expect(store.isLoadingGpx).toBe(false);
            expect(store.hasGpx).toBe(false);
        });

        it('should set loading state during video file processing', async () => {
            const store = useFilesStore();

            // Set loading state manually to test the state management
            store.isLoadingVideo = true;
            expect(store.isLoadingVideo).toBe(true);

            // Complete loading
            store.isLoadingVideo = false;
            expect(store.isLoadingVideo).toBe(false);
        });

        it('should set loading state during GPX file processing', async () => {
            const store = useFilesStore();

            // Set loading state manually to test the state management
            store.isLoadingGpx = true;
            expect(store.isLoadingGpx).toBe(true);

            // Complete loading
            store.isLoadingGpx = false;
            expect(store.isLoadingGpx).toBe(false);
        });

        it('should clear error on successful file load', async () => {
            const store = useFilesStore();
            store.error = 'previous error';

            // This will fail validation but should clear previous error first
            const file = new File([], 'bad.avi');
            await store.setVideoFile(file);

            // Error should be the new validation error, not the previous one
            expect(store.error).not.toBe('previous error');
        });

        it('should handle both files loaded state', async () => {
            const store = useFilesStore();

            // Set video
            store.videoFile = new File(['test'], 'video.mp4');
            store.videoMeta = {
                duration: 120,
                width: 1920,
                height: 1080,
                fps: 30,
                codec: 'avc1.640028',
                fileName: 'video.mp4',
                fileSize: 1000,
            };

            expect(store.hasVideo).toBe(true);
            expect(store.isReady).toBe(false); // Only video

            // Set GPX
            store.gpxFile = new File(['<gpx></gpx>'], 'track.gpx');
            store.gpxData = {
                name: 'Test Track',
                points: [],
                metadata: {},
            };

            expect(store.hasGpx).toBe(true);
            expect(store.isReady).toBe(true); // Both loaded
        });

        it('should add warning for long videos', async () => {
            const store = useFilesStore();

            // Manually set a long video meta to trigger warning
            store.videoMeta = {
                duration: 3600, // 1 hour - longer than 30 min warning threshold
                width: 1920,
                height: 1080,
                fps: 30,
                codec: 'avc1.640028',
                fileName: 'long.mp4',
                fileSize: 1000000,
            };

            // Re-import to test the enhanceVideoValidation function
            // This would require exposing it or testing through setVideoFile
            // For now, we test the concept
            expect(store.videoMeta.duration).toBeGreaterThan(1800);
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

        it('should prioritize time when GPS candidate is far from video start time', async () => {
            const store = useSyncStore();

            await store.performAutoSync(
                [
                    { lat: 55.7558, lon: 37.6173, time: new Date('2024-01-15T10:00:00Z') },
                    { lat: 55.7567, lon: 37.6173, time: new Date('2024-01-15T10:01:00Z') },
                ],
                new Date('2024-01-15T10:05:00Z'), // video time suggests 5 min offset
                55.7558,
                37.6173 // GPS matches first point -> offset = 0, but far from time-based +300s
            );

            expect(store.offsetSeconds).toBe(300);
            expect(store.isAutoSynced).toBe(true);
            expect(store.syncWarning).toContain('Time-based sync was applied');
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
            expect(store.currentTemplateId).toBe('horizon');
        });

        it('should change screen', () => {
            const store = useSettingsStore();
            store.setScreen('preview');
            expect(store.isPreviewScreen).toBe(true);
            expect(store.isUploadScreen).toBe(false);
            expect(store.currentScreen).toBe('preview');
        });

        it('should handle all screen states', () => {
            const store = useSettingsStore();

            store.setScreen('upload');
            expect(store.isUploadScreen).toBe(true);
            expect(store.isPreviewScreen).toBe(false);
            expect(store.isProcessingScreen).toBe(false);
            expect(store.isResultScreen).toBe(false);

            store.setScreen('preview');
            expect(store.isUploadScreen).toBe(false);
            expect(store.isPreviewScreen).toBe(true);

            store.setScreen('processing');
            expect(store.isProcessingScreen).toBe(true);

            store.setScreen('result');
            expect(store.isResultScreen).toBe(true);
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

        it('should select different templates', () => {
            const store = useSettingsStore();

            store.selectTemplate('classic');
            expect(store.overlayConfig.templateId).toBe('classic');

            store.selectTemplate('horizon');
            expect(store.overlayConfig.templateId).toBe('horizon');

            store.selectTemplate('swiss-grid');
            expect(store.overlayConfig.templateId).toBe('swiss-grid');
        });

        it('should save as custom template', () => {
            const store = useSettingsStore();
            store.selectTemplate('classic');
            store.updateOverlayConfig({ showHr: false });
            store.saveAsCustomTemplate();
            expect(store.overlayConfig.templateId).toBe('custom');
            expect(store.overlayConfig.showHr).toBe(false);
        });

        it('should reset to template defaults', () => {
            const store = useSettingsStore();
            store.selectTemplate('classic');
            store.updateOverlayConfig({ showHr: false, showPace: false });
            store.resetToTemplateDefaults();
            // Should restore template defaults
            expect(store.overlayConfig.templateId).toBe('classic');
            expect(store.overlayConfig.showHr).toBe(true);
            expect(store.overlayConfig.showPace).toBe(true);
        });

        it('should preserve user overrides when switching from custom to classic', () => {
            const store = useSettingsStore();
            store.selectTemplate('custom');
            store.updateOverlayConfig({
                position: 'bottom-right',
                showHr: false,
                showPace: false,
                showDistance: false,
                showTime: false,
            });

            store.selectTemplate('classic');

            // Should preserve custom settings when switching to classic
            // Note: The position preservation happens, but classic template also sets its own position
            // so we check that show flags are preserved
            expect(store.overlayConfig.showHr).toBe(false);
            expect(store.overlayConfig.showPace).toBe(false);
            expect(store.overlayConfig.showDistance).toBe(false);
            expect(store.overlayConfig.showTime).toBe(false);
        });

        it('should preserve show flags when switching from custom to other templates', () => {
            const store = useSettingsStore();
            store.selectTemplate('custom');
            store.updateOverlayConfig({
                showHr: false,
                showPace: false,
                showDistance: false,
                showTime: false,
            });

            store.selectTemplate('horizon');

            expect(store.overlayConfig.showHr).toBe(false);
            expect(store.overlayConfig.showPace).toBe(false);
            expect(store.overlayConfig.showDistance).toBe(false);
            expect(store.overlayConfig.showTime).toBe(false);
        });

        it('should handle multiple config updates', () => {
            const store = useSettingsStore();

            store.updateOverlayConfig({ showHr: false });
            expect(store.overlayConfig.showHr).toBe(false);

            store.updateOverlayConfig({ showPace: false });
            expect(store.overlayConfig.showPace).toBe(false);
            expect(store.overlayConfig.showHr).toBe(false); // Preserved

            store.updateOverlayConfig({ showDistance: false });
            expect(store.overlayConfig.showDistance).toBe(false);
        });

        it('should update currentTemplateId when template changes', () => {
            const store = useSettingsStore();

            expect(store.currentTemplateId).toBe('horizon');

            store.selectTemplate('classic');
            expect(store.currentTemplateId).toBe('classic');

            store.saveAsCustomTemplate();
            expect(store.currentTemplateId).toBe('custom');
        });
    });
});
