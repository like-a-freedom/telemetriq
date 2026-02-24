<template>
  <div class="template-selector">
    <div class="template-dropdown">
      <label class="template-dropdown__label" for="template-select"
        >Template</label
      >
      <select
        id="template-select"
        class="template-dropdown__select"
        :value="settingsStore.currentTemplateId"
        @change="onTemplateChange"
      >
        <option
          v-for="template in templates"
          :key="template.id"
          :value="template.id"
        >
          {{ template.name }}
        </option>
      </select>

      <p v-if="selectedTemplate" class="template-dropdown__description">
        {{ selectedTemplate.description }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore } from "../stores/settingsStore";
import type { TemplateId } from "../core/types";
import { getAllTemplateMetadata } from "../modules/templateConfigs";

const templates = getAllTemplateMetadata();
const settingsStore = useSettingsStore();

const selectedTemplate = computed(() =>
  templates.find((t) => t.id === settingsStore.currentTemplateId)
);

function onTemplateChange(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const templateId = select.value as TemplateId;
  settingsStore.selectTemplate(templateId);
}
</script>

<style scoped>
.template-selector {
  margin-bottom: 0;
}

.template-dropdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.template-dropdown__label {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #aaa);
  font-weight: 500;
}

.template-dropdown__select {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.6rem 3rem 0.6rem 0.75rem; /* increased right padding so native arrow has breathing room */
  border: 1px solid var(--color-border, #404040);
  background: var(--color-bg-tertiary, #242424);
  color: var(--color-text, #fff);
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.2s;

  /* prevent the selected value from expanding the control on small screens */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  /* use canonical caret */
  -webkit-appearance: none;
  appearance: none;
  background-image: var(--ui-caret);
  background-repeat: no-repeat;
  background-position: right 0.9rem center;
  background-size: 10px 6px;
}

.template-dropdown__select:hover,
.template-dropdown__select:focus {
  outline: none;
  border-color: var(--color-primary, #646cff);
}

/* custom caret + hide native arrow to guarantee spacing */
.template-dropdown__select {
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238f8f8f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.9rem center;
  background-size: 10px 6px;
}
.template-dropdown__select::-ms-expand {
  display: none;
}

.template-dropdown__description {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary, #8f8f8f);
  line-height: 1.3;
}
</style>