<template>
  <div class="upload-view">
    <header class="upload-view__header">
      <h1 class="upload-view__title">🏃 Telemetriq</h1>
      <p class="upload-view__description">
        Overlay telemetry from GPX onto your sports video. All processing
        happens in your browser — your data never leaves your device.
      </p>
    </header>

    <div class="upload-view__zones">
      <UploadZone
        accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
        title="Upload video"
        subtitle="MP4 or MOV, up to 4 GB, up to 60 min"
        icon="🎬"
        :has-file="filesStore.hasVideo"
        :file-name="filesStore.videoMeta?.fileName"
        :file-size="filesStore.videoMeta?.fileSize"
        :error-message="videoError"
        :is-loading="filesStore.isLoadingVideo"
        @file-selected="onVideoSelected"
        @file-removed="onVideoRemoved"
        data-testid="video-upload"
      />

      <UploadZone
        accept=".gpx,application/gpx+xml"
        title="Upload GPX"
        subtitle="Track file with GPS and heart rate data"
        icon="📍"
        :has-file="filesStore.hasGpx"
        :file-name="filesStore.gpxFile?.name"
        :file-size="filesStore.gpxFile?.size"
        :error-message="gpxError"
        :is-loading="filesStore.isLoadingGpx"
        @file-selected="onGpxSelected"
        @file-removed="onGpxRemoved"
        data-testid="gpx-upload"
      />
    </div>

    <!-- File info summary -->
    <div
      v-if="filesStore.hasVideo && filesStore.videoMeta"
      class="upload-view__summary"
    >
      <h3>Video</h3>
      <table class="upload-view__table">
        <tbody>
          <tr>
            <td class="upload-view__table-label">Resolution</td>
            <td class="upload-view__table-value upload-view__table-value--mono">{{ filesStore.videoMeta.width }}×{{ filesStore.videoMeta.height }}</td>
          </tr>
          <tr>
            <td class="upload-view__table-label">Duration</td>
            <td class="upload-view__table-value upload-view__table-value--mono">{{ formatDuration(filesStore.videoMeta.duration) }}</td>
          </tr>
          <tr>
            <td class="upload-view__table-label">Size</td>
            <td class="upload-view__table-value upload-view__table-value--mono">{{ formatFileSize(filesStore.videoMeta.fileSize) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="videoWarnings.length" class="upload-view__warning-block">
        <p v-for="warning in videoWarnings" :key="warning">⚠️ {{ warning }}</p>
      </div>
    </div>

    <div
      v-if="filesStore.hasGpx && filesStore.gpxData"
      class="upload-view__summary"
    >
      <h3>GPX track</h3>
      <table class="upload-view__table">
        <tbody>
          <tr>
            <td class="upload-view__table-label">Name</td>
            <td class="upload-view__table-value">{{ filesStore.gpxData.name }}</td>
          </tr>
          <tr>
            <td class="upload-view__table-label">Points</td>
            <td class="upload-view__table-value upload-view__table-value--mono">{{ filesStore.gpxData.points.length.toLocaleString() }}</td>
          </tr>
          <tr v-if="!hasNativePower && hasElevationData">
            <td class="upload-view__table-label">Athlete weight</td>
            <td class="upload-view__table-value">
              <input
                type="number"
                class="upload-view__weight-input"
                :value="settingsStore.runnerWeightKg ?? ''"
                placeholder="kg"
                min="20"
                max="300"
                step="0.5"
                @input="onWeightInput"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="upload-view__status-grid">
        <div class="upload-view__status-item">
          <svg
            class="upload-view__status-icon"
            :class="hasHrData ? 'upload-view__status-icon--ok' : 'upload-view__status-icon--none'"
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <template v-if="hasHrData">
              <path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
          </svg>
          <span>Heart rate</span>
        </div>
        <div class="upload-view__status-item">
          <svg
            class="upload-view__status-icon"
            :class="hasElevationData ? 'upload-view__status-icon--ok' : 'upload-view__status-icon--none'"
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <template v-if="hasElevationData">
              <path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
          </svg>
          <span>Elevation</span>
        </div>
        <div class="upload-view__status-item">
          <svg
            class="upload-view__status-icon"
            :class="hasCadenceData ? 'upload-view__status-icon--ok' : 'upload-view__status-icon--none'"
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <template v-if="hasCadenceData">
              <path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
          </svg>
          <span>Cadence</span>
        </div>
        <div class="upload-view__status-item">
          <svg
            class="upload-view__status-icon"
            :class="powerStatusClass"
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <template v-if="hasNativePower || canEstimatePower">
              <path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
          </svg>
          <span>Power{{ canEstimatePower && !hasNativePower ? ' (est.)' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- Proceed button -->
    <div class="upload-view__actions">
      <button
        class="upload-view__btn upload-view__btn--primary"
        :disabled="!filesStore.isReady"
        @click="goToPreview"
        data-testid="proceed-btn"
      >
        Continue →
      </button>
    </div>

    <!-- Browser support warning -->
    <div
      v-if="!browserCapabilities.supported"
      class="upload-view__warning"
      data-testid="browser-warning"
    >
      <p>⚠️ Your browser does not support the required APIs:</p>
      <ul>
        <li v-for="api in browserCapabilities.missing" :key="api">{{ api }}</li>
      </ul>
      <p>We recommend using the latest Chrome.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useFilesStore, useProcessingStore, useSettingsStore } from "../stores";
import { checkBrowserCapabilities } from "../modules/fileValidation";
import { hasNativePowerData } from "../modules/telemetry/powerEstimator";
import { useSeo } from "../composables/useSeo";
import { useFormatters } from "../composables/useFormatters";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import UploadZone from "../components/UploadZone.vue";

useSeo({
  title: "Upload Files",
  description:
    "Upload your GPX telemetry and video files to create sports overlay videos. Browser-based processing, no upload required.",
});

const router = useRouter();
const filesStore = useFilesStore();
const processingStore = useProcessingStore();
const settingsStore = useSettingsStore();
const { formatDuration, formatFileSize } = useFormatters();

const browserCapabilities = ref({ supported: true, missing: [] as string[] });

const videoError = computed(() => {
  if (
    filesStore.error &&
    filesStore.isLoadingVideo === false &&
    !filesStore.hasVideo
  ) {
    return filesStore.error;
  }
  return null;
});

const gpxError = computed(() => {
  if (
    filesStore.error &&
    filesStore.isLoadingGpx === false &&
    !filesStore.hasGpx
  ) {
    return filesStore.error;
  }
  return null;
});

const videoWarnings = computed(
  () => filesStore.videoValidation?.warnings ?? []
);

const hasHrData = computed(() => {
  return filesStore.gpxData?.points.some((p) => p.hr !== undefined) ?? false;
});

const hasElevationData = computed(() => {
  return filesStore.gpxData?.points.some((p) => p.ele !== undefined) ?? false;
});

const hasCadenceData = computed(() => {
  return (
    filesStore.gpxData?.points.some((p) => p.cadence !== undefined) ?? false
  );
});

const hasNativePower = computed(() => {
  return filesStore.gpxData ? hasNativePowerData(filesStore.gpxData.points) : false;
});

const canEstimatePower = computed(() => {
  return !hasNativePower.value && hasElevationData.value && !!settingsStore.runnerWeightKg && settingsStore.runnerWeightKg > 0;
});

const powerStatusClass = computed(() => {
  if (hasNativePower.value || canEstimatePower.value) return 'upload-view__status-icon--ok';
  return 'upload-view__status-icon--none';
});

function onWeightInput(event: Event): void {
  const val = parseFloat((event.target as HTMLInputElement).value);
  settingsStore.setRunnerWeight(Number.isFinite(val) && val > 0 ? val : null);
}

onMounted(() => {
  browserCapabilities.value = checkBrowserCapabilities();
});

async function onVideoSelected(file: File): Promise<void> {
  processingStore.reset();
  await filesStore.setVideoFile(file);
}

async function onGpxSelected(file: File): Promise<void> {
  processingStore.reset();
  await filesStore.setGpxFile(file);
}

function onVideoRemoved(): void {
  filesStore.removeVideo();
}

function onGpxRemoved(): void {
  filesStore.removeGpx();
}

function goToPreview(): void {
  processingStore.reset();
  settingsStore.setScreen("preview");
  router.push("/preview");
}
</script>

<style scoped>
.upload-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.upload-view__header {
  text-align: center;
  margin-bottom: 2rem;
}

.upload-view__title {
  font-size: 2rem;
  margin: 0 0 0.5rem;
  color: var(--color-text, #fff);
}

.upload-view__description {
  color: var(--color-text-secondary, #aaa);
  font-size: 1rem;
  max-width: 500px;
  margin: 0 auto;
  line-height: 1.6;
}

.upload-view__zones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .upload-view__zones {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .upload-view {
    padding: 1.5rem 0.75rem;
  }

  .upload-view__title {
    font-size: 1.75rem;
  }

  .upload-view__description {
    font-size: 0.9rem;
  }

  .upload-view__zones {
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .upload-view__summary {
    padding: 1rem;
  }

  .upload-view__status-grid {
    gap: 0.25rem 0.75rem;
  }

  .upload-view__btn {
    width: 100%;
    min-height: 48px;
  }

  .upload-view__warning {
    padding: 0.75rem;
    font-size: 0.85rem;
  }
}

.upload-view__summary {
  background: var(--color-bg-secondary, #141414);
  border: 1px solid var(--color-border, #333);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.upload-view__summary h3 {
  font-size: 0.7rem;
  margin: 0 0 0.75rem;
  color: var(--color-text-secondary, #999);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.upload-view__table {
  width: 100%;
  border-collapse: collapse;
}

.upload-view__table tr + tr {
  border-top: 1px solid var(--color-border, #333);
}

.upload-view__table td {
  padding: 0.55rem 0;
  font-size: 0.85rem;
  vertical-align: middle;
}

.upload-view__table-label {
  color: var(--color-text-secondary, #999);
  width: 40%;
}

.upload-view__table-value {
  color: var(--color-text, #ffffffde);
  font-weight: 600;
  text-align: right;
}

.upload-view__table-value--mono {
  font-variant-numeric: tabular-nums;
}

.upload-view__weight-input {
  width: 5rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--color-border, #333);
  border-radius: 6px;
  background: var(--color-bg, #1a1a1a);
  color: var(--color-text, #ffffffde);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.upload-view__weight-input:focus {
  outline: 2px solid var(--color-primary, #646cff);
  outline-offset: 1px;
}

.upload-view__status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem 1rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #333);
}

.upload-view__status-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  color: var(--color-text, #ffffffde);
}

.upload-view__status-icon {
  flex-shrink: 0;
}

.upload-view__status-icon--ok {
  color: var(--color-status-auto, #36b37e);
}

.upload-view__status-icon--none {
  color: var(--color-text-secondary, #999);
  opacity: 0.5;
}

.upload-view__warning-block {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--color-warning-surface);
  border: 1px solid rgba(255, 152, 0, 0.25);
  color: var(--color-warning-text);
  font-size: 0.85rem;
}

.upload-view__actions {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

.upload-view__btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-view__btn--primary {
  background: var(--color-primary, #646cff);
  color: white;
}

.upload-view__btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.upload-view__btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.upload-view__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-view__warning {
  margin-top: 2rem;
  padding: 1rem;
  background: var(--color-warning-surface);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 8px;
  color: var(--color-warning-text);
  font-size: 0.9rem;
}

.upload-view__warning ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
</style>
