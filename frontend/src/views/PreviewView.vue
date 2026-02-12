<template>
  <div class="preview-view">
    <header class="preview-view__header">
      <button class="preview-view__back" @click="goBack" data-testid="back-btn">
        ← Back
      </button>
      <h2>Preview & Sync</h2>
    </header>

    <div class="preview-view__workspace">
      <!-- Main video area with overlay -->
      <div class="preview-view__main">
        <div
          v-if="videoUrl && telemetryFrames.length > 0"
          class="preview-view__player"
        >
          <VideoPlayer
            :src="videoUrl"
            :telemetry-frames="telemetryFrames"
            :overlay-config="settingsStore.overlayConfig"
            :sync-offset="syncStore.offsetSeconds"
          />
        </div>

        <div class="preview-view__sync-controls">
          <h3>Synchronization</h3>
          <p class="preview-view__desc">
            Align telemetry data with video timeline.
          </p>

          <SyncSlider
            :offset-seconds="syncStore.offsetSeconds"
            :is-auto-synced="syncStore.isAutoSynced"
            :error="syncStore.syncError"
            :warning="syncStore.syncWarning"
            @update:offset-seconds="syncStore.setManualOffset"
          />

          <div class="preview-view__divider"></div>

          <div class="preview-view__manual-sync">
            <label class="preview-view__label">Manual start time</label>
            <p class="preview-view__hint">
              Set activity start time if auto-sync fails.
            </p>
            <div class="preview-view__field-row">
              <input
                v-model="manualStartTime"
                type="datetime-local"
                class="preview-view__input"
                placeholder="Select date & time"
              />
              <button
                class="preview-view__btn preview-view__btn--secondary"
                @click="applyManualTime"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings sidebar -->
      <aside class="preview-view__sidebar">
        <div class="preview-view__card">
          <h3>Template</h3>
          <p class="preview-view__desc">
            Choose a design template for your telemetry overlay.
          </p>

          <TemplateSelector />

          <div class="preview-view__divider"></div>
        </div>

        <div class="preview-view__card">
          <h3>Overlay settings</h3>
          <p class="preview-view__desc">
            Configure what appears on the video. Changes apply in real-time.
          </p>

          <div class="preview-view__settings">
            <label class="preview-view__checkbox">
              <input
                type="checkbox"
                v-model="settingsStore.overlayConfig.showHr"
              />
              <span>❤️ Heart rate</span>
            </label>
            <label class="preview-view__checkbox">
              <input
                type="checkbox"
                v-model="settingsStore.overlayConfig.showPace"
              />
              <span>🏃 Pace</span>
            </label>
            <label class="preview-view__checkbox">
              <input
                type="checkbox"
                v-model="settingsStore.overlayConfig.showDistance"
              />
              <span>📏 Distance</span>
            </label>
            <label class="preview-view__checkbox">
              <input
                type="checkbox"
                v-model="settingsStore.overlayConfig.showTime"
              />
              <span>⏱️ Time</span>
            </label>
          </div>

          <div class="preview-view__divider"></div>

          <div class="preview-view__field" v-if="canChangePosition">
            <label class="preview-view__label">Position</label>
            <select
              v-model="settingsStore.overlayConfig.position"
              class="preview-view__select"
            >
              <option value="top-left">Top left</option>
              <option value="top-right">Top right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
            </select>
          </div>
        </div>

        <button
          class="preview-view__btn preview-view__btn--primary"
          @click="startProcessing"
          data-testid="process-btn"
        >
          🚀 Start processing
        </button>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useFilesStore, useSyncStore, useSettingsStore } from "../stores";
import { buildTelemetryTimeline } from "../modules/telemetry-core";
import type { TelemetryFrame } from "../core/types";
// @ts-expect-error Vue SFC default export typing handled by Vite/Vue tooling
import VideoPlayer from "../components/VideoPlayer.vue";
// @ts-expect-error Vue SFC default export typing handled by Vite/Vue tooling
import SyncSlider from "../components/SyncSlider.vue";
// @ts-expect-error Vue SFC default export typing handled by Vite/Vue tooling
import TemplateSelector from "../components/TemplateSelector.vue";

const router = useRouter();
const filesStore = useFilesStore();
const syncStore = useSyncStore();
const settingsStore = useSettingsStore();

const videoUrl = ref<string | null>(null);
const telemetryFrames = ref<TelemetryFrame[]>([]);
const manualStartTime = ref("");
const canChangePosition = computed(
  () => settingsStore.currentTemplateId === "classic"
);

onMounted(() => {
  if (!filesStore.isReady) {
    router.push("/");
    return;
  }

  // Create video URL
  if (filesStore.videoFile) {
    videoUrl.value = URL.createObjectURL(filesStore.videoFile);
  }

  // Build telemetry timeline
  if (filesStore.gpxData) {
    telemetryFrames.value = buildTelemetryTimeline(filesStore.gpxData.points);
  }

  // Attempt auto-sync
  if (filesStore.gpxData) {
    syncStore.performAutoSync(
      filesStore.gpxData.points,
      filesStore.videoMeta?.startTime,
      filesStore.videoMeta?.gps?.lat,
      filesStore.videoMeta?.gps?.lon,
      filesStore.videoMeta?.timezoneOffsetMinutes
    );
  }
});

onUnmounted(() => {
  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value);
  }
});

function goBack(): void {
  settingsStore.setScreen("upload");
  router.push("/");
}

function startProcessing(): void {
  settingsStore.setScreen("processing");
  router.push("/processing");
}

function applyManualTime(): void {
  if (!filesStore.gpxData || !manualStartTime.value) return;
  const localTime = new Date(manualStartTime.value);
  if (Number.isNaN(localTime.getTime())) return;
  syncStore.performAutoSync(
    filesStore.gpxData.points,
    localTime,
    undefined,
    undefined,
    localTime.getTimezoneOffset(),
    true
  );
}
</script>

<style scoped>
.preview-view {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.preview-view__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.preview-view__header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--color-text, #fff);
}

.preview-view__back {
  background: transparent;
  border: 1px solid var(--color-border, #404040);
  color: var(--color-text, #fff);
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.preview-view__back:hover {
  background: var(--color-bg-hover, #333);
}

.preview-view__workspace {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1.5rem;
  align-items: start;
}

.preview-view__main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-view__player {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.preview-view__sync-controls {
  background: var(--color-bg-secondary, #1a1a1a);
  border: 1px solid var(--color-border, #303030);
  border-radius: 12px;
  padding: 1.25rem;
}

.preview-view__sync-controls h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--color-text, #fff);
  font-weight: 600;
}

.preview-view__manual-sync {
  margin-top: 0.5rem;
}

.preview-view__field-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.preview-view__field-row .preview-view__input {
  flex: 1;
}

.preview-view__field-row .preview-view__btn {
  flex-shrink: 0;
  width: auto;
  padding: 0.6rem 1.25rem;
}

.preview-view__sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1rem;
}

.preview-view__card {
  background: var(--color-bg-secondary, #1a1a1a);
  border: 1px solid var(--color-border, #303030);
  border-radius: 12px;
  padding: 1.25rem;
}

.preview-view__card h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--color-text, #fff);
  font-weight: 600;
}

.preview-view__desc {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.4;
}

.preview-view__hint {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #aaa);
  line-height: 1.3;
}

.preview-view__settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preview-view__checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: var(--color-text, #fff);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.preview-view__checkbox:hover {
  background: var(--color-bg-tertiary, #242424);
}

.preview-view__checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary, #646cff);
}

.preview-view__checkbox span {
  flex: 1;
}

.preview-view__divider {
  height: 1px;
  background: var(--color-border, #303030);
  margin: 0.75rem 0;
}

.preview-view__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-view__label {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
  font-weight: 500;
}

.preview-view__select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border, #404040);
  background: var(--color-bg-tertiary, #242424);
  color: var(--color-text, #fff);
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.preview-view__select:hover {
  border-color: var(--color-primary, #646cff);
}

.preview-view__select:focus {
  outline: none;
  border-color: var(--color-primary, #646cff);
}

.preview-view__input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--color-border, #404040);
  background: var(--color-bg-tertiary, #242424);
  color: var(--color-text, #fff);
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.preview-view__input:hover {
  border-color: var(--color-primary, #646cff);
}

.preview-view__input:focus {
  outline: none;
  border-color: var(--color-primary, #646cff);
}

.preview-view__btn {
  width: 100%;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-view__btn--primary {
  background: var(--color-primary, #646cff);
  color: white;
  margin-top: 0.5rem;
}

.preview-view__btn--primary:hover {
  background: #535bf2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
}

.preview-view__btn--secondary {
  background: var(--color-bg-tertiary, #242424);
  color: var(--color-text, #fff);
  border: 1px solid var(--color-border, #404040);
  margin-top: 0.25rem;
}

.preview-view__btn--secondary:hover {
  background: var(--color-bg-hover, #333);
  border-color: var(--color-primary, #646cff);
}

@media (max-width: 1024px) {
  .preview-view__workspace {
    grid-template-columns: 1fr;
  }

  .preview-view__sidebar {
    position: static;
  }
}

@media (max-width: 640px) {
  .preview-view {
    padding: 1rem 0.75rem;
  }

  .preview-view__card {
    padding: 1rem;
  }
}
</style>
