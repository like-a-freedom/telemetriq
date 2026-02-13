<!-- Example: WebGPU Status Component -->
<template>
  <div class="webgpu-status">
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        :checked="webgpuEnabled"
        @change="handleChange"
        :disabled="!webgpuSupported"
      />
      <span>
        GPU Acceleration (WebGPU)
        <span v-if="!webgpuSupported" class="text-gray-400 text-sm">
          (not supported)
        </span>
      </span>
    </label>
    <div v-if="webgpuSupported" class="text-xs text-gray-500 mt-1">
      {{
        webgpuEnabled ? "Enabled - faster rendering" : "Disabled - using CPU"
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getWebGPUStatus, toggleWebGPU } from "../../modules/webgpu";

const webgpuSupported = ref(false);
const webgpuEnabled = ref(false);

onMounted(() => {
  const status = getWebGPUStatus();
  webgpuSupported.value = status.supported;
  webgpuEnabled.value = status.enabled;
});

function handleToggle(enabled: boolean) {
  toggleWebGPU(enabled);
  webgpuEnabled.value = enabled;
}

function handleChange(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  handleToggle(target.checked);
}
</script>
