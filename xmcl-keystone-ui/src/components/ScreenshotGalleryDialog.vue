<template>
  <v-dialog
    v-model="isShown"
    max-width="90vw"
    max-height="85vh"
    scrollable
  >
    <v-card class="bg-[#1a1a1a] rounded-xl overflow-hidden" style="max-height: 85vh;">
      <!-- Compact Header Bar -->
      <v-card-title class="py-2 px-4 bg-[#212121] border-b border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <v-icon color="success" size="18">collections</v-icon>
          <span class="text-sm font-medium">{{ t('screenshots.gallery') }}</span>
          <span class="text-gray-500 text-xs">({{ screenshots.length }})</span>
        </div>
        <div class="flex items-center gap-1">
          <v-btn text x-small @click="onOpenFolder">
            <v-icon x-small left>folder_open</v-icon>
            <span class="text-xs">{{ t('screenshots.openFolder') }}</span>
          </v-btn>
          <v-btn icon x-small @click="close">
            <v-icon small>close</v-icon>
          </v-btn>
        </div>
      </v-card-title>

      <!-- Screenshots Grid -->
      <v-card-text class="p-3 overflow-y-auto" style="max-height: calc(85vh - 48px);">
        <div v-if="screenshots.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500">
          <v-icon size="48" class="mb-3 opacity-30">photo_camera</v-icon>
          <p class="text-sm">{{ t('screenshots.empty') }}</p>
          <p class="text-xs text-gray-600">{{ t('screenshots.hint') }}</p>
        </div>
        
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div
            v-for="(url, idx) in screenshots"
            :key="url"
            class="group relative rounded-lg overflow-hidden bg-black cursor-pointer transition-all hover:ring-2 ring-[#4caf50] hover:shadow-xl"
            @click="onViewImage(idx)"
          >
            <div class="aspect-video">
              <img :src="url" class="w-full h-full object-cover" loading="lazy" />
            </div>
            <!-- Hover overlay -->
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <v-icon color="white">fullscreen</v-icon>
            </div>
            <!-- Delete button -->
            <v-btn 
              icon 
              x-small
              color="error"
              class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" 
              @click.stop="onDeleteScreenshot(url)"
            >
              <v-icon x-small>delete</v-icon>
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { kImageDialog } from '@/composables/imageDialog'
import { useInstanceScreenshots } from '@/composables/screenshot'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import { BaseServiceKey, InstanceScreenshotServiceKey } from '@xmcl/runtime-api'

const { t } = useI18n()

const { isShown, parameter } = useDialog<{
  instancePath: string
}>('screenshot-gallery')

const instancePath = computed(() => parameter.value?.instancePath || '')
const { urls: screenshots } = useInstanceScreenshots(instancePath)
const { showItemInDirectory } = useService(BaseServiceKey)
const { deleteScreenshot } = useService(InstanceScreenshotServiceKey)

const imageDialog = injection(kImageDialog)

const onViewImage = (idx: number) => {
  imageDialog.showAll(screenshots.value, idx)
}

const onOpenFolder = () => {
  if (instancePath.value) {
    showItemInDirectory(instancePath.value + '/screenshots')
  }
}

const onDeleteScreenshot = async (url: string) => {
  const success = await deleteScreenshot(url)
  if (success) {
    // Remove from list for immediate UI feedback
    const index = screenshots.value.indexOf(url)
    if (index > -1) {
      screenshots.value.splice(index, 1)
    }
  }
}

const close = () => {
  isShown.value = false
}
</script>

<style scoped>
.aspect-video {
  aspect-ratio: 16 / 9;
}
</style>
