<template>
  <v-card
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
      :show-arrows="urls.length > 0"
      cycle
      interval="5000"
      class="rounded"
    >
      <template v-if="urls.length > 0">
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
    <!-- <div class="v-card__title min-h-4 z-100 absolute top-0 w-full" /> -->
  </v-card>
</template>
<script lang="ts" setup>
import AppImageControls from '@/components/AppImageControls.vue'
import { useRefreshable, useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kImageDialog } from '@/composables/imageDialog'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { Instance } from '@xmcl/instance'
import { InstanceScreenshotServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{ instance: Instance; height: number }>()

const { cardColor, blurCard } = injection(kTheme)

const { getScreenshots } = useService(InstanceScreenshotServiceKey)
const { on } = useService(LaunchServiceKey)
const randomPlayScreenshot = useLocalStorageCacheBool('randomPlayScreenshot', false)

const urls = shallowRef([] as string[])
const shuffled = computed(() => urls.value.toSorted(() => Math.random() - 0.5))
const display = computed(() => (randomPlayScreenshot.value ? shuffled.value : urls.value))
const { refresh, refreshing } = useRefreshable(async () => {
  const result = await getScreenshots(props.instance.path)
  if (result.length === 0) {
    urls.value = []
  } else {
    urls.value = result
  }
})

on('minecraft-exit', () => refresh())

const imageDialog = injection(kImageDialog)

const show = (uri: string, idx: number) => {
  imageDialog.showAll(urls.value, idx)
}

onMounted(refresh)

watch(() => props.instance, () => {
  refresh()
})

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
