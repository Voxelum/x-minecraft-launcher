<template>
  <v-dialog
    v-model="isShown"
    content-class="image-dialog relative min-h-100"
  >
    <div
      class="flex items-center justify-center select-none"
    >
      <transition name="image-fade" mode="out-in">
        <img
          :key="image"
          style="max-height: 90vh; min-height: 10rem;"
          contain
          draggable="true"
          :src="image"
          @dragstart="onDragStart($event, image)"
        />
      </transition>
      <div class="absolute bottom-10 flex w-full flex-col items-center justify-center gap-2">
        <div v-if="hasMultipleImages" class="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
          {{ currentIndex }} / {{ totalImages }}
        </div>
        <div v-if="description" class="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
          {{ description }}
        </div>
        <div v-if="date">
          {{ getDateString(date) }}
        </div>
        <AppImageControls :image="image">
          <template #left>
            <v-btn
              v-if="hasMultipleImages"
              icon
              small
              @click.stop="prev"
            >
              <v-icon>chevron_left</v-icon>
            </v-btn>
          </template>
          <v-btn
            icon
            small
            @click="isShown=false"
          >
            <v-icon>close</v-icon>
          </v-btn>

          <template #right>
            <v-btn
              v-if="hasMultipleImages"
              icon
              small
              @click.stop="next"
            >
              <v-icon>chevron_right</v-icon>
            </v-btn>
          </template>
        </AppImageControls>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDateString } from '@/composables/date'
import { kImageDialog } from '@/composables/imageDialog'
import { injection } from '@/util/inject'
import AppImageControls from './AppImageControls.vue'
import { onMounted, onUnmounted } from 'vue'
import { basename } from '@/util/basename'

const { isShown, image, description, date, next, prev, hasMultipleImages, totalImages, currentIndex } = injection(kImageDialog)
const { getDateString } = useDateString()
const { t } = useI18n()

const onKeydown = (event: KeyboardEvent) => {
  if (!isShown.value) return
  
  if (event.key === 'ArrowLeft' && hasMultipleImages.value) {
    event.preventDefault()
    prev()
  } else if (event.key === 'ArrowRight' && hasMultipleImages.value) {
    event.preventDefault()
    next()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    isShown.value = false
  }
}

const onDragStart = async (event: DragEvent, url: string) => {
  const response = await fetch(url)
  const blob = await response.blob()
  const parsedUrl = new URL(url)
  const path = parsedUrl.searchParams.get('path') || ''
  const filename = basename(path) || basename(url, '/') || 'image.png'
  const file = new File([blob], filename, { type: blob.type })
  event.dataTransfer!.items.add(file)
}


onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>
<style>
.image-dialog {
  box-shadow: none;
}

.image-fade-enter-active,
.image-fade-leave-active {
  transition: opacity 0.25s ease;
}

.image-fade-enter-from,
.image-fade-leave-to {
  opacity: 0;
}
</style>
