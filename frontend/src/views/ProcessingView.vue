<template>
  <div class="processing-view">
    <header class="processing-view__header">
      <h2>Video processing</h2>
      <p class="processing-view__subtitle">
        Please do not close this tab until processing is complete
      </p>
    </header>

    <ProgressBar
      :progress="processingStore.progress"
      :has-error="!!processingStore.processingError"
    />

    <div
      v-if="processingStore.processingError"
      class="processing-view__error"
      data-testid="processing-error"
    >
      <p>❌ {{ processingStore.processingError }}</p>

      <div v-if="processingStore.processingError && (processingStore.processingError.includes('ffmpeg core') || processingStore.processingError.includes('ffmpeg-core.js'))" class="processing-view__hint">
        <p><strong>Hint:</strong> The browser failed to load the FFmpeg core JS/WASM. This is usually a network/CORS issue or missing local core files.</p>
        <p>Fix options:
          <ol>
            <li>Run <code>bun run fetch-ffmpeg-core</code> in the <code>frontend</code> folder to download core files to <code>public/vendor/ffmpeg</code>, then reload the page.</li>
            <li>Or ensure your network/CORS settings allow fetching from the CDN (check devtools Network tab for the requests to <code>@ffmpeg/core</code>).</li>
          </ol>
        </p>
      </div>

      <button class="processing-view__btn" @click="goBack">← Back</button>
    </div>

    <div v-if="processingStore.isProcessing" class="processing-view__actions">
      <button
        class="processing-view__btn processing-view__btn--cancel"
        @click="cancelProcessing"
        data-testid="cancel-btn"
      >
        Cancel
      </button>
    </div>

    <!-- Auto-redirect when complete -->
    <div
      v-if="processingStore.isComplete"
      class="processing-view__complete"
      data-testid="processing-complete"
    >
      <p>✅ Processing complete!</p>
      <button
        class="processing-view__btn processing-view__btn--primary"
        @click="goToResult"
      >
        Go to result →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, ref } from "vue";
import { useRouter } from "vue-router";
import {
  useFilesStore,
  useProcessingStore,
  useSettingsStore,
  useSyncStore,
} from "../stores";
import { buildTelemetryTimeline } from "../modules/telemetry-core";
import { VideoProcessor } from "../modules/video-processor";
import { AppError } from "../core/errors";
// @ts-expect-error Vue SFC default export typing handled by Vite/Vue tooling
import ProgressBar from "../components/ProgressBar.vue";

const router = useRouter();
const filesStore = useFilesStore();
const processingStore = useProcessingStore();
const settingsStore = useSettingsStore();
const syncStore = useSyncStore();
const processorRef = ref<VideoProcessor | null>(null);
const isE2E = new URLSearchParams(window.location.search).has("e2e");
const hasStarted = ref(false);

async function startProcessingFlow(): Promise<void> {
  if (hasStarted.value || !filesStore.isReady) return;
  hasStarted.value = true;

  const videoMeta = filesStore.videoMeta!;
  const totalFrames = Math.ceil(videoMeta.duration * videoMeta.fps);

  processingStore.startProcessing(totalFrames);

  try {
    if (isE2E) {
      await simulateProcessing(totalFrames);
      processingStore.setResult(new Blob([], { type: "video/mp4" }));
      return;
    }

    const telemetryFrames = buildTelemetryTimeline(filesStore.gpxData!.points);
    const processor = new VideoProcessor({
      videoFile: filesStore.videoFile!,
      videoMeta,
      telemetryFrames,
      syncOffsetSeconds: syncStore.offsetSeconds,
      overlayConfig: settingsStore.overlayConfig,
      onProgress: (progress) => processingStore.updateProgress(progress),
      useFfmpegMux: typeof SharedArrayBuffer !== "undefined",
    });
    processorRef.value = processor;

    const result = await processor.process();
    processingStore.setResult(result);
  } catch (err) {
    processingStore.setError(normalizeErrorMessage(err));
  }
}

onMounted(() => {
  if (!filesStore.isReady && !isE2E) {
    router.push("/");
    return;
  }

  if (filesStore.isReady) {
    void startProcessingFlow();
  }
});

watch(
  () => filesStore.isReady,
  (ready) => {
    if (ready) {
      void startProcessingFlow();
    }
  }
);

async function simulateProcessing(totalFrames: number): Promise<void> {
  const steps = 20;
  const delayMs = 100;

  for (let step = 1; step <= steps; step += 1) {
    if (!processingStore.isProcessing) break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const framesProcessed = Math.min(
      Math.round((step / steps) * totalFrames),
      totalFrames
    );
    processingStore.updateProgress({
      phase: "processing",
      percent: Math.min(99, Math.round((step / steps) * 100)),
      framesProcessed,
      totalFrames,
    });
  }
}

function cancelProcessing(): void {
  processorRef.value?.cancel();
  processingStore.cancelProcessing();
  goBack();
}

function normalizeErrorMessage(err: unknown): string {
  // Prefer AppError with details so we display helpful diagnostics when available
  if (err instanceof AppError && err.details) {
    const details = formatErrorDetails(err.details);
    return details ? `${err.message}\n\n${details}` : err.message;
  }

  if (err instanceof Error) return err.message;

  if (typeof err === "string") return err;
  try {
    const serialized = JSON.stringify(err);
    return serialized === undefined || serialized === "{}"
      ? "Unknown processing error"
      : serialized;
  } catch {
    return "Unknown processing error";
  }
}

function formatErrorDetails(details: Record<string, unknown>): string {
  if (typeof details.details === "string") return details.details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return "";
  }
}

function goBack(): void {
  settingsStore.setScreen("preview");
  router.push("/preview");
}

function goToResult(): void {
  settingsStore.setScreen("result");
  router.push("/result");
}

// Auto-redirect when complete
watch(
  () => processingStore.isComplete,
  (complete) => {
    if (complete && !isE2E) {
      setTimeout(() => {
        goToResult();
      }, 1500);
    }
  }
);
</script>

<style scoped>
.processing-view {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.processing-view__header {
  text-align: center;
  margin-bottom: 2rem;
}

.processing-view__header h2 {
  font-size: 1.5rem;
  margin: 0 0 0.5rem;
  color: var(--color-text, #fff);
}

.processing-view__subtitle {
  color: var(--color-text-secondary, #aaa);
  font-size: 0.9rem;
  margin: 0;
}

.processing-view__error {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 8px;
  text-align: center;
  color: var(--color-error, #f44336);
}

.processing-view__actions {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.processing-view__complete {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 1.1rem;
  color: var(--color-success, #4caf50);
}

.processing-view__btn {
  padding: 0.6rem 1.5rem;
  border: 1px solid var(--color-border, #404040);
  background: transparent;
  color: var(--color-text, #fff);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  margin-top: 0.75rem;
}

.processing-view__btn:hover {
  background: var(--color-bg-hover, #333);
}

.processing-view__btn--cancel {
  border-color: var(--color-error, #f44336);
  color: var(--color-error, #f44336);
}

.processing-view__btn--primary {
  background: var(--color-primary, #646cff);
  border-color: var(--color-primary, #646cff);
  color: white;
}

.processing-view__btn--primary:hover {
  background: #535bf2;
}
</style>
