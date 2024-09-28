<template>
  <v-card
    class="w-full"
    :color="cardColor"
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
      class="h-full rounded"
    >
      <template v-if="urls.length > 0">
        <v-carousel-item
          v-for="i of display"
          :key="i"
          :src="i"
          class="cursor-pointer"
          @click="show(i)"
        >
          <div
            class="flex h-full items-end justify-center pb-4 opacity-0 transition-opacity hover:opacity-100"
          >
            <v-btn
              text
              icon
              @click.stop="onOpen(i)"
            >
              <v-icon>
                folder
              </v-icon>
              <!-- {{ t('screenshots.goto') }} -->
            </v-btn>
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
    <div class="v-card__title min-h-4 z-100 absolute top-0 w-full" />
  </v-card>
</template>
<script lang="ts" setup>
import { useRefreshable, useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kImageDialog } from '@/composables/imageDialog'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { Instance, InstanceScreenshotServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{ instance: Instance; width: number; height: number }>()

const { cardColor } = injection(kTheme)

const { getScreenshots, showScreenshot } = useService(InstanceScreenshotServiceKey)
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

const show = (uri: string) => {
  if (!uri) return
  imageDialog.show(uri)
}

onMounted(refresh)

watch(() => props.instance, () => {
  refresh()
})

const onOpen = (uri: string) => {
  showScreenshot(uri)
}

const { t } = useI18n()
</script>
