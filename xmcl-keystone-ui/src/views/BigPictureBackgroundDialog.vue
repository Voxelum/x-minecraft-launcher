<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bp-subpage-card !m-0 !p-6 max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">wallpaper</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('bigPicture.backgroundDialogTitle') }}</h2>
            <div class="text-xs text-white/60">
              {{ instanceName || t('instance.name') }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <v-btn
            variant="text"
            color="warning"
            size="small"
            class="rounded-xl font-bold"
            data-gamepad-focusable
            @click="resetDefault"
          >
            <v-icon start size="16">restore</v-icon>
            {{ t('bigPicture.resetDefaultBg') }}
          </v-btn>

          <v-btn
            icon="close"
            variant="text"
            size="small"
            data-gamepad-focusable
            @click="$emit('update:modelValue', false)"
          />
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto py-4 custom-scrollbar flex flex-col gap-4">
        <!-- Mode: Auto -->
        <div
          class="surface-panel p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between"
          :class="config.mode === 'auto' ? 'bg-primary/15 border-primary/50' : 'bg-white/5 border-white/10 hover:bg-white/10'"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          @click="setMode('auto')"
          @keydown.enter="setMode('auto')"
          @keydown.space.prevent="setMode('auto')"
        >
          <div class="flex items-center gap-3">
            <v-icon :color="config.mode === 'auto' ? 'primary' : 'white'" size="24">auto_awesome</v-icon>
            <div>
              <div class="text-sm font-bold text-white">{{ t('bigPicture.bgModeAuto') }}</div>
              <div class="text-xs text-white/60">{{ t('bigPicture.bgModeThemeSubtitle') }} / {{ t('bigPicture.bgModeScreenshots') }}</div>
            </div>
          </div>
          <v-icon v-if="config.mode === 'auto'" color="primary" size="22">check_circle</v-icon>
        </div>

        <!-- Mode: Instance Theme Background -->
        <div
          class="surface-panel p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between"
          :class="config.mode === 'theme' ? 'bg-primary/15 border-primary/50' : 'bg-white/5 border-white/10 hover:bg-white/10'"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          @click="setMode('theme')"
          @keydown.enter="setMode('theme')"
          @keydown.space.prevent="setMode('theme')"
        >
          <div class="flex items-center gap-3">
            <v-icon :color="config.mode === 'theme' ? 'primary' : 'white'" size="24">palette</v-icon>
            <div>
              <div class="text-sm font-bold text-white">{{ t('bigPicture.bgModeTheme') }}</div>
              <div class="text-xs text-white/60">
                <span v-if="themeBgUrl">{{ t('bigPicture.bgModeThemeSubtitle') }}</span>
                <span v-else class="text-yellow-400/80">{{ t('bigPicture.noThemeBgAvailable') }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <img
              v-if="themeBgUrl"
              :src="themeBgUrl"
              class="w-16 h-10 rounded-lg object-cover border border-white/20"
              alt="Theme BG"
            >
            <v-icon v-if="config.mode === 'theme'" color="primary" size="22">check_circle</v-icon>
          </div>
        </div>

        <!-- Mode: In-game Screenshots -->
        <div
          class="surface-panel p-4 rounded-xl border transition-all flex flex-col gap-3"
          :class="config.mode === 'screenshots' ? 'bg-primary/15 border-primary/50' : 'bg-white/5 border-white/10'"
        >
          <div
            class="flex items-center justify-between cursor-pointer"
            role="button"
            tabindex="0"
            data-gamepad-focusable
            @click="setMode('screenshots')"
            @keydown.enter="setMode('screenshots')"
            @keydown.space.prevent="setMode('screenshots')"
          >
            <div class="flex items-center gap-3">
              <v-icon :color="config.mode === 'screenshots' ? 'primary' : 'white'" size="24">photo_library</v-icon>
              <div>
                <div class="text-sm font-bold text-white">{{ t('bigPicture.bgModeScreenshots') }}</div>
                <div class="text-xs text-white/60">{{ t('bigPicture.bgModeScreenshotsSubtitle') }} ({{ screenshotUrls.length }})</div>
              </div>
            </div>
            <v-icon v-if="config.mode === 'screenshots'" color="primary" size="22">check_circle</v-icon>
          </div>

          <!-- Screenshots selector if screenshots exist -->
          <div v-if="screenshotUrls.length > 0" class="pt-2 border-t border-white/10 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs text-white/70">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors"
                :class="!config.selectedScreenshot ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/20 hover:bg-white/10'"
                data-gamepad-focusable
                @click="selectSlideshow"
              >
                <v-icon size="16">slideshow</v-icon>
                <span>{{ t('bigPicture.slideshowAll') }}</span>
              </button>
              <span>{{ screenshotUrls.length }} {{ t('screenshots.gallery') }}</span>
            </div>

            <div class="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
              <div
                v-for="(url, idx) in screenshotUrls"
                :key="url"
                class="relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-transform hover:scale-105"
                :class="config.selectedScreenshot === url ? 'border-primary shadow-lg ring-2 ring-primary/50' : 'border-white/10 hover:border-white/40'"
                role="button"
                tabindex="0"
                data-gamepad-focusable
                :aria-label="'Screenshot ' + (idx + 1)"
                @click="selectSingleScreenshot(url)"
                @keydown.enter="selectSingleScreenshot(url)"
                @keydown.space.prevent="selectSingleScreenshot(url)"
              >
                <img
                  :src="url"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  alt="Screenshot"
                >
                <div
                  v-if="config.selectedScreenshot === url"
                  class="absolute inset-0 bg-primary/20 flex items-center justify-center"
                >
                  <v-icon color="white" size="20">check</v-icon>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-white/40 italic py-1">
            {{ t('bigPicture.noScreenshotsAvailable') }}
          </div>
        </div>

        <!-- Mode: Instance Icon -->
        <div
          class="surface-panel p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between"
          :class="config.mode === 'icon' ? 'bg-primary/15 border-primary/50' : 'bg-white/5 border-white/10 hover:bg-white/10'"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          @click="setMode('icon')"
          @keydown.enter="setMode('icon')"
          @keydown.space.prevent="setMode('icon')"
        >
          <div class="flex items-center gap-3">
            <v-icon :color="config.mode === 'icon' ? 'primary' : 'white'" size="24">image</v-icon>
            <div>
              <div class="text-sm font-bold text-white">{{ t('bigPicture.bgModeIcon') }}</div>
              <div class="text-xs text-white/60">{{ t('bigPicture.bgModeIconSubtitle') }}</div>
            </div>
          </div>
          <v-icon v-if="config.mode === 'icon'" color="primary" size="22">check_circle</v-icon>
        </div>

        <!-- Mode: Custom Image from PC -->
        <div
          class="surface-panel p-4 rounded-xl border transition-all flex flex-col gap-3"
          :class="config.mode === 'custom' ? 'bg-primary/15 border-primary/50' : 'bg-white/5 border-white/10'"
        >
          <div
            class="flex items-center justify-between cursor-pointer"
            role="button"
            tabindex="0"
            data-gamepad-focusable
            @click="setMode('custom')"
            @keydown.enter="setMode('custom')"
            @keydown.space.prevent="setMode('custom')"
          >
            <div class="flex items-center gap-3">
              <v-icon :color="config.mode === 'custom' ? 'primary' : 'white'" size="24">add_photo_alternate</v-icon>
              <div>
                <div class="text-sm font-bold text-white">{{ t('bigPicture.bgModeCustom') }}</div>
                <div class="text-xs text-white/60">{{ t('bigPicture.bgModeCustomSubtitle') }}</div>
              </div>
            </div>
            <v-icon v-if="config.mode === 'custom'" color="primary" size="22">check_circle</v-icon>
          </div>

          <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
            <v-btn
              variant="outlined"
              color="primary"
              class="rounded-xl font-bold"
              data-gamepad-focusable
              @click="chooseCustomFile"
            >
              <v-icon start size="18">file_upload</v-icon>
              {{ t('bigPicture.selectImageFile') }}
            </v-btn>

            <div v-if="config.customUrl" class="flex items-center gap-2">
              <img
                :src="config.customUrl"
                class="w-16 h-10 rounded-lg object-cover border border-white/20"
                alt="Custom BG"
              >
              <v-btn
                icon="delete"
                variant="text"
                color="error"
                size="small"
                data-gamepad-focusable
                @click="clearCustomUrl"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pt-4 border-t border-white/10 flex justify-end">
        <v-btn
          color="primary"
          class="rounded-xl font-bold px-6"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        >
          {{ t('shared.ok') }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useInstanceScreenshots } from '@/composables/screenshot'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { injection } from '@/util/inject'

export interface BigPictureBgConfig {
  mode: 'auto' | 'theme' | 'screenshots' | 'icon' | 'custom'
  selectedScreenshot?: string
  customUrl?: string
}

const props = defineProps<{
  modelValue: boolean
  instancePath: string
  instanceName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'change', config: BigPictureBgConfig): void
}>()

const { t } = useI18n()

const instancePathRef = toRef(props, 'instancePath')
const { urls: screenshotUrls } = useInstanceScreenshots(instancePathRef)
const { instanceTheme } = injection(kInstanceTheme)

const themeBgUrl = computed(() => {
  return instanceTheme.value?.backgroundImage?.url || instanceTheme.value?.backgroundImageDark?.url || ''
})

const config = ref<BigPictureBgConfig>({ mode: 'auto' })

function loadConfig() {
  if (!props.instancePath) return
  try {
    const raw = localStorage.getItem(`xmcl:bp:bg:${props.instancePath}`)
    if (raw) {
      config.value = JSON.parse(raw)
      return
    }
  } catch {}
  config.value = { mode: 'auto' }
}

function saveConfig() {
  if (!props.instancePath) return
  try {
    localStorage.setItem(`xmcl:bp:bg:${props.instancePath}`, JSON.stringify(config.value))
  } catch {}
  emit('change', config.value)
}

watch(() => props.instancePath, loadConfig, { immediate: true })

function setMode(mode: BigPictureBgConfig['mode']) {
  config.value.mode = mode
  saveConfig()
}

function selectSlideshow() {
  config.value.mode = 'screenshots'
  config.value.selectedScreenshot = undefined
  saveConfig()
}

function selectSingleScreenshot(url: string) {
  config.value.mode = 'screenshots'
  config.value.selectedScreenshot = url
  saveConfig()
}

async function chooseCustomFile() {
  const result = await windowController.showOpenDialog({
    title: t('bigPicture.selectImageFile'),
    properties: ['openFile'],
    filters: [{
      name: 'Image',
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
    }],
  })

  const filePath = result.filePaths?.[0]
  if (filePath) {
    const url = new URL('http://launcher/media')
    url.searchParams.append('path', filePath)
    config.value.customUrl = url.toString()
    config.value.mode = 'custom'
    saveConfig()
  }
}

function clearCustomUrl() {
  config.value.customUrl = undefined
  if (config.value.mode === 'custom') {
    config.value.mode = 'auto'
  }
  saveConfig()
}

function resetDefault() {
  config.value = { mode: 'auto' }
  saveConfig()
}
</script>
