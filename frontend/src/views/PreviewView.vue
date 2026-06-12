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

          <div
            v-if="selectedTemplateWarnings.length"
            class="preview-view__warning-block"
            data-testid="template-data-warning"
          >
            <p class="preview-view__warning-title">Template data check</p>
            <ul class="preview-view__warning-list">
              <li v-for="warning in selectedTemplateWarnings" :key="warning">
                {{ warning }}
              </li>
            </ul>
          </div>

          <div class="preview-view__settings">
            <label
              v-for="control in metricControls"
              :key="control.key"
              class="preview-view__checkbox"
              :class="{
                'preview-view__checkbox--disabled': !control.available,
                'preview-view__checkbox--locked': control.required,
              }"
            >
              <input
                type="checkbox"
                :checked="control.checked"
                :disabled="control.disabled"
                :title="control.reason"
                @change="onMetricToggle(control.key, $event)"
              />
              <span class="preview-view__metric-meta">
                <span class="preview-view__metric-title">
                  <span>{{ control.label }}</span>
                  <span
                    v-if="control.stateLabel"
                    class="preview-view__metric-state"
                    :class="
                      control.required
                        ? 'preview-view__metric-state--locked'
                        : 'preview-view__metric-state--disabled'
                    "
                    >{{ control.stateLabel }}</span
                  >
                </span>
                <span class="preview-view__metric-hint">
                  {{ control.helperText }}
                </span>
              </span>
            </label>
          </div>

          <div class="preview-view__divider"></div>

          <div
            class="preview-view__field"
            v-if="templateCapabilities.supportsFeature('supportsPosition')"
          >
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
          Start processing
        </button>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useFilesStore, useSyncStore, useSettingsStore } from "../stores";
import { useTemplateCapabilities } from "../composables/useTemplateCapabilities";
import { buildTelemetryTimeline } from "../modules/telemetryCore";
import type { ExtendedOverlayConfig, TelemetryFrame } from "../core/types";
import type { MetricType } from "../modules/templates";
import { useSeo } from "../composables/useSeo";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import VideoPlayer from "../components/VideoPlayer.vue";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import SyncSlider from "../components/SyncSlider.vue";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import TemplateSelector from "../components/TemplateSelector.vue";
// @ts-ignore Vue SFC default export typing handled by current tooling setup
import DateTimePicker from "../components/DateTimePicker.vue";

type MetricToggleKey =
  | "showHr"
  | "showPace"
  | "showDistance"
  | "showTime"
  | "showSpeed"
  | "showGrade"
  | "showElevation"
  | "showCadence"
  | "showPower";

interface MetricControlDefinition {
  key: MetricToggleKey;
  metric: MetricType;
  label: string;
  hint: string;
}

const METRIC_CONTROLS: MetricControlDefinition[] = [
  {
    key: "showHr",
    metric: "hr",
    label: "Heart rate",
    hint: "Beat-by-beat effort from your GPX track.",
  },
  {
    key: "showPace",
    metric: "pace",
    label: "Pace",
    hint: "Current pace from synchronized GPX segments with isolated spike filtering.",
  },
  {
    key: "showDistance",
    metric: "distance",
    label: "Distance",
    hint: "Total distance covered since the start.",
  },
  {
    key: "showTime",
    metric: "time",
    label: "Time",
    hint: "Moving time that excludes pauses.",
  },
  {
    key: "showSpeed",
    metric: "speed",
    label: "Speed",
    hint: "Current speed from synchronized GPX segments with isolated spike filtering.",
  },
  {
    key: "showGrade",
    metric: "grade",
    label: "Grade",
    hint: "Slope percentage based on smoothed elevation.",
  },
  {
    key: "showElevation",
    metric: "elevation",
    label: "Elevation",
    hint: "Current altitude from GPX elevation samples.",
  },
  {
    key: "showCadence",
    metric: "cadence",
    label: "Cadence",
    hint: "Stride or pedal cadence when present in GPX extensions.",
  },
  {
    key: "showPower",
    metric: "power",
    label: "Power",
    hint: "Power data from compatible devices and GPX extensions.",
  },
];

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

const metricControls = computed(() =>
  METRIC_CONTROLS.map((control) => {
    const available = templateCapabilities.isMetricAvailable(control.metric);
    const required = templateCapabilities.isMetricRequired(control.metric);
    const reason = required
      ? "Required by the selected template"
      : templateCapabilities.getMetricDisableReason(control.metric);

    return {
      ...control,
      checked: settingsStore.overlayConfig[control.key],
      available,
      required,
      disabled: !available || required,
      reason,
      stateLabel: required ? "Locked" : !available ? "Unavailable" : undefined,
      helperText: required
        ? "Always visible in this template."
        : !available
        ? reason ?? "Not available for this template."
        : control.hint,
    };
  })
);

const gpxPoints = computed(() => filesStore.gpxData?.points ?? []);

const telemetryDataAvailability = computed(() => ({
  elevation: gpxPoints.value.some((point) => point.ele !== undefined),
  cadence: gpxPoints.value.some((point) => point.cadence !== undefined),
  power: gpxPoints.value.some((point) => point.power !== undefined),
}));

const selectedTemplateWarnings = computed(() => {
  if (
    settingsStore.currentTemplateId === "trail-run" &&
    !telemetryDataAvailability.value.elevation
  ) {
    return [
      "Trail Run needs elevation samples in the GPX file. Grade and elevation will render as N/A with the current file.",
    ];
  }

  if (settingsStore.currentTemplateId === "cycling-pro") {
    const warnings: string[] = [];
    if (!telemetryDataAvailability.value.cadence) {
      warnings.push(
        "Cycling Pro has no cadence samples in the current GPX file. Cadence will render as N/A."
      );
    }
    if (!telemetryDataAvailability.value.power) {
      warnings.push(
        "Cycling Pro has no power samples in the current GPX file. Power will render as N/A."
      );
    }
    return warnings;
  }

  return [];
});

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

function onMetricToggle(key: MetricToggleKey, event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  settingsStore.updateOverlayConfig({
    [key]: target.checked,
  } as Partial<ExtendedOverlayConfig>);
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
  padding: 0.65rem 0.7rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.015);
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}

.preview-view__checkbox:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.preview-view__checkbox--disabled {
  opacity: 0.56;
  cursor: not-allowed;
  border-style: solid;
  transform: none;
}

.preview-view__checkbox--disabled:hover {
  background: rgba(255, 255, 255, 0.015);
  border-color: rgba(255, 255, 255, 0.06);
  transform: none;
}

.preview-view__checkbox--locked {
  cursor: default;
  background: linear-gradient(
    135deg,
    rgba(100, 108, 255, 0.14),
    rgba(100, 108, 255, 0.05)
  );
  border-color: rgba(100, 108, 255, 0.3);
}

.preview-view__checkbox--locked:hover {
  background: linear-gradient(
    135deg,
    rgba(100, 108, 255, 0.16),
    rgba(100, 108, 255, 0.06)
  );
  border-color: rgba(100, 108, 255, 0.36);
  transform: none;
}

.preview-view__checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary, #646cff);
}

.preview-view__checkbox input[type="checkbox"]:disabled {
  cursor: default;
}

.preview-view__checkbox span {
  flex: 1;
}

.preview-view__metric-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.preview-view__metric-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  font-weight: 600;
}

.preview-view__metric-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.16rem 0.42rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preview-view__metric-state--locked {
  background: rgba(100, 108, 255, 0.2);
  color: #e7e9ff;
}

.preview-view__metric-state--disabled {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.58);
}

.preview-view__metric-hint {
  color: var(--color-text-secondary, #8c8c8c);
  font-size: 0.75rem;
  line-height: 1.35;
}

.preview-view__warning-block {
  margin: 0 0 1rem;
  padding: 0.95rem 1rem;
  border-radius: 12px;
  background: linear-gradient(
    180deg,
    rgba(255, 167, 38, 0.16),
    rgba(84, 45, 9, 0.36)
  );
  border: 1px solid rgba(255, 196, 107, 0.34);
  box-shadow: inset 0 1px 0 rgba(255, 224, 163, 0.06);
  color: #ffe1a7;
  font-size: 0.82rem;
  line-height: 1.5;
}

.preview-view__warning-title {
  margin: 0;
  color: #fff3d1;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preview-view__warning-list {
  margin: 0.55rem 0 0;
  padding-left: 1.1rem;
}

.preview-view__warning-list li + li {
  margin-top: 0.35rem;
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

.preview-view__select::-ms-expand {
  display: none;
}

.preview-view__timezone-row .preview-view__select {
  -webkit-appearance: none;
  appearance: none;
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
  background: linear-gradient(135deg, #646cff, #7b82ff);
  color: white;
  margin-top: 0.5rem;
  box-shadow: 0 10px 24px rgba(100, 108, 255, 0.2);
}

.preview-view__btn--primary:hover {
  background: linear-gradient(135deg, #5a63ff, #7078ff);
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(100, 108, 255, 0.32);
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
