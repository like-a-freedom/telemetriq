<template>
  <div class="webgpu-settings p-4 bg-gray-100 rounded-lg">
    <h3 class="text-lg font-semibold mb-3">GPU Acceleration</h3>

    <div class="space-y-3">
      <!-- WebGPU Toggle -->
      <label class="flex items-center justify-between cursor-pointer">
        <span class="text-sm">
          Enable GPU Rendering (WebGPU)
          <span v-if="!supported" class="text-red-500 text-xs block">
            Not supported by your browser
          </span>
        </span>
        <input
          type="checkbox"
          :checked="enabled"
          :disabled="!supported"
          @change="handleToggleChange"
          class="w-5 h-5"
        />
      </label>

      <!-- Status -->
      <div class="text-xs text-gray-600 space-y-1">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="statusClass"></span>
          <span>{{ statusText }}</span>
        </div>

        <div v-if="supported && enabled" class="text-green-600">
          ✓ GPU acceleration active
        </div>
        <div v-else-if="supported && !enabled" class="text-yellow-600">
          ⚠ GPU acceleration disabled
        </div>
        <div v-else class="text-gray-500">
          ℹ Using CPU rendering (Canvas 2D)
        </div>
      </div>

      <!-- Performance Info -->
      <div v-if="supported" class="mt-4 p-3 bg-white rounded text-xs">
        <p class="font-semibold mb-2">Performance Benefits:</p>
        <ul class="space-y-1 text-gray-600">
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
  "bg-green-500": supported.value && enabled.value,
  "bg-yellow-500": supported.value && !enabled.value,
  "bg-red-500": !supported.value,
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
