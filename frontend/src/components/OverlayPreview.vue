<template>
  <div class="overlay-preview" data-testid="overlay-preview">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="overlay-preview__canvas"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import type { TelemetryFrame, ExtendedOverlayConfig } from "../core/types";
import { renderOverlay } from "../modules/overlay-renderer";

const props = defineProps<{
  frame: TelemetryFrame;
  config: ExtendedOverlayConfig;
  videoWidth?: number;
  videoHeight?: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasWidth = ref(props.videoWidth ?? 640);
const canvasHeight = ref(props.videoHeight ?? 360);

async function draw(): Promise<void> {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Dark background to simulate video
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value);

  // Grid pattern
  ctx.strokeStyle = "#2a2a4e";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvasWidth.value; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight.value);
    ctx.stroke();
  }
  for (let y = 0; y < canvasHeight.value; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth.value, y);
    ctx.stroke();
  }

  // Render overlay
  await renderOverlay(
    ctx,
    props.frame,
    canvasWidth.value,
    canvasHeight.value,
    props.config
  );
}

onMounted(draw);

watch([() => props.frame, () => props.config], draw, { deep: true });
</script>

<style scoped>
.overlay-preview {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border, #404040);
}

.overlay-preview__canvas {
  width: 100%;
  height: auto;
  display: block;
}
</style>
