<template>
  <v-dialog
    v-model="isShown"
    fullscreen
    transition="fade-transition"
    content-class="screenshot-lightbox"
  >
    <div
      v-if="currentItem"
      class="screenshot-lightbox__root relative w-full h-full flex flex-col select-none overflow-hidden"
      tabindex="0"
      @keydown.left.stop.prevent="prev"
      @keydown.right.stop.prevent="next"
      @keydown.esc.stop.prevent="close"
    >
      <!-- Top header bar -->
      <div class="screenshot-lightbox__topbar flex items-center justify-between px-6 py-3 z-20">
        <div class="flex items-center gap-3 min-w-0">
          <v-chip size="small" variant="tonal" color="white" class="font-mono">
            {{ currentIndex + 1 }} / {{ items.length }}
          </v-chip>
          <span class="text-sm font-semibold text-white/90 truncate max-w-sm">
            {{ currentItem.name }}
          </span>
          <v-chip v-if="dimensionsText" size="x-small" variant="outlined" color="white" class="opacity-70 font-mono">
            {{ dimensionsText }}
          </v-chip>
          <v-chip size="x-small" variant="outlined" color="white" class="opacity-70 font-mono">
            {{ getExpectedSize(currentItem.size) }}
          </v-chip>
          <span class="text-xs text-white/50 hidden sm:inline">
            {{ getDateString(currentItem.createdAt) }}
          </span>
        </div>

        <!-- Zoom & window controls -->
        <div class="flex items-center gap-1">
          <v-btn
            icon="zoom_in"
            variant="text"
            size="small"
            color="white"
            :disabled="zoomLevel >= 3"
            @click="zoomIn"
          />
          <v-btn
            icon="zoom_out"
            variant="text"
            size="small"
            color="white"
            :disabled="zoomLevel <= 0.5"
            @click="zoomOut"
          />
          <v-btn
            icon="restart_alt"
            variant="text"
            size="small"
            color="white"
            :disabled="zoomLevel === 1"
            @click="resetZoom"
          />
          <v-divider vertical class="mx-2 my-1" />
          <v-btn
            icon="close"
            variant="text"
            size="small"
            color="white"
            @click="close"
          />
        </div>
      </div>

      <!-- Image display area -->
      <div
        class="screenshot-lightbox__canvas relative flex-1 flex items-center justify-center overflow-hidden cursor-grab"
        :class="{ 'cursor-grabbing': isPanning }"
        @mousedown="startPan"
        @mousemove="onPan"
        @mouseup="endPan"
        @mouseleave="endPan"
        @wheel.prevent="onWheel"
      >
        <transition name="fade-transition">
          <img
            :key="currentItem.url"
            ref="imageEl"
            :src="currentItem.url"
            class="max-h-[82vh] max-w-[90vw] object-contain pointer-events-none select-none rounded shadow-2xl will-change-transform"
            :style="{
              transform: `scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`,
            }"
            @load="onImageLoad"
          />
        </transition>

        <!-- Prev button -->
        <v-btn
          v-if="items.length > 1"
          icon="chevron_left"
          variant="tonal"
          color="white"
          size="large"
          class="screenshot-lightbox__nav screenshot-lightbox__nav--left absolute left-4 z-10"
          @click.stop="prev"
        />

        <!-- Next button -->
        <v-btn
          v-if="items.length > 1"
          icon="chevron_right"
          variant="tonal"
          color="white"
          size="large"
          class="screenshot-lightbox__nav screenshot-lightbox__nav--right absolute right-4 z-10"
          @click.stop="next"
        />
      </div>

      <!-- Bottom action toolbar -->
      <div class="screenshot-lightbox__bottombar flex items-center justify-center px-4 py-3 z-20">
        <div class="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl">
          <v-btn
            v-if="!isGif(currentItem)"
            variant="text"
            size="small"
            color="white"
            prepend-icon="brush"
            @click="onEdit"
          >
            {{ t('screenshots.edit') }}
          </v-btn>

          <v-btn
            variant="text"
            size="small"
            color="white"
            prepend-icon="content_copy"
            @click="onCopy"
          >
            <template v-if="copied">
              <v-icon color="green" start>check</v-icon>
              {{ t('screenshots.copied') }}
            </template>
            <template v-else>
              {{ t('screenshots.copy') }}
            </template>
          </v-btn>

          <v-divider vertical class="mx-1 my-1" />

          <v-btn
            variant="text"
            size="small"
            color="white"
            prepend-icon="wallpaper"
            @click="onSetWallpaper"
          >
            {{ t('screenshots.setWallpaper') }}
          </v-btn>

          <v-divider vertical class="mx-1 my-1" />

          <v-btn
            variant="text"
            size="small"
            color="white"
            prepend-icon="folder_open"
            @click="onShowInFolder"
          >
            {{ t('screenshots.openFolder') }}
          </v-btn>

          <v-btn
            variant="text"
            size="small"
            color="white"
            prepend-icon="save_alt"
            @click="onExport"
          >
            {{ t('screenshots.export') }}
          </v-btn>

          <v-btn
            variant="text"
            size="small"
            color="red"
            prepend-icon="delete"
            @click="onDelete"
          >
            {{ t('shared.delete') }}
          </v-btn>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ScreenshotItem } from '@xmcl/runtime-api'
import { getExpectedSize } from '@/util/size'
import { useDateString } from '@/composables/date'
import { computed, ref, watch, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: boolean
  items: ScreenshotItem[]
  initialIndex: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit', item: ScreenshotItem): void
  (e: 'copy', item: ScreenshotItem): void
  (e: 'set-wallpaper', item: ScreenshotItem): void
  (e: 'show-in-folder', item: ScreenshotItem): void
  (e: 'export', item: ScreenshotItem): void
  (e: 'delete', item: ScreenshotItem): void
}>()

const { t } = useI18n()
const { getDateString } = useDateString()

const isShown = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const currentIndex = ref(props.initialIndex || 0)
watch(() => props.initialIndex, (idx) => {
  currentIndex.value = Math.max(0, Math.min(idx, props.items.length - 1))
})

const currentItem = computed(() => props.items[currentIndex.value] || null)

function preloadAdjacentImages() {
  const prev = props.items[currentIndex.value - 1]
  const next = props.items[currentIndex.value + 1]
  if (prev?.url) {
    const img = new Image()
    img.src = prev.url
  }
  if (next?.url) {
    const img = new Image()
    img.src = next.url
  }
}
watch(currentIndex, preloadAdjacentImages, { immediate: true })

// Zoom and Pan
const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
let startMouseX = 0
let startMouseY = 0

function zoomIn() {
  zoomLevel.value = Math.min(zoomLevel.value + 0.25, 3)
}
function zoomOut() {
  zoomLevel.value = Math.max(zoomLevel.value - 0.25, 0.5)
  if (zoomLevel.value <= 1) {
    panX.value = 0
    panY.value = 0
  }
}
function resetZoom() {
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

function onWheel(e: WheelEvent) {
  if (e.deltaY < 0) zoomIn()
  else zoomOut()
}

function startPan(e: MouseEvent) {
  if (zoomLevel.value > 1) {
    isPanning.value = true
    startMouseX = e.clientX - panX.value
    startMouseY = e.clientY - panY.value
  }
}
let lightboxPanRafId: number | null = null
let pendingLightboxPanX = 0
let pendingLightboxPanY = 0

function onPan(e: MouseEvent) {
  if (isPanning.value) {
    pendingLightboxPanX = e.clientX - startMouseX
    pendingLightboxPanY = e.clientY - startMouseY
    if (lightboxPanRafId === null) {
      lightboxPanRafId = requestAnimationFrame(() => {
        lightboxPanRafId = null
        panX.value = pendingLightboxPanX
        panY.value = pendingLightboxPanY
      })
    }
  }
}
function endPan() {
  isPanning.value = false
  if (lightboxPanRafId !== null) {
    cancelAnimationFrame(lightboxPanRafId)
    lightboxPanRafId = null
  }
}

// Navigation
function next() {
  if (props.items.length <= 1) return
  currentIndex.value = (currentIndex.value + 1) % props.items.length
  resetZoom()
}
function prev() {
  if (props.items.length <= 1) return
  currentIndex.value = (currentIndex.value - 1 + props.items.length) % props.items.length
  resetZoom()
}
function close() {
  isShown.value = false
  resetZoom()
}

// Image dimensions
const imageEl = ref<HTMLImageElement | null>(null)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
function onImageLoad(e: Event) {
  const target = e.target as HTMLImageElement
  if (target) {
    naturalWidth.value = target.naturalWidth
    naturalHeight.value = target.naturalHeight
  }
}
const dimensionsText = computed(() => {
  if (naturalWidth.value && naturalHeight.value) {
    return `${naturalWidth.value} × ${naturalHeight.value}`
  }
  return ''
})

// Actions
const copied = ref(false)
function isGif(item?: ScreenshotItem | null): boolean {
  if (!item) return false
  const target = item.name || item.path || item.url || ''
  return /\.gif(\?.*)?$/i.test(target)
}

function onEdit() {
  if (currentItem.value && !isGif(currentItem.value)) {
    emit('edit', currentItem.value)
  }
}

function onCopy() {
  if (!currentItem.value) return
  emit('copy', currentItem.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function onSetWallpaper() {
  if (currentItem.value) emit('set-wallpaper', currentItem.value)
}

function onShowInFolder() {
  if (currentItem.value) emit('show-in-folder', currentItem.value)
}

function onExport() {
  if (currentItem.value) emit('export', currentItem.value)
}

function onDelete() {
  if (currentItem.value) emit('delete', currentItem.value)
}

onUnmounted(() => {
  if (lightboxPanRafId !== null) {
    cancelAnimationFrame(lightboxPanRafId)
    lightboxPanRafId = null
  }
})
</script>

<style scoped>
.screenshot-lightbox__root {
  background: rgba(10, 10, 12, 0.95);
  backdrop-filter: blur(24px);
}

.screenshot-lightbox__topbar {
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent);
}

.screenshot-lightbox__bottombar {
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
}

.screenshot-lightbox__nav {
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(8px);
}
.screenshot-lightbox__nav:hover {
  background: rgba(255, 255, 255, 0.25) !important;
}
</style>
