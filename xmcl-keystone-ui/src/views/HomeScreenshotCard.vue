<template>
  <v-card
    class="w-full w-full"
    :color="cardColor"
  >
    <v-carousel
      hide-delimiters
      :height="height"
      show-arrows-on-hover
      cycle
      interval="5000"
      class="rounded h-full"
    >
      <v-carousel-item
        v-for="i of urls"
        :key="i"
        :src="i"
        class="cursor-pointer"
        @click="show(i)"
      >
        <v-sheet
          v-if="i === ''"
          color="transparent"
          class="h-full flex items-center justify-center"
        >
          <v-icon left>
            image
          </v-icon>
          {{ t('screenshots.empty') }}
        </v-sheet>
        <div
          v-else
          class="h-full flex items-end justify-center pb-4 opacity-0 hover:opacity-100 transition-opacity"
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
    </v-carousel>
    <div class="v-card__title min-h-4 w-full absolute z-100 top-0" />
  </v-card>
</template>
<script lang="ts" setup>
import { useRefreshable, useService } from '@/composables'
import { kColorTheme } from '@/composables/colorTheme'
import { kImageDialog } from '@/composables/imageDialog'
import { injection } from '@/util/inject'
import { Instance, InstanceScreenshotServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{ instance: Instance; width: number; height: number }>()

const { cardColor } = injection(kColorTheme)

const { getScreenshots, showScreenshot } = useService(InstanceScreenshotServiceKey)
const { on } = useService(LaunchServiceKey)

const urls = ref([] as string[])
const { refresh, refreshing } = useRefreshable(async () => {
  const result = await getScreenshots(props.instance.path)
  if (result.length === 0) {
    urls.value = ['']
  } else {
    urls.value = result
  }
})

on('minecraft-exit', refresh)

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
