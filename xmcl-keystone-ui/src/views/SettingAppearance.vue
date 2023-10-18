<template>
  <v-list
    three-line
    subheader
    style="background: transparent"
    class="flex-grow"
  >
    <v-subheader>{{ t("setting.appearance") }}</v-subheader>
    <v-list-item class="items-center justify-center">
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.layoutTitle")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.layoutDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-select
          v-model="layout"
          filled
          style="max-width: 185px"
          hide-details
          :items="layouts"
        />
      </v-list-item-action>
    </v-list-item>
    <v-list-item @click="linuxTitlebar = !linuxTitlebar">
      <v-list-item-action
        class="self-center"
      >
        <v-checkbox v-model="linuxTitlebar" />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.linuxTitlebar")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.linuxTitlebarDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item class="items-center justify-center">
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.darkTheme")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.darkThemeDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-select
          v-model="theme"
          filled
          style="max-width: 185px"
          hide-details
          :items="themes"
        />
      </v-list-item-action>
    </v-list-item>
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
    <!-- <v-list-item>
      <v-list-item-action class="self-center">
        <v-checkbox v-model="blurMainBody" />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.blurMainBody")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.blurMainBodyDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item> -->
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.backgroundType")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.backgroundTypeDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-select
          v-model="backgroundType"
          filled
          :items="backgroundTypes"
        />
      </v-list-item-action>
    </v-list-item>
    <!-- <v-list-item v-if="backgroundType === 'halo'">
          <v-list-item-content>
            <v-list-item-title>
              {{
                t("setting.particleMode")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                t("setting.particleModeDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-select v-model="particleMode" :items="particleModes" />
          </v-list-item-action>
        </v-list-item>-->
    <v-list-item v-if="backgroundType === 'particle'">
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.particleMode.name")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.particleModeDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-select
          v-model="particleMode"
          filled
          :items="particleModes"
        />
      </v-list-item-action>
    </v-list-item>
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
        <!-- <v-list-item-subtitle>
          {{
            t("setting.blurSidebarDescription")
          }}
        </v-list-item-subtitle> -->
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
        <!-- <v-list-item-subtitle>
          {{
            t("setting.blurAppBarDescription")
          }}
        </v-list-item-subtitle> -->
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
  </v-list>
</template>
<script lang="ts" setup>
import { kSettingsState } from '@/composables/setting'
import { kUILayout } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { BackgroundType, kBackground, useBackground, useBarBlur } from '../composables/background'
import { kColorTheme } from '../composables/colorTheme'
import SettingAppearanceColor from './SettingAppearanceColor.vue'

const { showOpenDialog } = windowController
const { t } = useI18n()
const { backgroundImage, setBackgroundImage, blur, particleMode, backgroundType, backgroundImageFit, volume, setBackgroundVideo, backgroundVideo } = injection(kBackground)
const { blurSidebar, blurAppBar } = useBarBlur()
const { sideBarColor, appBarColor, primaryColor, warningColor, errorColor, cardColor, backgroundColor, resetToDefault } = injection(kColorTheme)
const { state } = injection(kSettingsState)

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
      const videoPath = 'video://' + v.filePaths[0]
      setBackgroundVideo(videoPath)
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
