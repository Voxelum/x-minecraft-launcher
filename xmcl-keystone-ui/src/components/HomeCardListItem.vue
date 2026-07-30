<template>
  <div
    ref="root"
    class="inline-flex items-center w-full gap-2 pl-1 h-7 cursor-pointer"
    role="button"
    :aria-label="text || icon"
    @click="emit('setting')"
    @keydown.enter.prevent="emit('setting')"
    @keydown.space.prevent="emit('setting')"
    @dragover="onDragOver"
    @dragleave="isDraggedOver = false;"
    @drop="onDrop"
  >
    <div class="inline-flex items-center whitespace-nowrap overflow-hidden text-ellipsis">
      <v-icon v-shared-tooltip="() => tooltip || ''" size="small" start> {{ icon }} </v-icon>
      <span
        class="home-card-item__text transition-colors"
        :style="{
          color: isDraggedOver || highlighted
            ? 'var(--highlight-color)'
            : isHovered
              ? (isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.87)')
              : (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'),
          fontWeight: isDraggedOver || highlighted ? 'bold' : 'normal',
        }"
      >
        {{ text }}
      </span>
    </div>
    <div class="flex-grow" />
    <v-btn :loading="loading" class="controls" v-if="!dragover" :color="isHovered ? 'primary' : 'default'" @click.stop="emit('install')" size="small" variant="text">
      <span class="transition-all transition-duration-300" :style="{ opacity: isHovered ? 1 : 0 }">
        {{ t('shared.install') }}
      </span>
      <v-icon :color="isHovered ? 'primary' : 'default'" class="material-symbols-outlined" end>
        file_download
      </v-icon>
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { kDropHandler } from '@/composables/dropHandler';
import { kTheme } from '@/composables/theme';
import { vSharedTooltip } from '@/directives/sharedTooltip';
import { injection } from '@/util/inject';
import { useElementHover } from '@vueuse/core';

defineProps<{
  icon: string
  tooltip?: string
  text?: string
  highlighted?: boolean
  loading?: boolean
}>()

const { isDark } = injection(kTheme)
const root = ref<HTMLElement | null>(null)
const isHovered = useElementHover(root, { 
  delayLeave: 150
})
const isDraggedOver = ref(false)
const emit = defineEmits<{
  (e: 'setting'): void
  (e: 'install'): void
  (e: 'drop', event: DragEvent): void
}>()
const { dragover } = injection(kDropHandler)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDraggedOver.value = true
}

function onDrop(e: DragEvent) {
  isDraggedOver.value = false
  emit('drop', e)
}

const { t } = useI18n()
</script>

<style scoped>
.dark .controls .v-icon {
  color: var(--icon-color);
}

.dark .controls .v-icon:hover {
  color: var(--icon-color-hovered);
}

.highlighted {
  background: rgba(59, 130, 246, 0.1);
}
</style>