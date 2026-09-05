<template>
  <div
    ref="root"
    class="inline-flex items-center w-full gap-2 pl-1 h-7 cursor-pointer select-none rounded border-t-2 border-transparent transition-all"
    :class="{
      'opacity-40 scale-[0.98]': isDragging,
      '!border-primary bg-surface-variant/20': isDraggedOver && !isDragging,
    }"
    role="button"
    :aria-label="text || icon"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @click="emit('setting')"
    @keydown.enter.prevent="emit('setting')"
    @keydown.space.prevent="emit('setting')"
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
    <v-btn
      :loading="loading"
      class="controls"
      v-if="!dragover"
      :color="isHovered ? 'primary' : 'default'"
      @click.stop="emit('install')"
      size="small"
      variant="text"
      draggable="false"
      @dragstart.stop.prevent
    >
      <span class="transition-all transition-duration-300" :style="{ opacity: isHovered ? 1 : 0 }">
        {{ buttonText || t('shared.install') }}
      </span>
      <v-icon :color="isHovered ? 'primary' : 'default'" class="material-symbols-outlined" end>
        {{ buttonIcon || 'file_download' }}
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

const props = defineProps<{
  id?: string
  draggable?: boolean
  icon: string
  tooltip?: string
  text?: string
  highlighted?: boolean
  loading?: boolean
  buttonText?: string
  buttonIcon?: string
}>()

const { isDark } = injection(kTheme)
const root = ref<HTMLElement | null>(null)
const isHovered = useElementHover(root, { 
  delayLeave: 150
})
const isDragging = ref(false)
const isDraggedOver = ref(false)
const emit = defineEmits<{
  (e: 'setting'): void
  (e: 'install'): void
  (e: 'drop', event: DragEvent): void
  (e: 'reorder', fromId: string): void
}>()
const { dragover } = injection(kDropHandler)

function onDragStart(e: DragEvent) {
  if (!props.draggable || !props.id) return
  isDragging.value = true
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('application/x-card-id', props.id)
  e.dataTransfer!.setData('text/plain', props.id)
}

function onDragEnd() {
  isDragging.value = false
  isDraggedOver.value = false
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  isDraggedOver.value = true
}

function onDragLeave(e: DragEvent) {
  if (root.value && e.relatedTarget && root.value.contains(e.relatedTarget as Node)) {
    return
  }
  isDraggedOver.value = false
}

function onDrop(e: DragEvent) {
  isDraggedOver.value = false
  isDragging.value = false
  const cardId = e.dataTransfer?.getData('application/x-card-id')
  if (cardId) {
    e.preventDefault()
    e.stopPropagation()
    emit('reorder', cardId)
    return
  }
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