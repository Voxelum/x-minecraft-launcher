<template>
    <SettingItemSelect
      v-model="darkModel"
      :title="t('setting.darkTheme')"
      :description="t('setting.darkThemeDescription')"
      :items="themes"
    />
    <div class="color-theme-row">
      <div class="color-theme-row__reset">
        <v-tooltip color="warning" location="end">
          <template #activator="{ props: tooltipProps }">
            <v-btn icon variant="text" v-bind="tooltipProps" @click="resetToDefault">
              <v-icon> restore </v-icon>
            </v-btn>
          </template>
          {{ t('setting.resetToDefault') }}
        </v-tooltip>
      </div>

      <div class="color-theme-row__text">
        <div class="color-theme-row__title">
          {{ t('setting.colorTheme.name') }}
        </div>
        <div class="color-theme-row__subtitle">
          {{ t('setting.colorTheme.description') }}
        </div>
      </div>

      <div class="color-theme-row__colors">
        <SettingAppearanceColor
          v-model="appBarColor"
          v-model:blur="blurAppBar"
          has-blur
          :text="t('setting.colorTheme.appBarColor')"
        />
        <SettingAppearanceColor
          v-model="sideBarColor"
          v-model:blur="blurSidebar"
          has-blur
          :text="t('setting.colorTheme.sideBarColor')"
        />
        <SettingAppearanceColor
          v-model="primaryColor"
          :text="t('setting.colorTheme.primaryColor')"
        />
        <SettingAppearanceColor
          v-model="cardColor"
          v-model:blur="blurCard"
          has-blur
          :text="t('setting.colorTheme.cardColor')"
        />
        <SettingAppearanceColor
          v-model="backgroundColor"
          v-model:blur="blur"
          has-blur
          :text="t('setting.colorTheme.backgroundColor')"
        />
        <SettingAppearanceColor
          v-model="warningColor"
          :text="t('setting.colorTheme.warningColor')"
        />
        <SettingAppearanceColor v-model="errorColor" :text="t('setting.colorTheme.errorColor')" />
      </div>
    </div>
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItemSelect
      v-model="backgroundType"
      :title="t('setting.backgroundType')"
      :description="t('setting.backgroundTypeDescription')"
      :items="backgroundTypes"
    />
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItemCheckbox
      v-model="backgroundColorOverlay"
      :title="t('setting.backgroundColorAbove')"
      :description="t('setting.backgroundColorAboveDescription')"
    />
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItemSelect
      v-if="backgroundType === 'particle'"
      v-model="particleMode"
      :title="t('setting.particleMode.name')"
      :description="t('setting.particleModeDescription')"
      :items="particleModes"
    />
    <v-divider v-if="!props.dense && backgroundType === 'particle'" class="my-3" />
    <SettingItem
      v-if="backgroundType === 'image'"
      :title="t('setting.backgroundImage')"
      :description="t('setting.backgroundImageDescription')"
      long-action
    >
      <template #action>
        <v-btn
          v-shared-tooltip="() => t('setting.useDesktopBackground')"
          icon
          variant="text"
          class="mr-2"
          :loading="settingDesktopBackground"
          @click="applyDesktopBackground"
        >
          <v-icon>wallpaper</v-icon>
        </v-btn>
        <v-select
          v-model="backgroundImageFit"
          class="mr-4 w-40"
          variant="outlined"
          density="compact"
          hide-details
          item-title="text"
          item-value="value"
          :label="t('setting.backgroundImageFit.name')"
          :items="backgroundImageFits"
        />
        <v-btn variant="outlined" class="mr-2" :disabled="!backgroundImage" @click="clearImage">
          {{ t('setting.backgroundImageClear') }}
        </v-btn>
        <v-menu open-on-hover close-delay="100">
          <template #activator="{ props: activatorProps }">
            <v-btn variant="outlined" v-bind="activatorProps" @click="selectImage">
              {{ t('setting.select') }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item @click="showImageUrlDialog = true">
              <template #prepend>
                <v-icon>link</v-icon>
              </template>
              <v-list-item-title>{{ t('setting.enterUrl') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </SettingItem>
    <v-divider v-if="!props.dense && backgroundType === 'image'" class="my-3" />
    <SettingItem
      v-if="backgroundType === 'video'"
      :title="t('setting.backgroundVideo')"
      :description="t('setting.backgroundVideoDescription')"
      long-action
    >
      <template #action>
        <v-select
          v-model="backgroundImageFit"
          class="mr-4 w-40"
          variant="outlined"
          density="compact"
          hide-details
          item-title="text"
          item-value="value"
          :label="t('setting.backgroundImageFit.name')"
          :items="backgroundImageFits"
        />
        <v-btn variant="outlined" class="mr-2" :disabled="!backgroundImage" @click="clearVideo">
          {{ t('setting.backgroundImageClear') }}
        </v-btn>
        <v-menu open-on-hover close-delay="100">
          <template #activator="{ props: activatorProps }">
            <v-btn variant="outlined" v-bind="activatorProps" @click="selectVideo">
              {{ t('setting.select') }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item @click="showVideoUrlDialog = true">
              <template #prepend>
                <v-icon>link</v-icon>
              </template>
              <v-list-item-title>{{ t('setting.enterUrl') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </SettingItem>
    <v-divider v-if="!props.dense && backgroundType === 'video'" class="my-3" />
    <SettingItem
      v-if="backgroundType === BackgroundType.VIDEO"
      :title="t('setting.backgroundVideoVolume')"
      :description="t('setting.backgroundVideoVolumeDescription')"
      long-action
    >
      <template #action>
        <v-slider
          v-model="volume"
          step="0.01"
          :min="0"
          :max="1"
          density="compact"
          hide-details
          class="min-w-60"
        />
      </template>
    </SettingItem>
    <v-divider v-if="!props.dense && backgroundType === BackgroundType.VIDEO" class="my-3" />
    <SettingItem :title="t('setting.backgroundMusic')" long-action>
      <template #action>
        <v-menu :disabled="backgroundMusic.length === 0">
          <template #activator="{ props: activatorProps }">
            <v-btn
              variant="outlined"
              class="mr-2"
              :disabled="backgroundMusic.length === 0"
              v-bind="activatorProps"
            >
              {{ t('setting.viewBackgroundMusic') }}
            </v-btn>
          </template>
          <v-list density="compact" lines="two">
            <v-list-item v-for="(m, i) of backgroundMusic" :key="m.url" @click="viewMusic(m.url)">
              <v-list-item-title>{{ basename(m.url, '/') }}</v-list-item-title>
              <v-list-item-subtitle>{{ m.mimeType }}</v-list-item-subtitle>
              <template #append>
                <v-btn icon variant="outlined" @click.stop="removeMusic(i)">
                  <v-icon color="error">delete</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-menu open-on-hover close-delay="100">
          <template #activator="{ props: activatorProps }">
            <v-btn variant="outlined" v-bind="activatorProps" @click="selectMusic">
              {{ t('setting.select') }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item @click="showMusicUrlDialog = true">
              <template #prepend>
                <v-icon>link</v-icon>
              </template>
              <v-list-item-title>{{ t('setting.enterUrl') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </SettingItem>
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItem
      :title="t('setting.themeBorderRadius')"
      :description="t('setting.themeBorderRadiusDescription')"
    >
      <template #action>
        <v-switch
          v-model="borderRadiusEnabled"
          color="primary"
          hide-details
          density="compact"
        />
      </template>
    </SettingItem>
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItem
      :title="t('setting.themeFont')"
      :description="t('setting.themeFontDescription')"
      long-action
    >
      <template #action>
        <div class="flex flex-grow-0 gap-1 mr-2 items-center">
          <v-btn-toggle v-model="fontDelta" mandatory density="compact">
            <v-btn min-width="40">1px</v-btn>
            <v-btn min-width="40">0.1px</v-btn>
          </v-btn-toggle>
          <v-btn icon size="small" variant="text" @click="onFontSizeDecrease">
            <v-icon>text_decrease</v-icon>
          </v-btn>
          <v-text-field
            :model-value="`${Math.round(fontSize * 10) / 10}px`"
            readonly
            class="max-w-20 w-20"
            variant="outlined"
            density="compact"
            hide-details
          />
          <v-btn icon size="small" variant="text" @click="onFontSizeIncrease">
            <v-icon>text_increase</v-icon>
          </v-btn>
        </div>
        <v-menu open-on-hover close-delay="100">
          <template #activator="{ props: activatorProps }">
            <v-btn variant="outlined" class="mr-2" v-bind="activatorProps" @click="onSelectFont">
              {{ t('setting.themeSelectFont') }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item @click="showFontUrlDialog = true">
              <template #prepend>
                <v-icon>link</v-icon>
              </template>
              <v-list-item-title>{{ t('setting.enterUrl') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-btn variant="outlined" @click="onRevertFont">
          {{ t('setting.themeResetFont') }}
        </v-btn>
      </template>
    </SettingItem>
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItem
      :title="t('setting.customCss.title')"
      :description="t('setting.customCss.advancedDescription')"
    >
      <template #action>
        <v-btn
          v-if="!props.instancePath && developerMode"
          variant="outlined"
          size="small"
          class="mr-2"
          prepend-icon="auto_awesome"
          :title="t('setting.customCss.openInDialog')"
          @click="openAssistant"
        >
          {{ t('setting.customCss.assistantTitle') }}
        </v-btn>
        <v-switch
          :model-value="cssEnabled"
          color="primary"
          hide-details
          density="compact"
          :aria-label="t('setting.customCss.title')"
          data-testid="custom-css-global-toggle"
          @update:model-value="onToggleCss"
        />
      </template>
    </SettingItem>
    <CustomCssEditor
      v-if="cssEnabled"
      :css="cssContent"
      @update:css="saveCss"
    />
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItem :title="t('setting.themeShare')" :description="t('setting.themeShareDescription')">
      <template #action>
        <v-btn variant="outlined" class="mr-2" @click="onExportTheme">
          {{ t('setting.themeExport') }}
        </v-btn>
        <v-btn variant="outlined" @click="onImportTheme">
          {{ t('setting.themeImport') }}
        </v-btn>
      </template>
    </SettingItem>

    <!-- Image URL Dialog -->
    <v-dialog v-model="showImageUrlDialog" max-width="500">
      <v-card :title="t('setting.backgroundImageUrl')">
        <v-card-text>
          <v-text-field
            v-model="imageUrlInput"
            autofocus
            variant="filled"
            :label="t('setting.backgroundImageUrlPlaceholder')"
            @keydown.enter="applyImageUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showImageUrlDialog = false" variant="outlined">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!imageUrlInput"
            @click="applyImageUrl"
            variant="outlined"
          >
            {{ t('shared.ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Video URL Dialog -->
    <v-dialog v-model="showVideoUrlDialog" max-width="500">
      <v-card :title="t('setting.backgroundVideoUrl')">
        <v-card-text>
          <v-text-field
            v-model="videoUrlInput"
            autofocus
            variant="filled"
            :label="t('setting.backgroundVideoUrlPlaceholder')"
            @keydown.enter="applyVideoUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showVideoUrlDialog = false" variant="outlined">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!videoUrlInput"
            @click="applyVideoUrl"
            variant="outlined"
          >
            {{ t('shared.ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Music URL Dialog -->
    <v-dialog v-model="showMusicUrlDialog" max-width="500">
      <v-card :title="t('setting.backgroundMusicUrl')">
        <v-card-text>
          <v-text-field
            v-model="musicUrlInput"
            autofocus
            variant="filled"
            :label="t('setting.backgroundMusicUrlPlaceholder')"
            @keydown.enter="applyMusicUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showMusicUrlDialog = false" variant="outlined">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!musicUrlInput"
            @click="applyMusicUrl"
            variant="outlined"
          >
            {{ t('shared.ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Font URL Dialog -->
    <v-dialog v-model="showFontUrlDialog" max-width="500">
      <v-card :title="t('setting.themeFontUrl')">
        <v-card-text>
          <v-text-field
            v-model="fontUrlInput"
            autofocus
            variant="filled"
            :label="t('setting.themeFontUrlPlaceholder')"
            @keydown.enter="applyFontUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showFontUrlDialog = false" variant="outlined">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn color="primary" :disabled="!fontUrlInput" @click="applyFontUrl" variant="outlined">
            {{ t('shared.ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
</template>
<script lang="ts" setup>
import CustomCssEditor from '@/components/CustomCssEditor.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { useAgentChatBus } from '@/composables/agentChat'
import { kCustomCss } from '@/composables/customCss'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { useService } from '@/composables/service'
import { kSettingsState } from '@/composables/setting'
import { BackgroundType, UIThemeDataV1, useThemeWritter } from '@/composables/theme'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { ThemeServiceKey } from '@xmcl/runtime-api'
import SettingAppearanceColor from '@/components/SettingAppearanceColor.vue'

const props = defineProps<{
  theme: UIThemeDataV1
  /**
   * If provided, media files will be stored under the instance's theme folder.
   * This keeps instance theme media separate from global theme media.
   */
  instancePath?: string

  dense?: boolean
}>()
const { showOpenDialog, showSaveDialog } = windowController
const { t } = useI18n()

const emit = defineEmits<{
  (e: 'save'): void
}>()
const {
  backgroundMusic,
  backgroundImage,
  setBackgroundImage,
  setBackgroundImageUrl,
  setBackgroundToDesktop,
  clearBackgroundImage,
  exportTheme,
  importTheme,
  resetToDefault,
  setFont,
  setFontUrl,
  resetFont,
  removeMusic,
  addMusic,
  addMusicUrl,
  appBarColor,
  sideBarColor,
  primaryColor,
  cardColor,
  backgroundColor,
  warningColor,
  errorColor,
  blurAppBar,
  blurSidebar,
  blurCard,
  blur,
  backgroundColorOverlay,
  backgroundType,
  particleMode,
  backgroundImageFit,
  volume,
  fontSize,
  borderRadiusEnabled,
  dark,
} = useThemeWritter(
  computed(() => props.theme),
  () => emit('save'),
  { instancePath: props.instancePath },
)

// When switching to an image/video background, enable the color overlay and
// cap the background color's alpha at 75% so the media stays visible underneath.
watch(backgroundType, (type) => {
  if (type !== BackgroundType.IMAGE && type !== BackgroundType.VIDEO) return
  if (!backgroundColorOverlay.value) {
    backgroundColorOverlay.value = true
  }
  // When the user first switches to an image background and nothing has been
  // set before, default to the current OS desktop wallpaper.
  if (type === BackgroundType.IMAGE && !backgroundImage.value) {
    applyDesktopBackground()
  }
  const color = backgroundColor.value
  if (!color || !color.startsWith('#')) return
  let hex = color.slice(1)
  if (hex.length === 6) hex += 'ff'
  if (hex.length !== 8) return
  const maxAlpha = Math.round(0.75 * 255)
  const alpha = parseInt(hex.slice(6, 8), 16)
  if (alpha > maxAlpha) {
    backgroundColor.value = '#' + hex.slice(0, 6) + maxAlpha.toString(16).padStart(2, '0')
  }
})

// ── Custom CSS ─────────────────────────────────────────────────
// Scoped to the instance when `instancePath` is set, otherwise the global theme.
const globalCustomCss = injection(kCustomCss)
const instanceThemeCtx = injection(kInstanceTheme)
const { state: settingsState } = injection(kSettingsState)
const developerMode = computed(() => settingsState.value?.developerMode ?? false)
const chatBus = useAgentChatBus()

const isInstance = computed(() => !!props.instancePath)
const cssEnabled = computed(() => props.theme.customCssEnabled ?? false)
const cssContent = computed(() => (isInstance.value ? instanceThemeCtx.customCss.value : globalCustomCss.css.value))
function saveCss(value: string) {
  if (isInstance.value) {
    instanceThemeCtx.setCustomCss(value)
  } else {
    globalCustomCss.save(value)
  }
}
function onToggleCss(value: boolean | null) {
  props.theme.customCssEnabled = value ?? false
  emit('save')
}
function openAssistant() {
  chatBus.emit('show-css')
}

// URL input refs
const imageUrlInput = ref('')
const videoUrlInput = ref('')
const musicUrlInput = ref('')
const fontUrlInput = ref('')

// Dialog show states
const showImageUrlDialog = ref(false)
const showVideoUrlDialog = ref(false)
const showMusicUrlDialog = ref(false)
const showFontUrlDialog = ref(false)

// URL apply functions
function isValidHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

async function applyImageUrl() {
  if (imageUrlInput.value && isValidHttpUrl(imageUrlInput.value)) {
    await setBackgroundImageUrl(imageUrlInput.value, 'image')
    imageUrlInput.value = ''
    showImageUrlDialog.value = false
  }
}

async function applyVideoUrl() {
  if (videoUrlInput.value && isValidHttpUrl(videoUrlInput.value)) {
    await setBackgroundImageUrl(videoUrlInput.value, 'video')
    videoUrlInput.value = ''
    showVideoUrlDialog.value = false
  }
}

async function applyMusicUrl() {
  if (musicUrlInput.value && isValidHttpUrl(musicUrlInput.value)) {
    await addMusicUrl(musicUrlInput.value)
    musicUrlInput.value = ''
    showMusicUrlDialog.value = false
  }
}

async function applyFontUrl() {
  if (fontUrlInput.value && isValidHttpUrl(fontUrlInput.value)) {
    await setFontUrl(fontUrlInput.value)
    fontUrlInput.value = ''
    showFontUrlDialog.value = false
  }
}

const darkModel = computed({
  get: () => (dark.value === 'system' ? 'system' : dark.value ? 'dark' : 'light'),
  set: (v) => {
    if (v === 'dark') {
      dark.value = true
    } else if (v === 'light') {
      dark.value = false
    } else {
      dark.value = 'system'
    }
  },
})

const themes = computed(() => [
  {
    text: t('setting.theme.dark'),
    value: 'dark',
  },
  {
    text: t('setting.theme.light'),
    value: 'light',
  },
  {
    text: t('setting.theme.system'),
    value: 'system',
  },
])

const particleModes = computed(() =>
  Object.entries({
    push: t('setting.particleMode.push'),
    remove: t('setting.particleMode.remove'),
    repulse: t('setting.particleMode.repulse'),
    bubble: t('setting.particleMode.bubble'),
  }).map(([v, text]) => ({ value: v, text })),
)
const backgroundImageFits = computed(() => [
  { value: 'cover', text: t('setting.backgroundImageFit.cover') },
  { value: 'contain', text: t('setting.backgroundImageFit.contain') },
])
const backgroundTypes = computed(() => [
  { value: BackgroundType.NONE, text: t('setting.backgroundTypes.none') },
  { value: BackgroundType.IMAGE, text: t('setting.backgroundTypes.image') },
  { value: BackgroundType.PARTICLE, text: t('setting.backgroundTypes.particle') },
  { value: BackgroundType.HALO, text: t('setting.backgroundTypes.halo') },
  { value: BackgroundType.VIDEO, text: t('setting.backgroundTypes.video') },
])
function selectImage() {
  showOpenDialog({
    title: t('theme.selectImage'),
    properties: ['openFile'],
    filters: [
      {
        name: 'image',
        extensions: ['png', 'jpg', 'gif', 'webp'],
      },
    ],
  }).then((v) => {
    const imagePath = v.filePaths[0]
    if (imagePath) {
      setBackgroundImage(imagePath)
    }
  })
}
const settingDesktopBackground = ref(false)
async function applyDesktopBackground() {
  if (settingDesktopBackground.value) return
  settingDesktopBackground.value = true
  try {
    await setBackgroundToDesktop()
  } finally {
    settingDesktopBackground.value = false
  }
}
function selectVideo() {
  showOpenDialog({
    title: t('theme.selectVideo'),
    properties: ['openFile'],
    filters: [
      {
        name: 'video',
        extensions: ['mp4', 'webm'],
      },
    ],
  }).then((v) => {
    if (v.filePaths[0]) {
      setBackgroundImage(v.filePaths[0])
    }
  })
}

function selectMusic() {
  showOpenDialog({
    title: t('theme.selectMusic'),
    properties: ['openFile'],
    filters: [
      {
        name: 'audio',
        extensions: ['mp3', 'ogg', 'wav'],
      },
    ],
  }).then(async (v) => {
    if (v.filePaths[0]) {
      await addMusic(v.filePaths[0])
    }
  })
}

const { showMediaItemInFolder } = useService(ThemeServiceKey)
function viewMusic(m: string) {
  showMediaItemInFolder(m)
}

function clearVideo() {
  clearBackgroundImage()
}
function clearImage() {
  clearBackgroundImage()
}

function onExportTheme() {
  showSaveDialog({
    title: t('setting.themeExport'),
    filters: [
      {
        name: 'xtheme',
        extensions: ['xtheme'],
      },
    ],
  }).then((v) => {
    if (v.filePath) {
      exportTheme(v.filePath)
    }
  })
}

function onImportTheme() {
  showOpenDialog({
    title: t('setting.themeImport'),
    properties: ['openFile'],
    filters: [
      {
        name: 'xtheme',
        extensions: ['xtheme'],
      },
    ],
  }).then((v) => {
    if (v.filePaths[0]) {
      importTheme(v.filePaths[0])
    }
  })
}

const fontDelta = ref(0)
function onFontSizeIncrease() {
  const delta = fontDelta.value ? 0.1 : 1
  fontSize.value = fontSize.value + delta
}
function onFontSizeDecrease() {
  const delta = fontDelta.value ? 0.1 : 1
  fontSize.value = fontSize.value - delta
}

function onSelectFont() {
  showOpenDialog({
    title: t('setting.themeSelectFont'),
    properties: ['openFile'],
    filters: [
      {
        name: 'font',
        extensions: ['ttf', 'otf', 'woff', 'woff2'],
      },
    ],
  }).then((v) => {
    if (v.filePaths[0]) {
      setFont(v.filePaths[0])
    }
  })
}

function onRevertFont() {
  resetFont()
}
</script>

<style scoped>
.color-theme-row {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  min-height: 56px;
}

.color-theme-row__reset {
  display: flex;
  align-items: center;
  margin-right: 16px;
  flex-shrink: 0;
}

.color-theme-row__text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.color-theme-row__title {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
}

.color-theme-row__subtitle {
  font-size: 0.875rem;
  opacity: 0.7;
  line-height: 1.4;
}

.color-theme-row__colors {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  margin-left: 16px;
}
</style>
