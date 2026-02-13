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
      <div class="upload-view__info-grid">
        <FileInfo
          label="Resolution"
          :value="`${filesStore.videoMeta.width}×${filesStore.videoMeta.height}`"
        />
        <FileInfo
          label="Duration"
          :value="formatDuration(filesStore.videoMeta.duration)"
        />
        <FileInfo
          label="Size"
          :value="formatSize(filesStore.videoMeta.fileSize)"
        />
      </div>
      <div v-if="videoWarnings.length" class="upload-view__warning-block">
        <p v-for="warning in videoWarnings" :key="warning">⚠️ {{ warning }}</p>
      </div>
    </div>

    <div
      v-if="filesStore.hasGpx && filesStore.gpxData"
      class="upload-view__summary"
    >
      <h3>GPX track</h3>
      <div class="upload-view__info-grid">
        <FileInfo label="Name" :value="filesStore.gpxData.name" />
        <FileInfo
          label="Points"
          :value="filesStore.gpxData.points.length.toString()"
        />
        <FileInfo v-if="hasHrData" label="Heart rate" value="✅ Present" />
        <FileInfo v-else label="Heart rate" value="❌ Absent" />
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
import { useFilesStore, useSettingsStore } from "../stores";
import { checkBrowserCapabilities } from "../modules/file-validation";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import UploadZone from "../components/UploadZone.vue";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import FileInfo from "../components/FileInfo.vue";

const router = useRouter();
const filesStore = useFilesStore();
const settingsStore = useSettingsStore();

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

onMounted(() => {
  browserCapabilities.value = checkBrowserCapabilities();
});

async function onVideoSelected(file: File): Promise<void> {
  await filesStore.setVideoFile(file);
}

async function onGpxSelected(file: File): Promise<void> {
  await filesStore.setGpxFile(file);
}

function onVideoRemoved(): void {
  filesStore.videoFile = null;
  filesStore.videoMeta = null;
}

function onGpxRemoved(): void {
  filesStore.gpxFile = null;
  filesStore.gpxData = null;
}

function goToPreview(): void {
  settingsStore.setScreen("preview");
  router.push("/preview");
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

.upload-view__summary {
  background: var(--color-bg-secondary, #1a1a1a);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.upload-view__summary h3 {
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
  color: var(--color-text-secondary, #aaa);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.upload-view__warning-block {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(255, 152, 0, 0.08);
  border: 1px solid rgba(255, 152, 0, 0.25);
  color: #ffb74d;
  font-size: 0.85rem;
}

.upload-view__info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
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
  background: #535bf2;
  transform: translateY(-1px);
}

.upload-view__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-view__warning {
  margin-top: 2rem;
  padding: 1rem;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 8px;
  color: #ff9800;
  font-size: 0.9rem;
}

.upload-view__warning ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
</style>
