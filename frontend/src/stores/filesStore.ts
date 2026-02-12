import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GpxData, VideoMeta, FileValidation } from '../core/types';
import { validateGpxFile, readAndParseGpx } from '../modules/gpx-parser';
import {
    validateVideoFile,
    extractVideoMeta,
    WARN_DURATION_SECONDS,
    FAST_METADATA_THRESHOLD_BYTES,
} from '../modules/file-validation';

export const useFilesStore = defineStore('files', () => {
    // State
    const videoFile = ref<File | null>(null);
    const gpxFile = ref<File | null>(null);
    const videoMeta = ref<VideoMeta | null>(null);
    const gpxData = ref<GpxData | null>(null);
    const videoValidation = ref<FileValidation | null>(null);
    const gpxValidation = ref<FileValidation | null>(null);
    const isLoadingVideo = ref(false);
    const isLoadingGpx = ref(false);
    const error = ref<string | null>(null);

    // Computed
    const hasVideo = computed(() => videoFile.value !== null && videoMeta.value !== null);
    const hasGpx = computed(() => gpxFile.value !== null && gpxData.value !== null);
    const isReady = computed(() => hasVideo.value && hasGpx.value);

    // Actions
    async function setVideoFile(file: File): Promise<void> {
        error.value = null;
        isLoadingVideo.value = true;

        try {
            const validation = validateVideoFile(file);
            videoValidation.value = validation;

            if (!validation.valid) {
                error.value = validation.errors.join('; ');
                return;
            }

            videoFile.value = file;
            videoMeta.value = await extractVideoMeta(file);

            const warnings = [...(videoValidation.value?.warnings ?? [])];

            if (file.size >= FAST_METADATA_THRESHOLD_BYTES) {
                warnings.push(
                    'Large file mode is enabled to keep the UI responsive. Detailed codec/GPS metadata will be detected during processing.',
                );
            }

            if (videoMeta.value.duration > WARN_DURATION_SECONDS) {
                warnings.push(
                    `Video is longer than 30 minutes (${Math.round(videoMeta.value.duration / 60)} min). Processing may take a long time.`,
                );
            }

            videoValidation.value = {
                valid: true,
                errors: [],
                warnings,
            };
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load video';
            videoFile.value = null;
            videoMeta.value = null;
        } finally {
            isLoadingVideo.value = false;
        }
    }

    async function setGpxFile(file: File): Promise<void> {
        error.value = null;
        isLoadingGpx.value = true;

        try {
            const validation = validateGpxFile(file);
            gpxValidation.value = validation;

            if (!validation.valid) {
                error.value = validation.errors.join('; ');
                return;
            }

            gpxFile.value = file;
            gpxData.value = await readAndParseGpx(file);
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load GPX';
            gpxFile.value = null;
            gpxData.value = null;
        } finally {
            isLoadingGpx.value = false;
        }
    }

    function reset(): void {
        videoFile.value = null;
        gpxFile.value = null;
        videoMeta.value = null;
        gpxData.value = null;
        videoValidation.value = null;
        gpxValidation.value = null;
        isLoadingVideo.value = false;
        isLoadingGpx.value = false;
        error.value = null;
    }

    return {
        // State
        videoFile,
        gpxFile,
        videoMeta,
        gpxData,
        videoValidation,
        gpxValidation,
        isLoadingVideo,
        isLoadingGpx,
        error,
        // Computed
        hasVideo,
        hasGpx,
        isReady,
        // Actions
        setVideoFile,
        setGpxFile,
        reset,
    };
});
