<template>
  <v-card
    class="surface-card-subsection"
    :elevation="tokens.cardSubsectionElevation.value"
    role="region"
    :aria-label="title || subtitle || undefined"
  >
    <v-card-item v-if="title || subtitle || $slots['header-action']">
      <div class="setting-card__header">
        <div class="setting-card__header-text">
          <v-card-title v-if="title" class="pt-4 select-none">
            <v-icon start :color="color || 'primary'" size="small" v-if="icon">{{ icon }}</v-icon>
            {{ title }}
          </v-card-title>
          <v-card-subtitle v-if="subtitle" class="pb-0">
            {{ subtitle }}
          </v-card-subtitle>
        </div>
        <div v-if="$slots['header-action']" class="setting-card__header-action">
          <slot name="header-action" />
        </div>
      </div>
    </v-card-item>
    <v-card-text class="px-4 py-4">
      <slot />
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
import { kSurfaceTokens } from '@/composables/surfaceTokens'
import { injection } from '@/util/inject'

defineProps<{
  title?: string
  color?: string
  subtitle?: string
  icon?: string
}>()

const tokens = injection(kSurfaceTokens)
</script>
<style scoped>
.setting-card__header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
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
  padding-top: 12px;
}
</style>
