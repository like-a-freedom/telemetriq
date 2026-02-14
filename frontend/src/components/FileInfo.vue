<template>
  <div class="file-info" data-testid="file-info">
    <div class="file-info__row">
      <span class="file-info__label">{{ label }}</span>
      <span class="file-info__value">{{ value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();
</script>

<script lang="ts">
export default {
  name: "FileInfo",
};
</script>

<style scoped>
.file-info {
  padding: 0.5rem 0;
}

.file-info__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.file-info__label {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
}

.file-info__value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text, #fff);
}
</style>
