<template>
  <v-list
    three-line
    subheader
    style="background: transparent"
    class="flex-grow"
  >
    <v-subheader>{{ $t("setting.appearance") }}</v-subheader>
    <v-list-item class="justify-center items-center">
      <v-list-item-action class="self-center">
        <v-checkbox v-model="darkTheme" />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("setting.darkTheme")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.darkThemeDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-action class="self-center">
        <v-checkbox v-model="blurMainBody" />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("setting.blurMainBody")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.blurMainBodyDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("setting.backgroundType")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.backgroundTypeDescription")
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
                $t("setting.particleMode")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.particleModeDescription")
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
            $t("setting.particleMode")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.particleModeDescription")
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
            $t("setting.backgroundImage")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.backgroundImageDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="mr-4">
        <v-select
          v-model="backgroundImageFit"
          class="w-40 mr-4"
          filled
          hide-details
          :label="$t('setting.backgroundImageFit.name')"
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
        {{ $t("setting.backgroundImageClear") }}
      </v-btn>
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        @click="selectImage"
      >
        {{ $t("setting.backgroundImageSelect") }}
      </v-btn>
    </v-list-item>
    <v-list-item v-if="backgroundType === 'video'">
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("setting.backgroundVideo")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.backgroundVideoDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <!-- <v-list-item-action class="mr-4">
            <v-select
              v-model="backgroundImageFit"
              class="w-40 mr-4"
              filled
              hide-details
              :label="$t('setting.backgroundImageFit.name')"
              :items="backgroundImageFits"
            />
          </v-list-item-action>-->
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        :disabled="!backgroundVideo"
        @click="clearVideo"
      >
        {{ $t("setting.backgroundImageClear") }}
      </v-btn>
      <v-btn
        outlined
        text
        style="margin-right: 10px"
        @click="selectVideo"
      >
        {{ $t("setting.backgroundVideoSelect") }}
      </v-btn>
    </v-list-item>
    <v-list-item v-if="backgroundType !== BackgroundType.VIDEO">
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("setting.backgroundImageBlur")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.backgroundImageBlurDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-slider
        v-model="blur"
        :min="0"
        :max="100"
        :hint="$t('setting.backgroundBlur')"
        :always-dirty="true"
      />
    </v-list-item>
    <v-list-item v-if="backgroundType === BackgroundType.VIDEO">
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("setting.backgroundVideoVolume")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.backgroundVideoVolumeDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-slider
        v-model="volume"
        step="0.01"
        :min="0"
        :max="1"
        :hint="$t('setting.VideoVolume')"
        :always-dirty="true"
      />
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { BackgroundType, useBackground } from '../composables/background'
import { VuetifyInjectionKey } from '../vuetify'
import { useI18n } from '/@/composables'
import { injection } from '/@/util/inject'

const { showOpenDialog } = windowController
const vuetify = injection(VuetifyInjectionKey)
const { $t: t } = useI18n()
const { backgroundImage, setBackgroundImage, blur, particleMode, backgroundType, blurMainBody, backgroundImageFit, volume, setBackgroundVideo, backgroundVideo } = useBackground()

const darkTheme = computed({
  get(): boolean { return vuetify.theme.dark },
  set(v: boolean) { vuetify.theme.dark = v },
})
const particleModes = computed(() => ['push', 'remove', 'repulse', 'bubble'].map(v => ({ value: v, text: t(`setting.particleMode.${v}`) })))
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
    setBackgroundImage(imagePath)
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
    const videoPath = 'video://' + v.filePaths[0]
    setBackgroundVideo(videoPath)
  })
}
function clearVideo() {
  backgroundVideo.value = ''
}
function clearImage() {
  backgroundImage.value = ''
}

</script>
