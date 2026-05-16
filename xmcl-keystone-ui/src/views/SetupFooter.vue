<template>
  <div class="setup-footer flex-shrink-0">
    <v-divider />
    <div class="flex flex-1 flex-grow-0 items-center px-6 py-4">
      <v-btn
        v-if="prev"
        data-testid="setup-prev"
        :disabled="disabled"
        :loading="loading"
        @click="emit('prev')"
        size="large"
        variant="tonal"
      >
        {{ t('shared.previous') }}
      </v-btn>
      <div class="flex-grow" />
      <v-btn
        v-if="next"
        data-testid="setup-next"
        color="primary"
        :disabled="disabled"
        :loading="loading"
        @click="emit('next')"
        size="large"
        rounded="xl"
        elevation="2"
      >
        {{ finish ? t('confirm') : t('shared.next') }}
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  disabled?: boolean
  loading: boolean
  finish?: boolean
  prev?: boolean
  next?: boolean
}>()
const emit = defineEmits<{
  (event: 'next'): void
  (event: 'prev'): void
}>()
const { t } = useI18n()
</script>

<style scoped>
.setup-footer {
  background: color-mix(in srgb, rgb(var(--v-theme-surface)) 82%, transparent);
  backdrop-filter: blur(10px);
}

.setup-footer :deep(.v-btn) {
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
}

.setup-footer :deep(.v-btn:hover) {
  transform: translateY(-1px);
  filter: brightness(1.04);
}

.setup-footer :deep(.v-btn:active) {
  transform: translateY(0) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .setup-footer :deep(.v-btn) {
    transition: none;
  }

  .setup-footer :deep(.v-btn:hover),
  .setup-footer :deep(.v-btn:active) {
    transform: none;
  }
}
</style>
