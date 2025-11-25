<template>
  <v-card
    v-if="display.length > 0 || persistent"
    class="w-full items-center justify-center flex"
    :color="cardColor"
    outlined
    :style="{
      borderColor: refreshing ? 'white' : '',
      'backdrop-filter': `blur(${blurCard}px)`,
    }"
  >
    <v-btn
      v-shared-tooltip="_ => randomPlayScreenshot ? t('screenshots.playRandom') : t('screenshots.playSequence')"
      text
      icon
      class="z-6 absolute bottom-2 right-2"
      @click="randomPlayScreenshot = !randomPlayScreenshot"
    >
      <v-icon>
        {{ randomPlayScreenshot ? 'shuffle' : 'repeat' }}
      </v-icon>
    </v-btn>
    <v-carousel
      hide-delimiters
      :height="height"
      show-arrows-on-hover
      :show-arrows="display.length > 0"
      cycle
      interval="5000"
      class="rounded"
    >
      <template v-if="display.length > 0">
        <v-carousel-item
          v-for="(i, idx) of display"
          :key="i"
          class="cursor-pointer"
          @click="show(i, idx)"
        >
          <img
            :src="i"
            draggable="true"
            @dragstart.stop="onDragStart($event, i)"
            class="w-full h-full object-cover"
          />
          <div
            class="absolute w-full bottom-2 flex justify-center items-center justify-center z-10"
          >
            <div>
              <AppImageControls :image="i" />
            </div>
          </div>
        </v-carousel-item>
      </template>
      <template v-else>
        <v-carousel-item
          :key="-1"
        >
          <v-sheet
            color="transparent"
            class="flex h-full items-center justify-center"
          >
            <v-icon left>
              image
            </v-icon>
            {{ t('screenshots.empty') }}
          </v-sheet>
        </v-carousel-item>
      </template>
    </v-carousel>
  </v-card>
</template>
<script lang="ts" setup>
import AppImageControls from '@/components/AppImageControls.vue'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kImageDialog } from '@/composables/imageDialog'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { useInstanceScreenshots } from '@/composables/screenshot'
import { Instance } from '@xmcl/instance'

const props = defineProps<{
  instance: Instance;
  height: number
  galleries?: {
    title: string
    description?: string
    url: string
    rawUrl?: string
  }[]
  persistent?: boolean
}>()

const { cardColor, blurCard } = injection(kTheme)
const randomPlayScreenshot = useLocalStorageCacheBool('randomPlayScreenshot', false)

const { urls, refreshing } = useInstanceScreenshots(computed(() => props.instance.path))

const display = computed(() => {
  if (urls.value.length > 0) {
    return randomPlayScreenshot.value ? urls.value.toSorted(() => Math.random() - 0.5) : urls.value
  }
  return props.galleries?.map(g => g.url) || []
})

const imageDialog = injection(kImageDialog)

const show = (uri: string, idx: number) => {
  if (urls.value.length > 0) {
    imageDialog.showAll(urls.value, idx)
  } else {
    imageDialog.showAll(props.galleries?.map(g => ({ src: g.rawUrl ?? g.url, description: g.title || g.description })) || [], idx)
  }
}

const onDragStart = async (event: DragEvent, url: string) => {
  const response = await fetch(url)
  const blob = await response.blob()
  const parsedUrl = new URL(url)
  const path = parsedUrl.searchParams.get('path') || ''
  const filename = basename(path) || 'screenshot.png'
  const file = new File([blob], filename, { type: blob.type })
  event.dataTransfer!.items.add(file)
}

const { t } = useI18n()
</script>
