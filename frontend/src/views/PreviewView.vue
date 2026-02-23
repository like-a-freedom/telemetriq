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
            :video-duration-seconds="filesStore.videoMeta?.duration"
          />
        </div>

        <div class="preview-view__sync-controls">
          <div class="preview-view__sync-header">
            <h3>Synchronization</h3>

            <button
              class="preview-view__collapse-btn"
              @click="toggleSyncCollapsed"
              :aria-expanded="!syncCollapsed"
              aria-controls="sync-section"
              data-testid="sync-collapse-toggle"
              title="Toggle synchronization panel"
            >
              <span
                class="chevron"
                :class="{ 'chevron--open': !syncCollapsed }"
                aria-hidden="true"
              ></span>
            </button>
          </div>

          <p class="preview-view__desc">
            Align telemetry data with video timeline.
          </p>

          <div id="sync-section" v-show="!syncCollapsed">
            <SyncSlider
              :offset-seconds="syncStore.offsetSeconds"
              :is-auto-synced="syncStore.isAutoSynced"
              :video-duration-seconds="filesStore.videoMeta?.duration"
              :error="syncStore.syncError"
              :warning="syncStore.syncWarning"
              @update:offset-seconds="onManualOffsetChange"
            />

            <div class="preview-view__divider"></div>

            <div class="preview-view__manual-sync">
              <label class="preview-view__label">Manual start time</label>
              <p class="preview-view__hint">
                Set activity start time if auto-sync fails.
              </p>
              <div class="preview-view__field-row">
                <DateTimePicker v-model="manualStartTime" />
                <button
                  class="preview-view__btn preview-view__btn--secondary"
                  @click="applyManualTime"
                >
                  Apply
                </button>
              </div>
              <div class="preview-view__field-row preview-view__timezone-row">
                <label class="preview-view__label preview-view__label--small"
                  >Timezone</label
                >
                <select v-model="manualTimezone" class="preview-view__select">
                  <option
                    v-for="tz in timezones"
                    :key="tz.value"
                    :value="tz.value"
                  >
                    {{ tz.label }}
                  </option>
                </select>
              </div>
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
            <label
              class="preview-view__checkbox"
              :class="{
                'preview-view__checkbox--disabled': !templateCapabilities.isMetricAvailable('hr'),
              }"
            >
              <input
                type="checkbox"
                v-model="settingsStore.overlayConfig.showHr"
                :disabled="!templateCapabilities.isMetricAvailable('hr')"
                :title="templateCapabilities.getMetricDisableReason('hr')"
              />
              <span>❤️ Heart rate</span>
            </label>
            <label
              class="preview-view__checkbox"
              :class="{
                'preview-view__checkbox--disabled': !templateCapabilities.isMetricAvailable('pace'),
              }"
            >
              <input
                type="checkbox"
                v-model="settingsStore.overlayConfig.showPace"
                :disabled="!templateCapabilities.isMetricAvailable('pace')"
                :title="templateCapabilities.getMetricDisableReason('pace')"
              />
              <span>🏃 Pace</span>
            </label>
            <label
              class="preview-view__checkbox"
              :class="{
                'preview-view__checkbox--disabled': !templateCapabilities.isMetricAvailable('distance'),
              }"
            >
              <input
                type="checkbox"
                v-model="settingsStore.overlayConfig.showDistance"
                :disabled="!templateCapabilities.isMetricAvailable('distance')"
                :title="templateCapabilities.getMetricDisableReason('distance')"
              />
              <span>📏 Distance</span>
            </label>
            <label
              class="preview-view__checkbox"
              :class="{
                'preview-view__checkbox--disabled': !templateCapabilities.isMetricAvailable('time'),
              }"
            >
              <input
                type="checkbox"
                v-model="settingsStore.overlayConfig.showTime"
                :disabled="!templateCapabilities.isMetricAvailable('time')"
                :title="templateCapabilities.getMetricDisableReason('time')"
              />
              <span>⏱️ Time</span>
            </label>
          </div>

          <div class="preview-view__divider"></div>

          <div class="preview-view__field" v-if="templateCapabilities.supportsFeature('supportsPosition')">
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
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useFilesStore, useSyncStore, useSettingsStore } from "../stores";
import { useTemplateCapabilities } from "../composables/useTemplateCapabilities";
import { buildTelemetryTimeline } from "../modules/telemetry-core";
import type { TelemetryFrame } from "../core/types";
import { useSeo } from "../composables/useSeo";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import VideoPlayer from "../components/VideoPlayer.vue";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import SyncSlider from "../components/SyncSlider.vue";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import TemplateSelector from "../components/TemplateSelector.vue";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import DateTimePicker from "../components/DateTimePicker.vue";

// SEO
useSeo({
  title: "Preview & Customize",
  description:
    "Preview and customize your telemetry overlay. Adjust sync, select templates, and position metrics before processing.",
});

const router = useRouter();
const filesStore = useFilesStore();
const syncStore = useSyncStore();
const settingsStore = useSettingsStore();
const templateCapabilities = useTemplateCapabilities();

// Collapse synchronization panel by default when auto-sync succeeded.
const syncCollapsed = ref<boolean>(syncStore.isAutoSynced);
let _userToggledSync = false;
function toggleSyncCollapsed(): void {
  _userToggledSync = true;
  syncCollapsed.value = !syncCollapsed.value;
}

// Auto-collapse when auto-sync becomes true — but respect manual user toggles.
watch(
  () => syncStore.isAutoSynced,
  (val) => {
    if (val && !_userToggledSync) syncCollapsed.value = true;
  }
);

const videoUrl = ref<string | null>(null);
const telemetryFrames = ref<TelemetryFrame[]>([]);
const manualStartTime = ref("");
const manualTimezone = ref(180); // Default: UTC+3 (Moscow)

const timezones = [
  { value: -720, label: "UTC-12" },
  { value: -660, label: "UTC-11" },
  { value: -600, label: "UTC-10" },
  { value: -540, label: "UTC-9" },
  { value: -480, label: "UTC-8 (Pacific)" },
  { value: -420, label: "UTC-7 (Mountain)" },
  { value: -360, label: "UTC-6 (Central)" },
  { value: -300, label: "UTC-5 (Eastern)" },
  { value: -240, label: "UTC-4 (Atlantic)" },
  { value: -180, label: "UTC-3" },
  { value: -120, label: "UTC-2" },
  { value: -60, label: "UTC-1" },
  { value: 0, label: "UTC" },
  { value: 60, label: "UTC+1" },
  { value: 120, label: "UTC+2" },
  { value: 180, label: "UTC+3 (Moscow)" },
  { value: 240, label: "UTC+4" },
  { value: 300, label: "UTC+5" },
  { value: 330, label: "UTC+5:30 (India)" },
  { value: 360, label: "UTC+6" },
  { value: 420, label: "UTC+7" },
  { value: 480, label: "UTC+8" },
  { value: 540, label: "UTC+9" },
  { value: 600, label: "UTC+10" },
  { value: 660, label: "UTC+11" },
  { value: 720, label: "UTC+12" },
];

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
      filesStore.videoMeta?.gps?.lon
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

function onManualOffsetChange(offsetSeconds: number): void {
  syncStore.setManualOffset(offsetSeconds, filesStore.videoMeta?.duration);
}

function parseManualDateTimeWithTimezone(
  input: string,
  timezoneOffsetMinutes: number
): Date | null {
  const [datePart, timePart] = input.split("T");
  if (!datePart || !timePart) return null;

  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const [hourStr, minuteStr, secondStr = "0"] = timePart.split(":");

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);

  if (
    [year, month, day, hour, minute, second].some((value) =>
      Number.isNaN(value)
    )
  ) {
    return null;
  }

  // Interpret input as wall-clock time in selected timezone, then convert to UTC.
  const wallClockMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcMs = wallClockMs - timezoneOffsetMinutes * 60_000;
  return new Date(utcMs);
}

function applyManualTime(): void {
  if (!filesStore.gpxData || !manualStartTime.value) return;

  const manualUtcTime = parseManualDateTimeWithTimezone(
    manualStartTime.value,
    manualTimezone.value
  );

  if (!manualUtcTime || Number.isNaN(manualUtcTime.getTime())) return;

  syncStore.performAutoSync(
    filesStore.gpxData.points,
    manualUtcTime,
    undefined,
    undefined,
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

.preview-view__sync-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.preview-view__sync-controls h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--color-text, #fff);
  font-weight: 600;
}

.preview-view__collapse-btn {
  /* square, icon-only button with balanced proportions */
  padding: 0.5rem;
  border: 1px solid var(--color-border, #404040);
  background: var(--color-bg-tertiary, #242424);
  color: var(--color-text, #fff);
  font-size: 0.9rem;
  height: 36px;
  width: 36px;
  min-width: 36px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
}
.preview-view__collapse-btn:focus {
  outline: none;
  border-color: var(--color-primary, #646cff);
  box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.12);
}
.preview-view__collapse-btn:hover {
  background: var(--color-bg-hover, #2a2a2a);
  border-color: var(--color-primary, #646cff);
  transform: translateY(-1px);
}
.preview-view__collapse-btn:active {
  transform: translateY(0);
}

.chevron {
  display: inline-block;
  width: 10px;
  height: 6px;
  line-height: 0;
  transform: rotate(0deg);
  transition: transform 0.15s ease-in-out;
  /* hide possible textual fallback */
  color: transparent;
  font-size: 0;
}
.chevron::before {
  content: "";
  display: inline-block;
  width: 100%;
  height: 100%;
  background-image: var(--ui-caret);
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
}
.chevron--open {
  transform: rotate(180deg);
}

.preview-view__manual-sync {
  margin-top: 0.5rem;
}

.preview-view__field-row {
  display: flex;
  gap: 0.75rem;
  align-items: center; /* vertically center inputs and buttons for consistent visual rhythm */
}

.preview-view__field-row .preview-view__input,
.preview-view__field-row .datetime-picker {
  flex: 1;
}

.preview-view__field-row .preview-view__btn {
  flex-shrink: 0;
  width: auto;
  padding: 0.6rem 1.25rem;
}

.preview-view__timezone-row {
  margin-top: 0.75rem;
  flex-direction: column;
  align-items: stretch;
}

/* Make timezone select visually consistent with other selects */
.preview-view__timezone-row .preview-view__select {
  width: 100%;
  padding: 0.6rem 3rem 0.6rem 0.75rem; /* increased right padding for timezone select */
  border: 1px solid var(--color-border, #404040);
  border-radius: 6px;
  background: var(--color-bg-tertiary, #242424);
  color: var(--color-text, #fff);
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

/* wrapper + explicit caret for timezone select (guaranteed visibility) */
/* removed wrapper caret — unified caret comes from --ui-caret */

.preview-view__timezone-row .preview-view__select:hover {
  border-color: var(--color-primary, #646cff);
}
.preview-view__label--small {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #888);
  margin-bottom: 0.25rem;
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

.preview-view__checkbox--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
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
  padding: 0.6rem 3rem 0.6rem 0.75rem; /* increased right padding so native arrow has breathing room */
  border: 1px solid var(--color-border, #404040);
  background: var(--color-bg-tertiary, #242424);
  color: var(--color-text, #fff);
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.2s;
  -webkit-appearance: none;
  appearance: none;
  background-image: var(--ui-caret);
  background-repeat: no-repeat;
  background-position: right 0.9rem center;
  background-size: 10px 6px;
}

.preview-view__select:hover {
  border-color: var(--color-primary, #646cff);
}

.preview-view__select:focus {
  outline: none;
  border-color: var(--color-primary, #646cff);
}

/* custom caret + hide native arrow to guarantee spacing */
.preview-view__select {
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238f8f8f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.9rem center;
  background-size: 10px 6px;
}
.preview-view__select::-ms-expand {
  display: none;
}

.preview-view__timezone-row .preview-view__select {
  -webkit-appearance: none;
  appearance: none;
}

/* Fix: ensure the unified caret (var(--ui-caret)) is always shown for the timezone select.
   Some Chromium rendering/pathologies can reset background-image when `background` shorthand
   is used earlier — explicitly set background-image here after other rules. */
.preview-view__timezone-row .preview-view__select {
  background-image: var(--ui-caret);
  background-repeat: no-repeat;
  background-position: right 0.9rem center;
  background-size: 10px 6px;
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

  .preview-view__header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .preview-view__header h2 {
    font-size: 1.2rem;
  }

  .preview-view__back {
    width: 100%;
    text-align: center;
  }

  .preview-view__field-row {
    flex-direction: column;
  }

  .preview-view__field-row .preview-view__btn {
    width: 100%;
  }

  .preview-view__btn {
    min-height: 48px;
  }

  .preview-view__checkbox {
    padding: 0.75rem 0.5rem;
  }
}
</style>
