<template>
  <div>
    <SettingHeader>🎨 {{ t("setting.appearance") }}</SettingHeader>
    <SettingItemSelect
      :select.sync="layout"
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
      :select.sync="theme"
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
          :text="t('setting.colorTheme.appBarColor')"
        />
      </v-list-item-action>
      <v-list-item-action
        sidebar
        class="ml-[16px]"
      >
        <SettingAppearanceColor
          v-model="sideBarColor"
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
          :text="t('setting.colorTheme.cardColor')"
        />
      </v-list-item-action>
      <v-list-item-action
        secondary
        class="ml-[16px]"
      >
        <SettingAppearanceColor
          v-model="backgroundColor"
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
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        @click="selectImage"
      >
        {{ t("setting.backgroundImageSelect") }}
      </v-btn>
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
        :disabled="!backgroundVideo"
        @click="clearVideo"
      >
        {{ t("setting.backgroundImageClear") }}
      </v-btn>
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        @click="selectVideo"
      >
        {{ t("setting.backgroundVideoSelect") }}
      </v-btn>
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
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.backgroundImageBlur")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.backgroundImageBlurDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-slider
        v-model="blur"
        :height="5"
        :min="0"
        :max="20"
        :hint="t('setting.backgroundImageBlur')"
        :always-dirty="true"
      />
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.blurSidebar")
          }}
        </v-list-item-title>
      </v-list-item-content>
      <v-slider
        v-model="blurSidebar"
        :height="5"
        :min="0"
        :max="20"
        :hint="t('setting.blurSidebar')"
        :always-dirty="true"
      />
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.blurAppBar")
          }}
        </v-list-item-title>
      </v-list-item-content>
      <v-slider
        v-model="blurAppBar"
        :height="5"
        :min="0"
        :max="20"
        :hint="t('setting.blurAppBar')"
        :always-dirty="true"
      />
    </v-list-item>
  </div>
</template>
<script lang="ts" setup>
import { kSettingsState } from '@/composables/setting'
import { kUILayout } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { BackgroundType, kBackground, useBackground, useBarBlur } from '../composables/background'
import { kColorTheme } from '../composables/colorTheme'
import SettingAppearanceColor from './SettingAppearanceColor.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingHeader from '@/components/SettingHeader.vue'
import { useEnvironment } from '@/composables/environment'

const { showOpenDialog } = windowController
const { t } = useI18n()
const { backgroundImage, setBackgroundImage, blur, particleMode, backgroundType, backgroundImageFit, volume, setBackgroundVideo, backgroundVideo } = injection(kBackground)
const { blurSidebar, blurAppBar } = useBarBlur()
const { sideBarColor, appBarColor, primaryColor, warningColor, errorColor, cardColor, backgroundColor, resetToDefault } = injection(kColorTheme)
const { state } = injection(kSettingsState)
const env = useEnvironment()

const linuxTitlebar = computed({
  get: () => state.value?.linuxTitlebar ?? false,
  set: v => state.value?.linuxTitlebarSet(v),
})

const layout = injection(kUILayout)

const theme = computed({
  get: () => state.value?.theme ?? 'system',
  set: v => state.value?.themeSet(v),
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
    title: '选择图片',
    properties: ['openFile'],
    filters: [{
      name: 'image',
      extensions: ['png', 'jpg'],
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
    title: '选择视频',
    properties: ['openFile'],
    filters: [{
      name: 'video',
      extensions: ['mp4', 'ogg', 'webm'],
    }],
  }).then((v) => {
    if (v.filePaths[0]) {
      setBackgroundVideo(v.filePaths[0])
    }
  })
}
function clearVideo() {
  backgroundVideo.value = ''
}
function clearImage() {
  backgroundImage.value = ''
}

</script>
