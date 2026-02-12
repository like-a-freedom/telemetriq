<template>
  <div class="template-selector">
    <h3>Select Overlay Template</h3>
    <div class="template-grid">
      <button
        v-for="template in availableTemplates"
        :key="template.id"
        class="template-option"
        :class="{ 'selected': isSelected(template.id) }"
        @click="selectTemplate(template.id)"
      >
        <div class="template-preview" :style="getPreviewStyle(template.id)">
          {{ template.name }}
        </div>
        <span class="template-name">{{ template.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';
import type { TemplateId } from '../core/types';
import { getTemplateConfig, getAvailableTemplates as getAvailableTemplateIds } from '../modules/template-configs';

// Define the template info type
interface TemplateInfo {
  id: TemplateId;
  name: string;
}

// Get available template IDs and map to template info
const availableTemplateIds = getAvailableTemplateIds().filter(id => id !== 'custom') as TemplateId[];

// Map template IDs to readable names
const templateMap: Record<TemplateId, string> = {
  'minimalist': 'Minimalist',
  'sporty': 'Sporty',
  'professional': 'Professional',
  'modern': 'Modern',
  'high-contrast': 'High Contrast',
  'custom': 'Custom'
};

const availableTemplates = computed<TemplateInfo[]>(() => {
  return availableTemplateIds.map(id => ({
    id,
    name: templateMap[id] || id
  }));
});

const settingsStore = useSettingsStore();

const isSelected = (templateId: TemplateId) => {
  return settingsStore.currentTemplateId === templateId;
};

const selectTemplate = (templateId: TemplateId) => {
  settingsStore.selectTemplate(templateId);
};

const getPreviewStyle = (templateId: TemplateId) => {
  const config = getTemplateConfig(templateId);
  return {
    backgroundColor: config.backgroundColor || '#000000',
    color: config.textColor || '#FFFFFF',
    fontFamily: config.fontFamily || 'sans-serif',
    fontSize: '12px',
    padding: '8px',
    borderRadius: `${config.cornerRadius || 4}px`,
    border: config.borderWidth ? `${config.borderWidth}px solid ${config.borderColor || '#FFFFFF'}` : 'none',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60px',
    fontWeight: 'bold',
    boxShadow: config.textShadow ? `2px 2px 4px ${config.textShadowColor || '#000000'}` : 'none',
    background: config.gradientBackground && config.gradientStartColor && config.gradientEndColor
      ? `linear-gradient(to bottom, ${config.gradientStartColor}, ${config.gradientEndColor})`
      : 'none'
  };
};
</script>

<style scoped>
.template-selector {
  margin-bottom: 24px;
}

.template-selector h3 {
  margin-bottom: 16px;
  color: var(--color-text, #333333);
  font-weight: 600;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}

.template-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid transparent;
  border-radius: 8px;
  background-color: var(--color-background-soft, #f5f5f5);
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-option:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.template-option.selected {
  border-color: var(--color-primary, #406de6);
  background-color: var(--color-primary-light, #e6eeff);
}

.template-preview {
  width: 100%;
  box-sizing: border-box;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text, #333333);
  text-align: center;
}
</style>