<template>
  <div class="sync-slider" data-testid="sync-slider">
    <div class="sync-slider__top">
      <div class="sync-slider__status">
        <span
          class="sync-slider__dot"
          :class="isAutoSynced ? 'sync-slider__dot--auto' : 'sync-slider__dot--manual'"
        />
        <span class="sync-slider__status-label">{{ isAutoSynced ? 'Auto' : 'Manual' }}</span>
      </div>
      <div class="sync-slider__readout">
        <span class="sync-slider__readout-unit">Offset</span>
        <span class="sync-slider__readout-value">{{ formattedOffset }}</span>
      </div>
    </div>

    <div class="sync-slider__track-area">
      <div class="sync-slider__track-wrap">
        <input
          type="range"
          :min="sliderMin"
          :max="sliderMax"
          :step="0.5"
          :value="offsetSeconds"
          @input="onSliderChange"
          class="sync-slider__range"
          data-testid="sync-range"
        />
      </div>
      <div class="sync-slider__track-labels">
        <span>{{ formatTime(sliderMin) }}</span>
        <span class="sync-slider__track-center">{{ formatTime(autoSyncOffsetSeconds) }}</span>
        <span>{{ formatTime(sliderMax) }}</span>
      </div>
    </div>

    <div class="sync-slider__controls">
      <button
        @click="adjustOffset(-1)"
        class="sync-slider__btn"
        data-testid="sync-minus1"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="3" y="6" width="8" height="2" rx="1" fill="currentColor"/>
        </svg>
        <span>1s</span>
      </button>
      <button
        @click="adjustOffset(-0.5)"
        class="sync-slider__btn"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="4" y="6" width="6" height="2" rx="1" fill="currentColor"/>
        </svg>
        <span>0.5</span>
      </button>

      <button
        @click="resetOffset"
        class="sync-slider__btn sync-slider__btn--reset"
        data-testid="sync-reset"
        title="Reset to auto-sync position"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2.5a4.5 4.5 0 104.065 2.652" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M7 1v3h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <button
        @click="adjustOffset(0.5)"
        class="sync-slider__btn"
      >
        <span>0.5</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="4" y="6" width="6" height="2" rx="1" fill="currentColor"/>
          <rect x="6" y="4" width="2" height="6" rx="1" fill="currentColor"/>
        </svg>
      </button>
      <button
        @click="adjustOffset(1)"
        class="sync-slider__btn"
        data-testid="sync-plus1"
      >
        <span>1s</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="3" y="6" width="8" height="2" rx="1" fill="currentColor"/>
          <rect x="6" y="3" width="2" height="8" rx="1" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <p v-if="warning" class="sync-slider__warning">{{ warning }}</p>
    <p v-if="error" class="sync-slider__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getSyncRangeSeconds } from "../modules/syncEngine";

const props = defineProps<{
  offsetSeconds: number;
  autoSyncOffsetSeconds: number;
  isAutoSynced: boolean;
  videoDurationSeconds?: number;
  gpxTrackDurationSeconds?: number;
  error?: string | null;
  warning?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:offsetSeconds", value: number): void;
}>();

const halfRange = computed(() => {
  const durationBased = getSyncRangeSeconds(props.videoDurationSeconds);
  return Math.max(durationBased, 30);
});

const sliderMin = computed(() => {
  const gpxDuration = props.gpxTrackDurationSeconds;
  if (gpxDuration !== undefined && Number.isFinite(gpxDuration) && gpxDuration > 0) {
    return Math.min(0, props.autoSyncOffsetSeconds);
  }
  return props.autoSyncOffsetSeconds - halfRange.value;
});

const sliderMax = computed(() => {
  const gpxDuration = props.gpxTrackDurationSeconds;
  if (gpxDuration !== undefined && Number.isFinite(gpxDuration) && gpxDuration > 0) {
    return Math.max(gpxDuration, props.autoSyncOffsetSeconds);
  }
  return props.autoSyncOffsetSeconds + halfRange.value;
});

const formattedOffset = computed(() => {
  const seconds = props.offsetSeconds;
  if (seconds === 0) return '0s';

  const prefix = seconds < 0 ? "-" : "+";
  const abs = Math.abs(seconds);
  const totalMin = Math.floor(abs / 60);
  const sec = abs % 60;

  if (totalMin >= 60) {
    const hours = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return `${prefix}${hours}h ${min}m ${Math.round(sec)}s`;
  }

  if (totalMin > 0) {
    return `${prefix}${totalMin}m ${Math.round(sec)}s`;
  }

  return `${prefix}${seconds.toFixed(1)}s`;
});

function formatTime(seconds: number): string {
  if (seconds === 0) return '0';

  const sign = seconds < 0 ? '-' : '+';
  const abs = Math.abs(seconds);
  const totalMin = Math.floor(abs / 60);

  if (totalMin >= 60) {
    return `${sign}${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
  }

  if (totalMin > 0) {
    return `${sign}${totalMin}m`;
  }

  return `${sign}${abs}s`;
}

function onSliderChange(event: Event): void {
  const value = parseFloat((event.target as HTMLInputElement).value);
  emit("update:offsetSeconds", value);
}

function adjustOffset(delta: number): void {
  emit("update:offsetSeconds", props.offsetSeconds + delta);
}

function resetOffset(): void {
  emit("update:offsetSeconds", props.autoSyncOffsetSeconds);
}
</script>

<style scoped>
.sync-slider {
  padding: 1.25rem 1.5rem 1.25rem;
  border: 1px solid var(--color-border, #333);
  border-radius: 10px;
  background: var(--color-bg-secondary, #141414);
}

/* ── Top row: status dot + readout ── */
.sync-slider__top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 0.875rem;
}

.sync-slider__status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.sync-slider__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.3s, box-shadow 0.3s;
}

.sync-slider__dot--auto {
  background: var(--color-status-auto);
  box-shadow: 0 0 6px rgba(54,179,126,0.5);
}

.sync-slider__dot--manual {
  background: var(--color-status-manual);
  box-shadow: 0 0 6px rgba(255,159,67,0.5);
}

.sync-slider__status-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary, #888);
}

.sync-slider__readout {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.sync-slider__readout-unit {
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary, #666);
}

.sync-slider__readout-value {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace;
  font-size: 1.35rem;
  font-weight: 500;
  line-height: 1;
  color: var(--color-text, #fff);
  letter-spacing: -0.01em;
  tab-size: 1;
}

/* ── Slider track ── */
.sync-slider__track-area {
  margin-bottom: 0.875rem;
}

.sync-slider__track-wrap {
  position: relative;
  height: 28px;
  display: flex;
  align-items: center;
}

.sync-slider__range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  background: var(--color-bg-tertiary, #1e1e1e);
  transition: background 0.2s;
}

.sync-slider__range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
}

.sync-slider__range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-text, #fff);
  border: 2px solid var(--color-bg, #0a0a0a);
  cursor: pointer;
  margin-top: -5px;
  transition: transform 0.15s, box-shadow 0.15s;
}

.sync-slider__range::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-text) 12%, transparent);
}

.sync-slider__range::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: var(--color-bg-tertiary, #1e1e1e);
  border: none;
}

.sync-slider__range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-text, #fff);
  border: 2px solid var(--color-bg, #0a0a0a);
  cursor: pointer;
}

.sync-slider__range:focus-visible {
  outline: 2px solid var(--color-primary, #646cff);
  outline-offset: 4px;
}

.sync-slider__track-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--color-text-secondary, #555);
  margin-top: 0.3rem;
  font-variant-numeric: tabular-nums;
}

.sync-slider__track-center {
  color: var(--color-text-secondary, #777);
  font-weight: 600;
}

/* ── Control buttons ── */
.sync-slider__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.sync-slider__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--color-border, #333);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary, #888);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
  line-height: 1;
  user-select: none;
}

.sync-slider__btn:hover {
  color: var(--color-text, #fff);
  border-color: var(--color-text-secondary, #666);
  background: var(--color-bg-tertiary, #1e1e1e);
}

.sync-slider__btn:active {
  background: var(--color-bg-hover, #2a2a2a);
  transform: scale(0.96);
}

.sync-slider__btn svg {
  display: block;
  flex-shrink: 0;
}

.sync-slider__btn--reset {
  padding: 0.35rem 0.5rem;
  border-color: var(--color-primary, #646cff);
  color: var(--color-primary, #646cff);
}

.sync-slider__btn--reset:hover {
  background: var(--color-primary, #646cff);
  color: #fff;
}

/* ── Messages ── */
.sync-slider__warning {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--color-warning);
}

.sync-slider__error {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--color-error);
}

/* ── Mobile ── */
@media (max-width: 640px) {
  .sync-slider {
    padding: 1rem 1rem 1rem;
  }

  .sync-slider__readout-value {
    font-size: 1.1rem;
  }

  .sync-slider__controls {
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .sync-slider__btn {
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
  }
}
</style>
