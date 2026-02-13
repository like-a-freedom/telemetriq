<template>
  <div class="result-view">
    <header class="result-view__header">
      <h2>🎉 Video is ready!</h2>
      <p class="result-view__subtitle">
        Your video with telemetry is ready for download
      </p>
    </header>

    <!-- Result video preview -->
    <div v-if="processingStore.resultUrl" class="result-view__preview">
      <video
        :src="processingStore.resultUrl"
        controls
        class="result-view__video"
        data-testid="result-video"
      />
    </div>

    <!-- File info -->
    <div v-if="processingStore.resultBlob" class="result-view__info">
      <FileInfo label="Format" value="MP4 (H.264)" />
      <FileInfo label="Size" :value="resultSize" />
    </div>

    <!-- Actions -->
    <div class="result-view__actions">
      <button
        class="result-view__btn result-view__btn--primary"
        @click="downloadResult"
        data-testid="download-btn"
      >
        ⬇️ Download video
      </button>
      <button
        class="result-view__btn"
        @click="startOver"
        data-testid="start-over-btn"
      >
        🔄 Start over
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  useFilesStore,
  useProcessingStore,
  useSettingsStore,
  useSyncStore,
} from "../stores";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import FileInfo from "../components/FileInfo.vue";

const router = useRouter();
const filesStore = useFilesStore();
const processingStore = useProcessingStore();
const settingsStore = useSettingsStore();
const syncStore = useSyncStore();

const resultSize = computed(() => {
  const size = processingStore.resultBlob?.size ?? 0;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
});

onMounted(() => {
  if (!processingStore.hasResult) {
    router.push("/");
  }
});

function downloadResult(): void {
  if (!processingStore.resultUrl) return;

  const originalName = filesStore.videoMeta?.fileName ?? "video";
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const fileName = `${baseName}_overlay.mp4`;

  const a = document.createElement("a");
  a.href = processingStore.resultUrl;
  a.download = fileName;
  a.click();
}

function startOver(): void {
  filesStore.reset();
  syncStore.reset();
  processingStore.reset();
  settingsStore.reset();
  router.push("/");
}
</script>

<style scoped>
.result-view {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.result-view__header {
  text-align: center;
  margin-bottom: 2rem;
}

.result-view__header h2 {
  font-size: 1.8rem;
  margin: 0 0 0.5rem;
  color: var(--color-text, #fff);
}

.result-view__subtitle {
  color: var(--color-text-secondary, #aaa);
  font-size: 1rem;
  margin: 0;
}

.result-view__preview {
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1.5rem;
  background: #000;
}

.result-view__video {
  width: 100%;
  display: block;
}

.result-view__info {
  background: var(--color-bg-secondary, #1a1a1a);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.result-view__actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.result-view__btn {
  padding: 0.75rem 2rem;
  border: 1px solid var(--color-border, #404040);
  background: transparent;
  color: var(--color-text, #fff);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.result-view__btn:hover {
  background: var(--color-bg-hover, #333);
}

.result-view__btn--primary {
  background: var(--color-success, #4caf50);
  border-color: var(--color-success, #4caf50);
  color: white;
}

.result-view__btn--primary:hover {
  background: #43a047;
  transform: translateY(-1px);
}
</style>
