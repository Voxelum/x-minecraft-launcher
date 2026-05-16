<template>
  <v-card
    v-if="display.length > 0 || persistent"
    class="screenshot-card w-full h-full items-center justify-center flex relative overflow-hidden"
    :color="cardColor"
    outlined
    :style="{
      borderColor: refreshing ? 'white' : '',
      'backdrop-filter': `blur(${blurCard}px)`,
    }"
  >
    <!-- Header (absolute overlay, drag handle) -->
    <div
      v-if="persistent"
      class="screenshot-card__header"
    >
      <div class="v-card-title screenshot-card__title cursor-move">
        <v-icon size="18" color="white" class="opacity-80">image</v-icon>
        <span>{{ t('screenshots.gallery') }}</span>
        <v-chip
          v-if="display.length > 0"
          size="x-small"
          variant="tonal"
          color="white"
          class="ml-1"
        >
          {{ display.length }}
        </v-chip>
      </div>
      <div class="flex-grow no-drag" />
      <v-btn
        v-if="display.length > 0"
        v-shared-tooltip="() => randomPlayScreenshot ? t('screenshots.playRandom') : t('screenshots.playSequence')"
        variant="text"
        icon
        size="small"
        color="white"
        class="no-drag"
        @click="randomPlayScreenshot = !randomPlayScreenshot"
      >
        <v-icon>
          {{ randomPlayScreenshot ? 'shuffle' : 'repeat' }}
        </v-icon>
      </v-btn>
    </div>

    <v-carousel
      hide-delimiters
      :height="height"
      show-arrows-on-hover
      :show-arrows="display.length > 1"
      cycle
      interval="5000"
      class="rounded w-full"
    >
      <template #prev="{ props: btnProps }">
        <v-btn
          variant="plain"
          icon="chevron_left"
          color="white"
          @click="btnProps.onClick"
        />
      </template>
      <template #next="{ props: btnProps }">
        <v-btn
          variant="plain"
          icon="chevron_right"
          color="white"
          @click="btnProps.onClick"
        />
      </template>
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
            class="w-full h-full object-cover"
            @dragstart.stop="onDragStart($event, i)"
          />
          <div class="absolute inset-x-0 bottom-2 z-10 flex justify-center">
            <AppImageControls :image="i" />
          </div>
        </v-carousel-item>
      </template>
      <template v-else>
        <v-carousel-item :key="-1">
          <v-sheet
            color="transparent"
            class="screenshot-card__empty flex h-full w-full items-center justify-center"
          >
            <div class="flex flex-col items-center gap-2 text-center px-6">
              <v-icon size="48" class="screenshot-card__empty-icon">photo_camera</v-icon>
              <div class="text-sm font-medium opacity-90">
                {{ t('screenshots.empty') }}
              </div>
              <div class="text-xs opacity-60">
                {{ t('screenshots.hint') }}
              </div>
            </div>
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
import { useInstanceScreenshots } from '@/composables/screenshot'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
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

<style scoped>
.screenshot-card {
  border-radius: 10px;
}

.screenshot-card :deep(.v-window),
.screenshot-card :deep(.v-window__container) {
  height: 100%;
}

.screenshot-card__header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 8px 12px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  pointer-events: none;
}

.screenshot-card__header > * {
  pointer-events: auto;
}

.screenshot-card__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.screenshot-card__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
  height: 100%;
  padding: 32px 24px;
  gap: 8px;
  color: rgba(var(--v-theme-on-surface), 0.85);
}

.screenshot-card__empty-icon {
  opacity: 0.35;
}
</style>
