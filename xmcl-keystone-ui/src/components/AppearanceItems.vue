<template>
  <div>
    <SettingItemSelect
      :select.sync="darkModel"
      :title="t('setting.darkTheme')"
      :description="t('setting.darkThemeDescription')"
      :items="themes"
    />
    <v-list-item class="items-center justify-center">
      <v-list-item-action class="self-center">
        <v-tooltip
          color="warning"
          outlined
          right
        >
          <template #activator="{ on }">
            <v-btn
              text
              icon
              v-on="on"
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
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.colorTheme.name")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.colorTheme.description")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>

      <v-list-item-action
        app-bar
        class="ml-[16px]"
      >
        <SettingAppearanceColor
          v-model="appBarColor"
          :blur.sync="blurAppBar"
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
          :blur.sync="blurSidebar"
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
          :blur.sync="blurCard"
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
          :blur.sync="blur"
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
    </v-list-item>
    <SettingItemSelect
      :select.sync="backgroundType"
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
      :select.sync="particleMode"
      :title="t('setting.particleMode.name')"
      :description="t('setting.particleModeDescription')"
      :items="particleModes"
    />
    <v-list-item v-if="backgroundType === 'image'">
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.backgroundImage")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.backgroundImageDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="mr-4">
        <v-select
          v-model="backgroundImageFit"
          class="mr-4 w-40"
          filled
          hide-details
          :label="t('setting.backgroundImageFit.name')"
          :items="backgroundImageFits"
        />
      </v-list-item-action>
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        :disabled="!backgroundImage"
        @click="clearImage"
      >
        {{ t("setting.backgroundImageClear") }}
      </v-btn>
      <v-menu
        offset-y
        open-on-hover
        close-delay="100"
      >
        <template #activator="{ on, attrs }">
          <v-btn
            outlined
            text
            style="margin-right: 10px"
            v-bind="attrs"
            v-on="on"
            @click="selectImage"
          >
            {{ t("setting.select") }}
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item @click="showImageUrlDialog = true">
            <v-list-item-icon>
              <v-icon>link</v-icon>
            </v-list-item-icon>
            <v-list-item-title>{{ t("setting.enterUrl") }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-list-item>
    <v-list-item v-if="backgroundType === 'video'">
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.backgroundVideo")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.backgroundVideoDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="mr-4">
        <v-select
          v-model="backgroundImageFit"
          class="mr-4 w-40"
          filled
          hide-details
          :label="t('setting.backgroundImageFit.name')"
          :items="backgroundImageFits"
        />
      </v-list-item-action>
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        :disabled="!backgroundImage"
        @click="clearVideo"
      >
        {{ t("setting.backgroundImageClear") }}
      </v-btn>
      <v-menu
        offset-y
        open-on-hover
        close-delay="100"
      >
        <template #activator="{ on, attrs }">
          <v-btn
            outlined
            text
            style="margin-right: 10px"
            v-bind="attrs"
            v-on="on"
            @click="selectVideo"
          >
            {{ t("setting.select") }}
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item @click="showVideoUrlDialog = true">
            <v-list-item-icon>
              <v-icon>link</v-icon>
            </v-list-item-icon>
            <v-list-item-title>{{ t("setting.enterUrl") }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-list-item>
    <v-list-item v-if="backgroundType === BackgroundType.VIDEO">
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.backgroundVideoVolume")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.backgroundVideoVolumeDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-slider
        v-model="volume"
        step="0.01"
        :min="0"
        :max="1"
        :hint="t('setting.backgroundVideoVolume')"
        :always-dirty="true"
      />
    </v-list-item>
    <v-list-item>
      <v-list-item-title>
        {{
          t("setting.backgroundMusic")
        }}
      </v-list-item-title>
      <v-menu
        offset-y
        :disabled="backgroundMusic.length === 0"
      >
        <template #activator="{ on }">
          <v-btn
            outlined
            text
            :disabled="backgroundMusic.length === 0"
            style="margin-right: 10px"
            v-on="on"
          >
            {{ t("setting.viewBackgroundMusic") }}
          </v-btn>
        </template>
        <v-list
          dense
          two-line
        >
          <v-list-item
            v-for="(m, i) of backgroundMusic"
            :key="m.url"
            @click="viewMusic(m.url)"
          >
            <v-list-item-content>
              <v-list-item-title>
                {{ basename(m.url, '/') }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ m.mimeType }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                icon
                @click="removeMusic(i)"
              >
                <v-icon color="red">
                  delete
                </v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-menu
        offset-y
        open-on-hover
        close-delay="100"
      >
        <template #activator="{ on, attrs }">
          <v-btn
            outlined
            text
            style="margin-right: 10px"
            v-bind="attrs"
            v-on="on"
            @click="selectMusic"
          >
            {{ t("setting.select") }}
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item @click="showMusicUrlDialog = true">
            <v-list-item-icon>
              <v-icon>link</v-icon>
            </v-list-item-icon>
            <v-list-item-title>{{ t("setting.enterUrl") }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t('setting.themeFont')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t('setting.themeFontDescription')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <div class="flex flex-grow-0 gap-1 mr-2">
        <v-btn-toggle
          v-model="fontDelta"
          mandatory
          solo
          dense
        >
          <v-btn
            solo
            class="h-unset!"
          >
            1px
          </v-btn>
          <v-btn
            solo
            class="h-unset!"
          >
            0.1px
          </v-btn>
        </v-btn-toggle>
        <v-btn
          icon
          @click="onFontSizeDecrease"
        >
          <v-icon>
            text_decrease
          </v-icon>
        </v-btn>
        <v-text-field
          :value="`${Math.round(fontSize * 10) / 10}px`"
          readonly
          class="max-w-20"
          solo
          outlined
          dense
          hide-details
        />
        <v-btn
          icon
          @click="onFontSizeIncrease"
        >
          <v-icon>
            text_increase
          </v-icon>
        </v-btn>
      </div>

      <v-menu
        offset-y
        open-on-hover
        close-delay="100"
      >
        <template #activator="{ on, attrs }">
          <v-btn
            outlined
            text
            style="margin-right: 10px"
            v-bind="attrs"
            v-on="on"
            @click="onSelectFont"
          >
            {{ t("setting.themeSelectFont") }}
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item @click="showFontUrlDialog = true">
            <v-list-item-icon>
              <v-icon>link</v-icon>
            </v-list-item-icon>
            <v-list-item-title>{{ t("setting.enterUrl") }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        @click="onRevertFont"
      >
        {{ t("setting.themeResetFont") }}
      </v-btn>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t('setting.themeShare')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t('setting.themeShareDescription')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        @click="onExportTheme"
      >
        {{ t("setting.themeExport") }}
      </v-btn>
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        @click="onImportTheme"
      >
        {{ t("setting.themeImport") }}
      </v-btn>
    </v-list-item>

    <!-- Image URL Dialog -->
    <v-dialog
      v-model="showImageUrlDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>{{ t("setting.backgroundImageUrl") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="imageUrlInput"
            autofocus
            filled
            :label="t('setting.backgroundImageUrlPlaceholder')"
            @keydown.enter="applyImageUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="showImageUrlDialog = false"
          >
            {{ t("cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            text
            :disabled="!imageUrlInput"
            @click="applyImageUrl"
          >
            {{ t("ok") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Video URL Dialog -->
    <v-dialog
      v-model="showVideoUrlDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>{{ t("setting.backgroundVideoUrl") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="videoUrlInput"
            autofocus
            filled
            :label="t('setting.backgroundVideoUrlPlaceholder')"
            @keydown.enter="applyVideoUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="showVideoUrlDialog = false"
          >
            {{ t("cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            text
            :disabled="!videoUrlInput"
            @click="applyVideoUrl"
          >
            {{ t("ok") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Music URL Dialog -->
    <v-dialog
      v-model="showMusicUrlDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>{{ t("setting.backgroundMusicUrl") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="musicUrlInput"
            autofocus
            filled
            :label="t('setting.backgroundMusicUrlPlaceholder')"
            @keydown.enter="applyMusicUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="showMusicUrlDialog = false"
          >
            {{ t("cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            text
            :disabled="!musicUrlInput"
            @click="applyMusicUrl"
          >
            {{ t("ok") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Font URL Dialog -->
    <v-dialog
      v-model="showFontUrlDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>{{ t("setting.themeFontUrl") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="fontUrlInput"
            autofocus
            filled
            :label="t('setting.themeFontUrlPlaceholder')"
            @keydown.enter="applyFontUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="showFontUrlDialog = false"
          >
            {{ t("cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            text
            :disabled="!fontUrlInput"
            @click="applyFontUrl"
          >
            {{ t("ok") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script lang="ts" setup>
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { useService } from '@/composables/service'
import { BackgroundType, UIThemeDataV1, useThemeWritter } from '@/composables/theme'
import { basename } from '@/util/basename'
import { ThemeServiceKey } from '@xmcl/runtime-api'
import SettingAppearanceColor from '../views/SettingAppearanceColor.vue'

const props = defineProps<{
  theme: UIThemeDataV1
  /**
   * If provided, media files will be stored under the instance's theme folder.
   * This keeps instance theme media separate from global theme media.
   */
  instancePath?: string
}>()
const { showOpenDialog, showSaveDialog } = windowController
const { t } = useI18n()

const emit = defineEmits<{
  (e: 'save'): void
}>()
const {
  backgroundMusic,
  backgroundImage,
  setBackgroundImage, setBackgroundImageUrl, clearBackgroundImage, exportTheme, importTheme, resetToDefault, setFont, setFontUrl, resetFont, removeMusic, addMusic, addMusicUrl,
  appBarColor, sideBarColor, primaryColor, cardColor, backgroundColor, warningColor, errorColor,
  blurAppBar, blurSidebar, blurCard, blur,
  backgroundColorOverlay, backgroundType, particleMode, backgroundImageFit, volume, fontSize,
  isDark,
} = useThemeWritter(computed(() => props.theme), () => emit('save'), { instancePath: props.instancePath })

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
    defaultPath: props.theme.name,
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
