import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GpxData, VideoMeta, FileValidation } from '../core/types';
import { validateGpxFile, readAndParseGpx } from '../modules/gpx-parser';
import {
    validateVideoFile,
    extractVideoMeta,
    WARN_DURATION_SECONDS,
} from '../modules/file-validation';
import { formatErrorMessage } from './store-utils';

interface LoadFileConfig<F extends File, T> {
    file: F;
    validate: (file: F) => FileValidation;
    parse: (file: F) => Promise<T>;
    onSuccess: (file: F, result: T) => void;
    onError: () => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    setValidation: (validation: FileValidation | null) => void;
}

async function loadFile<F extends File, T>({
    file,
    validate,
    parse,
    onSuccess,
    onError,
    setLoading,
    setError,
    setValidation,
}: LoadFileConfig<F, T>): Promise<void> {
    setError(null);
    setLoading(true);

    try {
        const validation = validate(file);
        setValidation(validation);

        if (!validation.valid) {
            setError(validation.errors.join('; '));
            return;
        }

        const result = await parse(file);
        onSuccess(file, result);
    } catch (err) {
        setError(formatErrorMessage(err));
        onError();
    } finally {
        setLoading(false);
    }
}

function enhanceVideoValidation(
    meta: VideoMeta,
    validation: FileValidation | null,
): FileValidation {
    const warnings = [...(validation?.warnings ?? [])];

    if (meta.duration > WARN_DURATION_SECONDS) {
        warnings.push(
            `Video is longer than 30 minutes (${Math.round(meta.duration / 60)} min). Processing may take a long time.`,
        );
    }

    return { valid: true, errors: [], warnings };
}

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
        await loadFile<File, VideoMeta>({
            file,
            validate: validateVideoFile,
            parse: extractVideoMeta,
            onSuccess: (file, meta) => {
                videoFile.value = file;
                videoMeta.value = meta;
                videoValidation.value = enhanceVideoValidation(meta, videoValidation.value);
            },
            onError: () => {
                videoFile.value = null;
                videoMeta.value = null;
            },
            setLoading: (v) => { isLoadingVideo.value = v; },
            setError: (e) => { error.value = e; },
            setValidation: (v) => { videoValidation.value = v; },
        });
    }

    async function setGpxFile(file: File): Promise<void> {
        await loadFile<File, GpxData>({
            file,
            validate: validateGpxFile,
            parse: readAndParseGpx,
            onSuccess: (file, data) => {
                gpxFile.value = file;
                gpxData.value = data;
            },
            onError: () => {
                gpxFile.value = null;
                gpxData.value = null;
            },
            setLoading: (v) => { isLoadingGpx.value = v; },
            setError: (e) => { error.value = e; },
            setValidation: (v) => { gpxValidation.value = v; },
        });
    }

    function removeVideo(): void {
        videoFile.value = null;
        videoMeta.value = null;
        videoValidation.value = null;
        isLoadingVideo.value = false;
    }

    function removeGpx(): void {
        gpxFile.value = null;
        gpxData.value = null;
        gpxValidation.value = null;
        isLoadingGpx.value = false;
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
        videoFile,
        gpxFile,
        videoMeta,
        gpxData,
        videoValidation,
        gpxValidation,
        isLoadingVideo,
        isLoadingGpx,
        error,
        hasVideo,
        hasGpx,
        isReady,
        setVideoFile,
        setGpxFile,
        removeVideo,
        removeGpx,
        reset,
    };
});
