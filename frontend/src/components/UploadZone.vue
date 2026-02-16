<template>
  <div
    class="upload-zone"
    :class="{
      'upload-zone--active': isDragOver,
      'upload-zone--has-file': hasFile,
      'upload-zone--error': errorMessage,
    }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="handleDrop"
    @click="openFileDialog"
    data-testid="upload-zone"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      class="upload-zone__input"
      @change="handleFileSelected"
      data-testid="file-input"
    />

    <div v-if="!hasFile" class="upload-zone__content">
      <div class="upload-zone__icon">{{ icon }}</div>
      <p class="upload-zone__title">{{ title }}</p>
      <p class="upload-zone__subtitle">{{ subtitle }}</p>
    </div>

    <div v-else class="upload-zone__file-info">
      <div class="upload-zone__file-icon">✅</div>
      <p class="upload-zone__file-name">{{ fileName }}</p>
      <p class="upload-zone__file-size">{{ fileSizeFormatted }}</p>
      <button
        class="upload-zone__remove"
        @click.stop="removeFile"
        data-testid="remove-file"
      >
        ✕ Remove
      </button>
    </div>

    <p
      v-if="errorMessage"
      class="upload-zone__error"
      data-testid="upload-error"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useFileDrop } from "../composables/useFileDrop";
import { useFormatters } from "../composables/useFormatters";

const props = defineProps<{
  accept: string;
  title: string;
  subtitle: string;
  icon: string;
  fileName?: string;
  fileSize?: number;
  hasFile?: boolean;
  errorMessage?: string | null;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: "file-selected", file: File): void;
  (e: "file-removed"): void;
}>();

const {
  fileInput,
  isDragOver,
  openFileDialog,
  onFileSelected,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  resetInput,
} = useFileDrop();

const { formatFileSize } = useFormatters();

void fileInput;

const fileSizeFormatted = computed(() => {
  if (!props.fileSize) return "";
  return formatFileSize(props.fileSize);
});

function handleFileSelected(event: Event): void {
  onFileSelected(event, (file) => emit("file-selected", file));
}

function handleDrop(event: DragEvent): void {
  onDrop(event, (file) => emit("file-selected", file));
}

function removeFile(): void {
  resetInput();
  emit("file-removed");
}
</script>

<script lang="ts">
export default {
  name: "UploadZone",
};
</script>

<style scoped>
.upload-zone {
  border: 2px dashed var(--color-border, #404040);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--color-bg-secondary, #1a1a1a);
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-zone:hover {
  border-color: var(--color-primary, #646cff);
  background: var(--color-bg-hover, #242424);
}

.upload-zone--active {
  border-color: var(--color-primary, #646cff);
  background: rgba(100, 108, 255, 0.1);
}

.upload-zone--has-file {
  border-style: solid;
  border-color: var(--color-success, #4caf50);
}

.upload-zone--error {
  border-color: var(--color-error, #f44336);
}

.upload-zone__input {
  display: none;
}

.upload-zone__icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.upload-zone__title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: var(--color-text, #fff);
}

.upload-zone__subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
  margin: 0;
}

.upload-zone__file-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.upload-zone__file-icon {
  font-size: 2rem;
}

.upload-zone__file-name {
  font-weight: 600;
  margin: 0;
  word-break: break-all;
  color: var(--color-text, #fff);
}

.upload-zone__file-size {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
  margin: 0;
}

.upload-zone__remove {
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-error, #f44336);
  color: var(--color-error, #f44336);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.upload-zone__remove:hover {
  background: var(--color-error, #f44336);
  color: white;
}

.upload-zone__error {
  color: var(--color-error, #f44336);
  font-size: 0.85rem;
  margin: 0.5rem 0 0;
}

@media (max-width: 640px) {
  .upload-zone {
    padding: 1.25rem;
    min-height: 150px;
    touch-action: manipulation;
  }

  .upload-zone__icon {
    font-size: 2rem;
  }

  .upload-zone__title {
    font-size: 1rem;
  }

  .upload-zone__remove {
    min-height: 44px;
    min-width: 44px;
    padding: 0.5rem 0.75rem;
  }
}
</style>
