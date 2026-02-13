<template>
  <div class="video-player" data-testid="video-player">
    <video
      ref="videoRef"
      :src="src"
      class="video-player__video"
      controls
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoaded"
    />
    <div class="video-player__overlay-canvas">
      <canvas
        ref="overlayCanvas"
        :width="videoWidth"
        :height="videoHeight"
        class="video-player__overlay"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import type { TelemetryFrame, ExtendedOverlayConfig } from "../core/types";
import { renderOverlay } from "../modules/overlay-renderer";
import { getTelemetryAtTime } from "../modules/telemetry-core";

const props = defineProps<{
  src: string;
  telemetryFrames: TelemetryFrame[];
  overlayConfig: ExtendedOverlayConfig;
  syncOffset: number;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const overlayCanvas = ref<HTMLCanvasElement | null>(null);
const videoWidth = ref(640);
const videoHeight = ref(360);
const currentTime = ref(0);

let animationFrameId: number | null = null;
let videoFrameHandle: number | null = null;

function onLoaded(): void {
  const video = videoRef.value;
  if (video) {
    videoWidth.value = video.videoWidth;
    videoHeight.value = video.videoHeight;
  }
}

function onTimeUpdate(): void {
  const video = videoRef.value;
  if (video) {
    currentTime.value = video.currentTime;
    drawOverlay();
  }
}

function scheduleFrameCallback(): void {
  const video = videoRef.value;
  if (!video) return;

  const requestVideoFrameCallback = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (
        cb: (now: number, meta: VideoFrameCallbackMetadata) => void
      ) => number;
    }
  ).requestVideoFrameCallback;

  if (typeof requestVideoFrameCallback !== "function") return;

  videoFrameHandle = requestVideoFrameCallback.call(video, (_, meta) => {
    currentTime.value = meta.mediaTime;
    drawOverlay();
    scheduleFrameCallback();
  });
}

async function drawOverlay(): Promise<void> {
  const canvas = overlayCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, videoWidth.value, videoHeight.value);

  const frame = getTelemetryAtTime(
    props.telemetryFrames,
    currentTime.value,
    props.syncOffset
  );

  if (frame) {
    await renderOverlay(
      ctx,
      frame,
      videoWidth.value,
      videoHeight.value,
      props.overlayConfig
    );
  }
}

watch(() => props.syncOffset, drawOverlay);
watch(() => props.overlayConfig, drawOverlay, { deep: true });
watch(() => props.telemetryFrames, drawOverlay, { deep: true });

onMounted(() => {
  const video = videoRef.value;
  if (!video) return;

  const requestVideoFrameCallback = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (
        cb: (now: number, meta: VideoFrameCallbackMetadata) => void
      ) => number;
    }
  ).requestVideoFrameCallback;

  if (typeof requestVideoFrameCallback === "function") {
    scheduleFrameCallback();
  }
});

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
  if (videoFrameHandle !== null && videoRef.value) {
    const video = videoRef.value as HTMLVideoElement & {
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    video.cancelVideoFrameCallback?.(videoFrameHandle);
  }
});
</script>

<style scoped>
.video-player {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.video-player__video {
  width: 100%;
  display: block;
}

.video-player__overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.video-player__overlay {
  width: 100%;
  height: 100%;
}
</style>
