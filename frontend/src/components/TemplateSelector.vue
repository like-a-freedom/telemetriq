<template>
  <div class="template-selector">
    <div class="template-list">
      <button
        v-for="template in templates"
        :key="template.id"
        class="template-card"
        :class="{ 'template-card--active': isSelected(template.id) }"
        @click="selectTemplate(template.id)"
      >
        <div class="template-card__preview">
          <canvas
            :ref="(el) => setCanvasRef(template.id, el)"
            class="template-card__canvas"
            width="280"
            height="158"
          />
          <div v-if="isSelected(template.id)" class="template-card__badge">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
        <div class="template-card__info">
          <span class="template-card__name">{{ template.name }}</span>
          <span class="template-card__desc">{{ template.description }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, watch } from "vue";
import { useSettingsStore } from "../stores/settingsStore";
import type { TemplateId, TelemetryFrame } from "../core/types";
import {
  getTemplateConfig,
  getAllTemplateMetadata,
} from "../modules/template-configs";
import { renderOverlay } from "../modules/overlay-renderer";

const templates = getAllTemplateMetadata();
const settingsStore = useSettingsStore();

const canvasRefs = new Map<TemplateId, HTMLCanvasElement>();

const sampleFrame: TelemetryFrame = {
  timeOffset: 2520,
  hr: 164,
  paceSecondsPerKm: 272,
  distanceKm: 12.4,
  elapsedTime: "00:42:00",
  movingTimeSeconds: 2520,
};

function setCanvasRef(id: TemplateId, el: unknown): void {
  if (el instanceof HTMLCanvasElement) canvasRefs.set(id, el);
}

function isSelected(templateId: TemplateId): boolean {
  return settingsStore.currentTemplateId === templateId;
}

function selectTemplate(templateId: TemplateId): void {
  settingsStore.selectTemplate(templateId);
}

function renderPreviews(): void {
  for (const tmpl of templates) {
    const canvas = canvasRefs.get(tmpl.id);
    if (!canvas) continue;

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    // Dark cinematic background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, "#1a1a2e");
    bgGrad.addColorStop(1, "#16213e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid for depth
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render the template overlay
    const config = getTemplateConfig(tmpl.id);
    renderOverlay(ctx, sampleFrame, canvas.width, canvas.height, config);
  }
}

onMounted(async () => {
  await nextTick();
  renderPreviews();
});

watch(
  () => settingsStore.overlayConfig,
  () => {
    nextTick(renderPreviews);
  },
  { deep: true }
);
</script>

<style scoped>
.template-selector {
  margin-bottom: 0;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.template-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 10px;
  background: var(--color-bg-tertiary, #1e1e1e);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  text-align: left;
  color: inherit;
  font: inherit;
}

.template-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.template-card--active {
  border-color: var(--color-primary, #646cff);
  box-shadow: 0 0 0 1px var(--color-primary, #646cff),
    0 4px 16px rgba(100, 108, 255, 0.15);
}

.template-card--active:hover {
  border-color: var(--color-primary, #646cff);
}

.template-card__preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px 8px 0 0;
}

.template-card__canvas {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.template-card__badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary, #646cff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 6px rgba(100, 108, 255, 0.4);
}

.template-card__info {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.template-card__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text, #ffffff);
  letter-spacing: -0.01em;
}

.template-card__desc {
  font-size: 0.72rem;
  color: var(--color-text-secondary, #888);
  line-height: 1.3;
}
</style>