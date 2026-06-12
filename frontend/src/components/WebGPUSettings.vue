<template>
  <div class="webgpu-settings">
    <h3 class="webgpu-settings__title">GPU Acceleration</h3>

    <div class="webgpu-settings__body">
      <label class="webgpu-settings__row">
        <span class="webgpu-settings__label">
          Enable GPU Rendering (WebGPU)
          <span v-if="!supported" class="webgpu-settings__error">
            Not supported by your browser
          </span>
        </span>
        <input
          type="checkbox"
          :checked="enabled"
          :disabled="!supported"
          @change="handleToggleChange"
          class="webgpu-settings__checkbox"
        />
      </label>

      <div class="webgpu-settings__status">
        <div class="webgpu-settings__status-row">
          <span class="webgpu-settings__dot" :class="statusClass"></span>
          <span class="webgpu-settings__status-text">{{ statusText }}</span>
        </div>

        <div v-if="supported && enabled" class="webgpu-settings__success">
          ✓ GPU acceleration active
        </div>
        <div v-else-if="supported && !enabled" class="webgpu-settings__warning">
          ⚠ GPU acceleration disabled
        </div>
        <div v-else class="webgpu-settings__muted">
          ℹ Using CPU rendering (Canvas 2D)
        </div>
      </div>

      <div v-if="supported" class="webgpu-settings__info">
        <p class="webgpu-settings__info-title">Performance Benefits:</p>
        <ul class="webgpu-settings__info-list">
          <li>• 5-20x faster overlay rendering</li>
          <li>• Lower CPU usage</li>
          <li>• Better battery life</li>
          <li>• Smoother video processing</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getWebGPUStatus, toggleWebGPU } from "../modules/webgpu";

const supported = ref(false);
const enabled = ref(false);

const statusClass = computed(() => ({
  "webgpu-settings__dot--on": supported.value && enabled.value,
  "webgpu-settings__dot--idle": supported.value && !enabled.value,
  "webgpu-settings__dot--off": !supported.value,
}));

const statusText = computed(() => {
  if (!supported.value) return "WebGPU Not Supported";
  if (enabled.value) return "WebGPU Enabled";
  return "WebGPU Disabled";
});

onMounted(() => {
  const status = getWebGPUStatus();
  supported.value = status.supported;
  enabled.value = status.enabled;
});

function handleToggle(value: boolean) {
  toggleWebGPU(value);
  enabled.value = value;
}

function handleToggleChange(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  handleToggle(target.checked);
}
</script>

<style scoped>
.webgpu-settings {
  padding: 1rem;
  background: var(--color-bg-secondary, #1a1a1a);
  border-radius: 0.5rem;
}

.webgpu-settings__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--color-text, #fff);
}

.webgpu-settings__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.webgpu-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.webgpu-settings__label {
  font-size: 0.875rem;
  color: var(--color-text, #fff);
}

.webgpu-settings__error {
  color: #ef4444;
  font-size: 0.75rem;
  display: block;
}

.webgpu-settings__checkbox {
  width: 1.25rem;
  height: 1.25rem;
}

.webgpu-settings__status {
  font-size: 0.75rem;
}

.webgpu-settings__status-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.webgpu-settings__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.webgpu-settings__dot--on {
  background-color: #22c55e;
}

.webgpu-settings__dot--idle {
  background-color: #eab308;
}

.webgpu-settings__dot--off {
  background-color: #ef4444;
}

.webgpu-settings__status-text {
  color: var(--color-text-secondary, #888);
}

.webgpu-settings__success {
  color: #22c55e;
  margin-bottom: 0.25rem;
}

.webgpu-settings__warning {
  color: #ca8a04;
  margin-bottom: 0.25rem;
}

.webgpu-settings__muted {
  color: var(--color-text-secondary, #888);
}

.webgpu-settings__info {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--color-bg-tertiary, #242424);
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.webgpu-settings__info-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--color-text, #fff);
}

.webgpu-settings__info-list {
  color: var(--color-text-secondary, #888);
  list-style: none;
  padding: 0;
  margin: 0;
}

.webgpu-settings__info-list li {
  margin-bottom: 0.25rem;
}
</style>
