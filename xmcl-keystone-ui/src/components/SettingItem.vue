<template>
  <div class="setting-item select-none" :class="{ 'has-search-match': isMatched, 'is-hidden': !isVisible }">
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
import { useId, computed, useSlots, inject, type Ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  title?: string
  description?: string
  titleClass?: string
  longAction?: boolean
  searchQuery?: string
  searchKeywords?: string[]
}>()

const slots = useSlots()
const titleId = useId()
const descriptionId = useId()

const globalSearchQuery = inject<Ref<string> | null>('settingsSearchQuery', null)
const effectiveSearchQuery = computed(() => props.searchQuery ?? globalSearchQuery?.value ?? '')

const isMatched = computed(() => {
  if (!effectiveSearchQuery.value) return false
  const query = effectiveSearchQuery.value.toLowerCase().trim()
  if (props.title && props.title.toLowerCase().includes(query)) return true
  if (props.description && props.description.toLowerCase().includes(query)) return true
  if (props.searchKeywords && props.searchKeywords.some(k => k.toLowerCase().includes(query))) return true
  return false
})

const isVisible = computed(() => {
  if (!effectiveSearchQuery.value) return true
  return isMatched.value
})

interface SettingCardContext {
  registerChild: (isMatched: boolean) => void
  unregisterChild: (isMatched: boolean) => void
  updateChildMatch: (wasMatched: boolean, isNowMatched: boolean) => void
}

const card = inject<SettingCardContext | null>('settingCard', null)
if (card) {
  onMounted(() => {
    card.registerChild(isMatched.value)
  })
  onUnmounted(() => {
    card.unregisterChild(isMatched.value)
  })
  watch(isMatched, (newVal, oldVal) => {
    card.updateChildMatch(oldVal, newVal)
  })
}
</script>

<style scoped>
.setting-item {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 12px 16px;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin: 4px 0;
  border-left: 3px solid transparent;
}

.setting-item.is-hidden {
  display: none !important;
}

.setting-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.setting-item.has-search-match {
  background: rgba(var(--v-theme-primary), 0.08);
  border-left: 3px solid rgba(var(--v-theme-primary), 1);
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
  font-size: 1rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.95);
}

.setting-item__subtitle {
  font-size: 0.85rem;
  line-height: 1.4;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
}

.setting-item__action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

.setting-item__title :slotted(.v-icon) {
  font-size: 18px;
  margin-inline-end: 12px;
  opacity: 0.8;
}
</style>
