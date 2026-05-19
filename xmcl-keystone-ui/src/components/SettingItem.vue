<template>
  <div class="setting-item select-none">
    <div v-if="slots.preaction" class="setting-item__preaction">
      <slot name="preaction" :title-id="titleId" :description-id="descriptionId" />
    </div>
    <div class="setting-item__content">
      <div :id="titleId" class="setting-item__title font-weight-medium" :class="titleClass">
        <slot v-if="slots.title" name="title" :title-id="titleId" :description-id="descriptionId" />
        <template v-else>
          {{ title }}
        </template>
      </div>
      <div :id="descriptionId" class="setting-item__subtitle">
        <slot v-if="slots.subtitle" name="subtitle" :title-id="titleId" :description-id="descriptionId" />
        <template v-else>
          {{ description }}
        </template>
      </div>
    </div>
    <div class="setting-item__action" :style="longAction ? 'width: 50%' : ''">
      <slot name="action" :title-id="titleId" :description-id="descriptionId" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  title?: string
  description?: string
  titleClass?: string
  longAction?: boolean
}>()

const slots = useSlots()
const titleId = useId()
const descriptionId = useId()
</script>

<style scoped>
.setting-item {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 8px 16px;
}

.setting-item__preaction {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.setting-item__content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.setting-item__title {
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  line-height: 1.5;
}

.setting-item__subtitle {
  font-size: 0.85rem;
  line-height: 1.4;
  opacity: 0.7;
}

.setting-item__action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* Match v2 icon sizing/spacing inside the title.
   Slot content originates from parent components, so :slotted() is required
   to reach the v-icon nodes provided via the #title slot. */
.setting-item__title :slotted(.v-icon) {
  font-size: 16px;
  margin-inline-end: 9px;
}
</style>
