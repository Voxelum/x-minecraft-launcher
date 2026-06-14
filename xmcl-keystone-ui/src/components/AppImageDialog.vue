<template>
  <v-dialog v-model="isShown" content-class="image-dialog relative min-h-100">
    <div class="flex items-center justify-center select-none">
      <transition name="image-fade" mode="out-in">
        <img
          :key="image"
          style="max-height: 90vh; min-height: 10rem"
          contain
          draggable="true"
          :src="image"
          @dragstart="onDragStart($event, image)"
        />
      </transition>
      <div class="absolute bottom-10 flex w-full flex-col items-center justify-center gap-2">
        <div
          v-if="hasMultipleImages"
          class="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded"
        >
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
            <v-btn v-if="hasMultipleImages" icon @click.stop="prev" size="small">
              <v-icon>{{ prevIcon }}</v-icon>
            </v-btn>
          </template>
          <v-btn
            v-if="hasTheme"
            v-shared-tooltip="() => setBackgroundTooltip"
            icon
            :loading="settingBackground"
            :disabled="!image"
            @click.stop="setAsBackground"
            size="small"
          >
            <v-icon>wallpaper</v-icon>
          </v-btn>
          <v-btn icon @click="isShown = false" size="small">
            <v-icon>close</v-icon>
          </v-btn>

          <template #right>
            <v-btn v-if="hasMultipleImages" icon @click.stop="next" size="small">
              <v-icon>{{ nextIcon }}</v-icon>
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
import { kInstance } from '@/composables/instance'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { useNotifier } from '@/composables/notifier'
import { useService } from '@/composables/service'
import { BackgroundType, kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceThemeServiceKey, ThemeServiceKey } from '@xmcl/runtime-api'
import AppImageControls from './AppImageControls.vue'
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { useRtl } from 'vuetify'
import { basename } from '@/util/basename'

const {
  isShown,
  image,
  description,
  date,
  next,
  prev,
  hasMultipleImages,
  totalImages,
  currentIndex,
} = injection(kImageDialog)
const { getDateString } = useDateString()
const { t } = useI18n()
const { notify } = useNotifier()
const { isRtl } = useRtl()

// Mirror prev/next chevrons and arrow-key mapping so the visual layout
// stays consistent with the reading direction.
const prevIcon = computed(() => (isRtl.value ? 'chevron_right' : 'chevron_left'))
const nextIcon = computed(() => (isRtl.value ? 'chevron_left' : 'chevron_right'))

// kTheme + kInstanceTheme + kInstance are only present in the main window.
// The image dialog is only mounted there today, but we use `inject` (not
// `injection`) so the dialog degrades gracefully (just hides the button)
// if it's ever embedded in a window without theme context.
const themeCtx = inject(kTheme, undefined)
const instanceThemeCtx = inject(kInstanceTheme, undefined)
const instanceCtx = inject(kInstance, undefined)

// Pre-acquire services at setup time (useService -> inject is setup-only).
const themeService = themeCtx ? useService(ThemeServiceKey) : undefined
const instanceThemeService = themeCtx ? useService(InstanceThemeServiceKey) : undefined

const hasTheme = computed(() => !!themeCtx)
const hasInstanceTheme = computed(() => !!instanceThemeCtx?.instanceTheme.value)

const settingBackground = ref(false)

const setBackgroundTooltip = computed(() =>
  hasInstanceTheme.value
    ? t('setting.setAsBackground.instance')
    : t('setting.setAsBackground.global'),
)

async function setAsBackground() {
  if (!themeCtx || !themeService || !image.value || settingBackground.value) return
  settingBackground.value = true
  try {
    const url = image.value
    // Routing logic:
    //  - If the user is currently focused on an instance that already has
    //    its own theme, target the instance theme (the override that
    //    kTheme renders takes precedence anyway).
    //  - Otherwise target the global theme.
    const targetInstancePath =
      hasInstanceTheme.value && instanceCtx?.path.value ? instanceCtx.path.value : undefined

    const isInstance = !!targetInstancePath
    const targetTheme = isInstance
      ? instanceThemeCtx!.instanceTheme.value!
      : themeCtx.currentTheme.value
    const isDark = themeCtx.isDark.value
    const imageKey: 'backgroundImageDark' | 'backgroundImage' = isDark
      ? 'backgroundImageDark'
      : 'backgroundImage'

    // Local launcher media URLs (e.g. instance screenshots, market gallery
    // already cached locally) carry the underlying file path -- copy via
    // addMedia so the theme owns its own media file. Remote URLs go through
    // a content-type sniff and direct URL ref, like the existing settings.
    let media
    if (url.startsWith('http://launcher/')) {
      const parsedUrl = new URL(url)
      const path = parsedUrl.searchParams.get('path')
      if (path) {
        media = isInstance
          ? await instanceThemeService!.addMedia(targetInstancePath!, path)
          : await themeService.addMedia(path)
      } else {
        media = { url, type: 'image' as const, mimeType: 'image/png' }
      }
    } else {
      // For remote URLs, just point at them directly (matches the URL
      // selection UI in AppearanceItems / SettingGlobalUI).
      media = { url, type: 'image' as const, mimeType: 'image/png' }
    }
    if (media.type !== 'image') return

    // Free the previously-stored local file (best-effort).
    const old = targetTheme[imageKey]
    if (old && old.url.startsWith('http://launcher/') && old.url !== media.url) {
      const cleanup = isInstance
        ? instanceThemeService!.removeMedia(targetInstancePath!, old.url)
        : themeService.removeMedia(old.url)
      cleanup.catch(() => {})
    }

    targetTheme[imageKey] = media
    if ((targetTheme.backgroundType ?? BackgroundType.NONE) !== BackgroundType.IMAGE) {
      targetTheme.backgroundType = BackgroundType.IMAGE
    }

    if (isInstance) {
      await instanceThemeCtx!.saveTheme()
    } else {
      await themeCtx.saveCurrentTheme()
    }

    notify({
      level: 'success',
      title: isInstance
        ? t('setting.setAsBackground.successInstance')
        : t('setting.setAsBackground.successGlobal'),
    })
  } catch (e) {
    console.error(e)
    notify({ level: 'error', title: t('setting.setAsBackground.failed') })
  } finally {
    settingBackground.value = false
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (!isShown.value) return

  if (event.key === 'ArrowLeft' && hasMultipleImages.value) {
    event.preventDefault()
    if (isRtl.value) next(); else prev()
  } else if (event.key === 'ArrowRight' && hasMultipleImages.value) {
    event.preventDefault()
    if (isRtl.value) prev(); else next()
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
