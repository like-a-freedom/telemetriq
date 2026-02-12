<template>
  <div class="sync-slider" data-testid="sync-slider">
    <div class="sync-slider__header">
      <h3 class="sync-slider__title">Synchronization</h3>
      <span
        v-if="isAutoSynced"
        class="sync-slider__badge sync-slider__badge--auto"
      >
        Auto
      </span>
      <span v-else class="sync-slider__badge sync-slider__badge--manual">
        Manual
      </span>
    </div>

    <div class="sync-slider__controls">
      <label class="sync-slider__label">
        Offset: <strong>{{ formattedOffset }}</strong>
      </label>
      <input
        type="range"
        :min="-maxRange"
        :max="maxRange"
        :step="0.5"
        :value="offsetSeconds"
        @input="onSliderChange"
        class="sync-slider__range"
        data-testid="sync-range"
      />
      <div class="sync-slider__range-labels">
        <span>-{{ formatTime(maxRange) }}</span>
        <span>0</span>
        <span>+{{ formatTime(maxRange) }}</span>
      </div>
    </div>

    <div class="sync-slider__fine-controls">
      <button
        @click="adjustOffset(-1)"
        class="sync-slider__btn"
        data-testid="sync-minus1"
      >
        -1s
      </button>
      <button @click="adjustOffset(-0.5)" class="sync-slider__btn">
        -0.5s
      </button>
      <button
        @click="resetOffset"
        class="sync-slider__btn sync-slider__btn--reset"
        data-testid="sync-reset"
      >
        Reset
      </button>
      <button @click="adjustOffset(0.5)" class="sync-slider__btn">+0.5s</button>
      <button
        @click="adjustOffset(1)"
        class="sync-slider__btn"
        data-testid="sync-plus1"
      >
        +1s
      </button>
    </div>

    <p v-if="warning" class="sync-slider__warning">{{ warning }}</p>
    <p v-if="error" class="sync-slider__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { MANUAL_SYNC_RANGE_SECONDS } from "../modules/sync-engine";

const props = defineProps<{
  offsetSeconds: number;
  isAutoSynced: boolean;
  error?: string | null;
  warning?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:offsetSeconds", value: number): void;
}>();

const maxRange = MANUAL_SYNC_RANGE_SECONDS;

const formattedOffset = computed(() => {
  const seconds = props.offsetSeconds;
  const sign = seconds >= 0 ? "+" : "";
  if (Math.abs(seconds) >= 60) {
    const min = Math.floor(Math.abs(seconds) / 60);
    const sec = Math.abs(seconds) % 60;
    const prefix = seconds < 0 ? "-" : "+";
    return `${prefix}${min}m ${sec.toFixed(1)}s`;
  }
  return `${sign}${seconds.toFixed(1)}s`;
});

function formatTime(seconds: number): string {
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${seconds}s`;
}

function onSliderChange(event: Event): void {
  const value = parseFloat((event.target as HTMLInputElement).value);
  emit("update:offsetSeconds", value);
}

function adjustOffset(delta: number): void {
  emit("update:offsetSeconds", props.offsetSeconds + delta);
}

function resetOffset(): void {
  emit("update:offsetSeconds", 0);
}
</script>

<style scoped>
.sync-slider {
  background: var(--color-bg-secondary, #1a1a1a);
  border-radius: 12px;
  padding: 1.5rem;
}

.sync-slider__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.sync-slider__title {
  font-size: 1rem;
  margin: 0;
  color: var(--color-text, #fff);
}

.sync-slider__badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-weight: 600;
  text-transform: uppercase;
}

.sync-slider__badge--auto {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.sync-slider__badge--manual {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.sync-slider__label {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  color: var(--color-text-secondary, #aaa);
}

.sync-slider__range {
  width: 100%;
  cursor: pointer;
  accent-color: var(--color-primary, #646cff);
}

.sync-slider__range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #888);
  margin-top: 0.25rem;
}

.sync-slider__fine-controls {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  justify-content: center;
}

.sync-slider__btn {
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-tertiary, #2a2a2a);
  border: 1px solid var(--color-border, #404040);
  color: var(--color-text, #fff);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.sync-slider__btn:hover {
  background: var(--color-bg-hover, #333);
  border-color: var(--color-primary, #646cff);
}

.sync-slider__btn--reset {
  background: var(--color-primary, #646cff);
  border-color: var(--color-primary, #646cff);
}

.sync-slider__error {
  color: var(--color-error, #f44336);
  font-size: 0.85rem;
  margin: 0.75rem 0 0;
}

.sync-slider__warning {
  color: #ffb74d;
  font-size: 0.85rem;
  margin: 0.75rem 0 0;
}
</style>
