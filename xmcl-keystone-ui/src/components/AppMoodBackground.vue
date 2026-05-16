<template>
  <div
    class="app-mood-background"
    :class="[`app-mood-background--${variant}`, { 'app-mood-background--static': !animated }]"
  >
    <div class="app-mood-background__content">
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  variant?: 'ambient' | 'pixel' | 'voxel'
  animated?: boolean
}>(), {
  variant: 'ambient',
  animated: true,
})
</script>

<style scoped>
.app-mood-background {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background:
    linear-gradient(145deg, rgba(var(--v-theme-surface), 0.96), rgba(var(--v-theme-surface), 0.86)),
    linear-gradient(115deg, rgba(var(--v-theme-primary), 0.14), transparent 42%, rgba(var(--v-theme-primary), 0.1));
}

.app-mood-background::before,
.app-mood-background::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.app-mood-background__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.app-mood-background--ambient::before {
  background-image:
    linear-gradient(rgba(var(--v-theme-on-surface), 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.045) 1px, transparent 1px);
  background-size: 48px 48px, 48px 48px;
  opacity: 0.42;
  animation: app-mood-texture-drift 24s linear infinite;
}

.app-mood-background--ambient::after {
  background-image: linear-gradient(115deg, transparent 0 34%, rgba(var(--v-theme-primary), 0.12) 48%, transparent 62%);
  background-size: 220% 220%;
  opacity: 0.5;
  animation: app-mood-light-sweep 12s ease-in-out infinite alternate;
}

.app-mood-background--pixel,
.app-mood-background--voxel {
  background:
    linear-gradient(145deg, rgba(var(--v-theme-surface), 0.95), rgba(var(--v-theme-surface), 0.84)),
    linear-gradient(180deg, rgba(76, 137, 176, 0.18) 0%, rgba(71, 132, 80, 0.14) 52%, rgba(111, 82, 54, 0.16) 100%);
}

.app-mood-background--pixel::before,
.app-mood-background--voxel::before {
  background-image:
    linear-gradient(rgba(var(--v-theme-on-surface), 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(86, 145, 74, 0.13) 0 32px, transparent 32px 96px),
    linear-gradient(0deg, transparent 0 32px, rgba(118, 82, 49, 0.12) 32px 64px, transparent 64px 96px);
  background-size: 24px 24px, 24px 24px, 96px 96px, 96px 96px;
  background-position: 0 0, 0 0, 0 0, 48px 48px;
  opacity: 0.48;
  image-rendering: pixelated;
  animation: app-mood-pixel-drift 24s steps(8, end) infinite;
}

.app-mood-background--pixel::after,
.app-mood-background--voxel::after {
  background-image:
    linear-gradient(90deg, transparent 0 24px, rgba(72, 134, 168, 0.1) 24px 48px, transparent 48px 120px),
    linear-gradient(0deg, rgba(92, 143, 76, 0.1) 0 24px, transparent 24px 120px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 0 24px, transparent 24px 120px);
  background-size: 120px 120px, 120px 120px, 120px 120px;
  background-position: 24px 24px, 72px 48px, 0 96px;
  opacity: 0.46;
  image-rendering: pixelated;
  animation: app-mood-pixel-depth 18s steps(6, end) infinite alternate;
}

.app-mood-background--static::before,
.app-mood-background--static::after {
  animation: none;
}

@keyframes app-mood-texture-drift {
  from {
    background-position: 0 0, 0 0;
  }
  to {
    background-position: 48px 48px, -48px 48px;
  }
}

@keyframes app-mood-light-sweep {
  from {
    background-position: 0% 50%;
  }
  to {
    background-position: 100% 50%;
  }
}

@keyframes app-mood-pixel-drift {
  from {
    background-position: 0 0, 0 0, 0 0, 48px 48px;
  }
  to {
    background-position: 24px 24px, -24px 24px, 96px 0, 0 96px;
  }
}

@keyframes app-mood-pixel-depth {
  from {
    background-position: 24px 24px, 72px 48px, 0 96px;
  }
  to {
    background-position: 72px 48px, 24px 72px, 48px 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-mood-background::before,
  .app-mood-background::after {
    animation: none;
  }
}
</style>
