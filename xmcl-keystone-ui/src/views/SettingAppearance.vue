<template>
  <div>
    <SettingHeader>🎨 {{ t("setting.appearance") }}</SettingHeader>
    <SettingItemSelect
      v-model:select="layout"
      :title="t('setting.layoutTitle')"
      :description="t('setting.layoutDescription')"
      :items="layouts"
    />
    <SettingItemCheckbox
      v-if="env?.os === 'linux'"
      v-model="linuxTitlebar"
      :title="t('setting.linuxTitlebar')"
      :description="t('setting.linuxTitlebarDescription')"
    />
    <SettingItemSelect
      v-model:select="darkModel"
      :title="t('setting.darkTheme')"
      :description="t('setting.darkThemeDescription')"
      :items="themes"
    />
    <v-list-item
      class="items-center justify-center"
      :title="t('setting.colorTheme.name')"
      :subtitle="t('setting.colorTheme.description')"
    >
      <template #prepend>
        <v-list-item-action class="self-center">
          <v-tooltip
            color="warning"
            outlined
            location="right"
          >
            <template #activator="{ props }">
              <v-btn
                variant="text"
                icon
                v-bind="props"
                @click="resetToDefault"
              >
                <v-icon>
                  restore
                </v-icon>
              </v-btn>
            </template>
            {{ t('setting.resetToDefault') }}
          </v-tooltip>
        </v-list-item-action>
      </template>
      
      <template #append>
        <v-list-item-action
          app-bar
          class="ml-[16px]"
        >
          <SettingAppearanceColor
            v-model="appBarColor"
            v-model:blur="blurAppBar"
            has-blur
            :text="t('setting.colorTheme.appBarColor')"
          />
        </v-list-item-action>
        <v-list-item-action
          sidebar
          class="ml-[16px]"
        >
          <SettingAppearanceColor
            v-model="sideBarColor"
            v-model:blur="blurSidebar"
            has-blur
            :text="t('setting.colorTheme.sideBarColor')"
          />
        </v-list-item-action>

        <v-list-item-action
          primary
          class="ml-[16px]"
        >
          <SettingAppearanceColor
            v-model="primaryColor"
            :text="t('setting.colorTheme.primaryColor')"
          />
        </v-list-item-action>
        <v-list-item-action
          primary
          class="ml-[16px]"
        >
          <SettingAppearanceColor
            v-model="cardColor"
            v-model:blur="blurCard"
            has-blur
            :text="t('setting.colorTheme.cardColor')"
          />
        </v-list-item-action>
        <v-list-item-action
          secondary
          class="ml-[16px]"
        >
          <SettingAppearanceColor
            v-model="backgroundColor"
            v-model:blur="blur"
            has-blur
            :text="t('setting.colorTheme.backgroundColor')"
          />
        </v-list-item-action>
        <v-list-item-action
          warning
          class="ml-[16px]"
        >
          <SettingAppearanceColor
            v-model="warningColor"
            :text="t('setting.colorTheme.warningColor')"
          />
        </v-list-item-action>
        <v-list-item-action
          error
          class="ml-[16px]"
        >
          <SettingAppearanceColor
            v-model="errorColor"
            :text="t('setting.colorTheme.errorColor')"
          />
        </v-list-item-action>
      </template>
    </v-list-item>
    <SettingItemSelect
      v-model:select="backgroundType"
      :title="t('setting.backgroundType')"
      :description="t('setting.backgroundTypeDescription')"
      :items="backgroundTypes"
    />
    <SettingItemCheckbox
      v-model="backgroundColorOverlay"
      :title="t('setting.backgroundColorAbove')"
      :description="t('setting.backgroundColorAboveDescription')"
    />
    <SettingItemSelect
      v-if="backgroundType === 'particle'"
      v-model:select="particleMode"
      :title="t('setting.particleMode.name')"
      :description="t('setting.particleModeDescription')"
      :items="particleModes"
    />
    <v-list-item 
      v-if="backgroundType === 'image'"
      :title="t('setting.backgroundImage')"
      :subtitle="t('setting.backgroundImageDescription')"
    >      
      <template #prepend>
        <v-select
          v-model="backgroundImageFit"
          class="mr-4 w-40"
          variant="filled"
          hide-details
          item-title="text"
          :label="t('setting.backgroundImageFit.name')"
          :items="backgroundImageFits"
        />
      </template>
      <template #append>
        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          :disabled="!backgroundImage"
          @click="clearImage"
        >
          {{ t("setting.backgroundImageClear") }}
        </v-btn>
        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          @click="selectImage"
        >
          {{ t("setting.backgroundImageSelect") }}
        </v-btn>
      </template>
    </v-list-item>
    <v-list-item 
      v-if="backgroundType === 'video'"
      :title="t('setting.backgroundVideo')"
      :subtitle="t('setting.backgroundVideoDescription')"
    >      
      <template #prepend>
        <v-select
          v-model="backgroundImageFit"
          class="mr-4 w-40"
          variant="filled"
          hide-details
          :label="t('setting.backgroundImageFit.name')"
          item-title="text"
          :items="backgroundImageFits"
        />
      </template>
      <template #append>
        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          :disabled="!backgroundImage"
          @click="clearVideo"
        >
          {{ t("setting.backgroundImageClear") }}
        </v-btn>
        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          @click="selectVideo"
        >
          {{ t("setting.backgroundVideoSelect") }}
        </v-btn>
      </template>
    </v-list-item>
    <v-list-item 
      v-if="backgroundType === BackgroundType.VIDEO"
      :title="t('setting.backgroundVideoVolume')"
      :subtitle="t('setting.backgroundVideoVolumeDescription')"
    > 
      <template #append>
        <v-slider
          v-model="volume"
          step="0.01"
          :min="0"
          :max="1"
          :hint="t('setting.backgroundVideoVolume')"
          :always-dirty="true"
        />
      </template>
    </v-list-item>
    <v-list-item :title="t('setting.backgroundMusic')">
      <template #append>
        <v-menu
          :disabled="backgroundMusic.length === 0"
        >
          <template #activator="{ props }">
            <v-btn
              variant="outlined"
              :disabled="backgroundMusic.length === 0"
              style="margin-right: 10px"
              v-bind="props"
            >
              {{ t("setting.viewBackgroundMusic") }}
            </v-btn>
          </template>
          <v-list
            density="compact"
            lines="two"
          >
            <v-list-item
              v-for="(m, i) of backgroundMusic"
              :key="m.url"
              :title="basename(m.url, '/')"
              :subtitle="m.mimeType"
              @click="viewMusic(m.url)"
            >
              <template #append>
                <v-btn
                  icon
                  @click="removeMusic(i)"
                >
                  <v-icon color="red">
                    delete
                  </v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          @click="selectMusic"
        >
          {{ t("setting.backgroundVideoSelect") }}
        </v-btn>
      </template>
    </v-list-item>
    <v-list-item
      :title="t('setting.themeFont')"
      :subtitle="t('setting.themeFontDescription')"
    >      
      <template #append>
        <div class="flex flex-grow-0 gap-1 mr-2">
          <v-btn-toggle
            v-model="fontDelta"
            mandatory
            solo
            density="compact"
          >
            <v-btn
              variant="tonal"
              class="h-unset!"
            >
              1px
            </v-btn>
            <v-btn
              variant="tonal"
              class="h-unset!"
            >
              0.1px
            </v-btn>
          </v-btn-toggle>
          <v-btn
            icon
            variant="text"
            @click="onFontSizeDecrease"
          >
            <v-icon>
              text_decrease
            </v-icon>
          </v-btn>
          <v-text-field
            :model-value="`${Math.round(fontSize * 10) / 10}px`"
            readonly
            class="max-w-20"
            variant="solo"
            density="compact"
            hide-details
          />
          <v-btn
            icon
            variant="text"
            @click="onFontSizeIncrease"
          >
            <v-icon>
              text_increase
            </v-icon>
          </v-btn>
        </div>

        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          @click="onSelectFont"
        >
          {{ t("setting.themeSelectFont") }}
        </v-btn>
        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          @click="onRevertFont"
        >
          {{ t("setting.themeResetFont") }}
        </v-btn>
      </template>
    </v-list-item>
    <v-list-item
      :title="t('setting.themeShare')"
      :subtitle="t('setting.themeShareDescription')"
    >
      <template #append>
        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          @click="onExportTheme"
        >
          {{ t("setting.themeExport") }}
        </v-btn>
        <v-btn
          variant="outlined"
          style="margin-right: 10px"
          @click="onImportTheme"
        >
          {{ t("setting.themeImport") }}
        </v-btn>
      </template>
    </v-list-item>
  </div>
</template>
<script lang="ts" setup>
import SettingHeader from '@/components/SettingHeader.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { kEnvironment } from '@/composables/environment'
import { useService } from '@/composables/service'
import { kSettingsState } from '@/composables/setting'
import { BackgroundType, kTheme } from '@/composables/theme'
import { kUILayout } from '@/composables/uiLayout'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { ThemeServiceKey } from '@xmcl/runtime-api'
import SettingAppearanceColor from './SettingAppearanceColor.vue'

const { showOpenDialog, showSaveDialog } = windowController
const { t } = useI18n()
const { blurSidebar, blurAppBar, isDark, fontSize, blurCard, backgroundColorOverlay, backgroundImage, setBackgroundImage, blur, particleMode, backgroundType, backgroundImageFit, volume, clearBackgroundImage, exportTheme, importTheme } = injection(kTheme)
const { sideBarColor, appBarColor, primaryColor, warningColor, errorColor, cardColor, backgroundColor, resetToDefault, currentTheme, font, setFont, resetFont, backgroundMusic, removeMusic } = injection(kTheme)
const { state } = injection(kSettingsState)
const env = injection(kEnvironment)

const linuxTitlebar = computed({
  get: () => state.value?.linuxTitlebar ?? false,
  set: v => state.value?.linuxTitlebarSet(v),
})

const darkModel = computed({
  get: () => isDark.value ? 'dark' : 'light',
  set: v => {
    if (v === 'dark') {
      isDark.value = true
    } else if (v === 'light') {
      isDark.value = false
    } else {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  },
})

const layout = injection(kUILayout)

const themes = computed(() => [{
  text: t('setting.theme.dark'),
  value: 'dark',
}, {
  text: t('setting.theme.light'),
  value: 'light',
}, {
  text: t('setting.theme.system'),
  value: 'system',
}])

const layouts = computed(() => [{
  text: t('setting.layout.default'),
  value: 'default',
}, {
  text: t('setting.layout.focus'),
  value: 'focus',
}])

const particleModes = computed(() => Object.entries({
  push: t('setting.particleMode.push'),
  remove: t('setting.particleMode.remove'),
  repulse: t('setting.particleMode.repulse'),
  bubble: t('setting.particleMode.bubble'),
}).map(([v, text]) => ({ value: v, text })))
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
    filters: [{
      name: 'image',
      extensions: ['png', 'jpg', 'gif', 'webp'],
    }],
  }).then((v) => {
    const imagePath = v.filePaths[0]
    if (imagePath) {
      setBackgroundImage(imagePath)
    }
  })
}
function selectVideo() {
  showOpenDialog({
    title: t('theme.selectVideo'),
    properties: ['openFile'],
    filters: [{
      name: 'video',
      extensions: ['mp4', 'webm'],
    }],
  }).then((v) => {
    if (v.filePaths[0]) {
      setBackgroundImage(v.filePaths[0])
    }
  })
}

const { addMusic } = injection(kTheme)
function selectMusic() {
  showOpenDialog({
    title: t('theme.selectMusic'),
    properties: ['openFile'],
    filters: [{
      name: 'audio',
      extensions: ['mp3', 'ogg', 'wav'],
    }],
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
    defaultPath: currentTheme.value.name,
    filters: [{
      name: 'xtheme',
      extensions: ['xtheme'],
    }],
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
    filters: [{
      name: 'xtheme',
      extensions: ['xtheme'],
    }],
  }).then((v) => {
    if (v.filePaths[0]) {
      importTheme(v.filePaths[0])
    }
  })
}

const fontDelta = ref(0)
function onFontSizeIncrease() {
  const delta = fontDelta.value ? 0.1 : 1
  fontSize.value += delta
}
function onFontSizeDecrease() {
  const delta = fontDelta.value ? 0.1 : 1
  fontSize.value -= delta
}

function onSelectFont() {
  showOpenDialog({
    title: t('setting.themeSelectFont'),
    properties: ['openFile'],
    filters: [{
      name: 'font',
      extensions: ['ttf', 'otf', 'woff', 'woff2'],
    }],
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
