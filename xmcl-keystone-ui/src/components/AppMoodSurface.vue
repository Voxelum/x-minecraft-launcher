<template>
  <v-sheet
    class="app-mood-surface"
    :class="{
      'app-mood-surface--fill': fill,
      'app-mood-surface--flash': flash,
    }"
    :rounded="rounded"
    :border="border"
  >
    <slot />
  </v-sheet>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  rounded?: string | boolean
  border?: string | boolean
  fill?: boolean
  flash?: boolean
}>(), {
  rounded: 'xl',
  border: true,
  fill: false,
  flash: true,
})
</script>

<style scoped>
.app-mood-surface {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: color-mix(in srgb, rgb(var(--v-theme-surface)) 88%, transparent);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: app-mood-surface-rise 0.38s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.app-mood-surface--fill {
  min-height: calc(100% - 4px);
}

.app-mood-surface--flash::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(115deg, transparent 0 42%, rgba(255, 255, 255, 0.08) 50%, transparent 58%);
  transform: translateX(-120%);
  animation: app-mood-surface-sheen 7s ease-in-out infinite;
}

.app-mood-surface :deep(> *) {
  position: relative;
  z-index: 1;
}

@keyframes app-mood-surface-rise {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.992);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes app-mood-surface-sheen {
  0%, 60% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-mood-surface,
  .app-mood-surface--flash::before {
    animation: none;
  }
}
</style>
