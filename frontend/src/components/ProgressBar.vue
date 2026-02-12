<template>
  <div class="progress-bar" data-testid="progress-bar">
    <div class="progress-bar__header">
      <span class="progress-bar__phase">{{ phaseLabel }}</span>
      <span class="progress-bar__percent">{{ percent }}%</span>
    </div>

    <div class="progress-bar__track">
      <div
        class="progress-bar__fill"
        :style="{ width: `${percent}%` }"
        :class="{
          'progress-bar__fill--complete': isComplete,
          'progress-bar__fill--error': hasError,
        }"
      />
    </div>

    <div class="progress-bar__details">
      <span v-if="framesProcessed > 0">
        {{ framesProcessed }} / {{ totalFrames }} frames
      </span>
      <span v-if="estimatedRemaining">
        ~{{ formatRemaining(estimatedRemaining) }} left
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ProcessingProgress } from "../core/types";

const props = defineProps<{
  progress: ProcessingProgress;
  hasError?: boolean;
}>();

const percent = computed(() => props.progress.percent);
const framesProcessed = computed(() => props.progress.framesProcessed);
const totalFrames = computed(() => props.progress.totalFrames);
const estimatedRemaining = computed(
  () => props.progress.estimatedRemainingSeconds
);
const isComplete = computed(() => props.progress.phase === "complete");

const phaseLabel = computed(() => {
  switch (props.progress.phase) {
    case "demuxing":
      return "Preparing video...";
    case "processing":
      return "Processing frames...";
    case "encoding":
      return "Encoding...";
    case "muxing":
      return "Muxing video...";
    case "complete":
      return "Done!";
    default:
      return "Processing...";
  }
});

function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.max(0, seconds / 60);
  return `${minutes.toFixed(1)} min`;
}
</script>

<style scoped>
.progress-bar {
  background: var(--color-bg-secondary, #1a1a1a);
  border-radius: 12px;
  padding: 1.5rem;
}

.progress-bar__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.progress-bar__phase {
  font-size: 0.9rem;
  color: var(--color-text, #fff);
  font-weight: 500;
}

.progress-bar__percent {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-primary, #646cff);
}

.progress-bar__track {
  height: 8px;
  background: var(--color-bg-tertiary, #2a2a2a);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: var(--color-primary, #646cff);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-bar__fill--complete {
  background: var(--color-success, #4caf50);
}

.progress-bar__fill--error {
  background: var(--color-error, #f44336);
}

.progress-bar__details {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #888);
}
</style>
