<template>
  <v-card
    v-show="isVisible"
    class="setting-card"
    :elevation="0"
    role="region"
    :aria-label="title || subtitle || undefined"
  >
    <v-card-item v-if="title || subtitle || $slots['header-action']" class="setting-card__header-wrapper">
      <div class="setting-card__header">
        <div class="setting-card__header-text">
          <v-card-title v-if="title" class="pt-2 pb-1 select-none font-weight-bold">
            <v-icon start :color="color || 'primary'" size="small" v-if="icon">{{ icon }}</v-icon>
            {{ title }}
          </v-card-title>
          <v-card-subtitle v-if="subtitle" class="pb-2">
            {{ subtitle }}
          </v-card-subtitle>
        </div>
        <div v-if="$slots['header-action']" class="setting-card__header-action">
          <slot name="header-action" />
        </div>
      </div>
      <v-divider class="setting-card__divider" />
    </v-card-item>
    <v-card-text class="px-4 py-4 setting-card__content">
      <slot />
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
import { kSurfaceTokens } from '@/composables/surfaceTokens'
import { injection } from '@/util/inject'
import { provide, ref, computed, watch, onUnmounted, type Ref, inject } from 'vue'

const props = defineProps<{
  title?: string
  color?: string
  subtitle?: string
  icon?: string
  searchQuery?: string
}>()

const tokens = injection(kSurfaceTokens)

const globalSearchQuery = inject<Ref<string> | null>('settingsSearchQuery', null)
const effectiveSearchQuery = computed(() => props.searchQuery ?? globalSearchQuery?.value ?? '')

const childCount = ref(0)
const matchedCount = ref(0)

const registerChild = (isMatched: boolean) => {
  childCount.value++
  if (isMatched) matchedCount.value++
}

const unregisterChild = (isMatched: boolean) => {
  childCount.value--
  if (isMatched) matchedCount.value--
}

const updateChildMatch = (wasMatched: boolean, isNowMatched: boolean) => {
  if (wasMatched && !isNowMatched) matchedCount.value--
  if (!wasMatched && isNowMatched) matchedCount.value++
}

provide('settingCard', { registerChild, unregisterChild, updateChildMatch })

const isVisible = computed(() => {
  if (!effectiveSearchQuery.value) return true
  const query = effectiveSearchQuery.value.toLowerCase().trim()
  
  if (props.title && props.title.toLowerCase().includes(query)) return true
  if (props.subtitle && props.subtitle.toLowerCase().includes(query)) return true
  
  if (matchedCount.value > 0) return true
  
  if (childCount.value === 0) {
    return false
  }

  return false
})
</script>
<style scoped>
.setting-card {
  background: rgba(var(--v-theme-surface), 0.5) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  margin-bottom: 24px;
}
.setting-card:hover {
  background: rgba(var(--v-theme-surface), 0.7) !important;
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08) !important;
}

.setting-card__header-wrapper {
  padding: 16px 20px 0;
}

.setting-card__header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
}
.setting-card__header-text {
  flex: 1 1 auto;
  min-width: 0;
}
.setting-card__header-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}
.setting-card__divider {
  opacity: 0.1;
}
.setting-card__content {
  padding-top: 8px !important;
}
</style>
