<template>
  <v-list
    three-line
    subheader
    style="background: transparent"
    class="flex-grow"
  >
    <v-subheader>{{ t("setting.appearance") }}</v-subheader>
    <v-list-item class="justify-center items-center">
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
    <v-list-item class="justify-center items-center">
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
          class="w-40 mr-4"
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
          class="w-40 mr-4"
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
        :min="0"
        :max="20"
        :hint="t('setting.backgroundImageBlur')"
        :always-dirty="true"
      />
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { BackgroundType, useBackground } from '../composables/background'
import { useColorTheme } from '../composables/colorTheme'
import { useI18n, useService, useTheme } from '/@/composables'
import SettingAppearanceColor from './SettingAppearanceColor.vue'

const { showOpenDialog } = windowController
const { t } = useI18n()
const { backgroundImage, setBackgroundImage, blur, particleMode, backgroundType, blurMainBody, backgroundImageFit, volume, setBackgroundVideo, backgroundVideo } = useBackground()
const { sideBarColor, appBarColor, primaryColor, warningColor, errorColor, backgroundColor, resetToDefault } = useColorTheme()
const { state } = useService(BaseServiceKey)

const theme = computed({
  get: () => state.theme,
  set: v => state.themeSet(v),
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

<i18n locale="en" lang="yaml">
setting:
  appearance: Appearance
  resetToDefault: Reset to Default
  backgroundImage: background image
  backgroundImageBlur: image blur
  backgroundImageBlurDescription: drag to blur, easy
  backgroundImageClear: clear
  backgroundImageDescription: select an image as background or clear
  backgroundImageFit:
    contain: Contain
    cover: Cover
    name: Image Fit
  backgroundImageSelect: select
  backgroundType: Background Type
  backgroundTypeDescription: Show special effect on background (This may impact performance)
  backgroundTypes:
    halo: Halo
    image: Image
    none: None
    particle: Particle
    video: video
  backgroundVideo: Background Video
  backgroundVideoDescription: select or clear video
  backgroundVideoSelect: select
  backgroundVideoVolume: volume
  backgroundVideoVolumeDescription: drag to adjust volume
  blurMainBody: Blur Main Body
  blurMainBodyDescription: Should the launcher right pane be blurred
  colorTheme:
    appBarColor: App Bar
    description: Change the colors in the theme
    errorColor: Error Color
    name: Theme Color
    primaryColor: Primary Color
    secondaryColor: Secondary Color
    sideBarColor: Side Bar
    backgroundColor: Background Color
    warningColor: Warning Color
  darkTheme: Theme
  darkThemeDescription: Choose the dark or light theme
  particleMode:
    name: Particle Mode
    bubble: Bubble
    push: Push
    remove: Remove
    repulse: Repulse
  showParticle: Show Particles
  showParticleDescription: Show particles in background (May impact performance)
  particleModeDescription: Select the particle click behavior
  theme:
    dark: Dark Theme
    light: Light Theme
    system: Use System Theme
</i18n>
<i18n locale="zh-CN" lang="yaml">
setting:
  appearance: 外观
  resetToDefault: 重置到默认配色
  backgroundImage: 背景图片
  backgroundImageBlur: 背景模糊
  backgroundImageBlurDescription: 拖动以模糊背景
  backgroundImageClear: 清空
  backgroundImageDescription: 选择一张背景图片或清空当前图片
  backgroundImageFit:
    contain: 包含
    cover: 覆盖
    name: 放置方式
  backgroundImageSelect: 选择
  backgroundType: 背景效果
  backgroundTypeDescription: 背景是否显示特效（如果觉得卡就可以关掉）
  backgroundTypes:
    halo: 光晕
    image: 图片
    none: 无
    particle: 粒子
    video: 视频
  backgroundVideo: 背景视频
  backgroundVideoDescription: 选择一个背景视频或清空当前
  backgroundVideoSelect: 选择
  backgroundVideoVolume: 视频音量
  backgroundVideoVolumeDescription: 拖动以调整音量
  blurMainBody: 模糊窗口主体
  blurMainBodyDescription: 是否将启动器窗口右侧主体模糊
  colorTheme:
    appBarColor: 顶端栏
    description: 改变主题中的配色
    errorColor: 错误颜色
    name: 主题颜色
    primaryColor: 主要颜色
    secondaryColor: 次要颜色
    backgroundColor: 背景颜色
    sideBarColor: 侧边栏
    warningColor: 警告颜色
  darkTheme: 主题
  darkThemeDescription: 选择深色或浅色主题
  particleMode:
    name: 粒子特效
    bubble: 气泡
    push: 增加
    remove: 移除
    repulse: 击退
  particleModeDescription: 选择当你点击粒子时的特效
  theme:
    dark: 暗色主题
    light: 亮色主题
    system: 跟随系统
  showParticle: 显示粒子
  showParticleDescription: 是否在背景显示粒子效果 (这会影响性能，觉得卡可以关了)
</i18n>

<i18n locale="zh-TW" lang="yaml">
setting:
  appearance: 外觀
  backgroundImage: 背景圖片
  backgroundImageBlur: 背景模糊
  backgroundImageBlurDescription: 拖動以模糊背景
  backgroundImageClear: 清空
  backgroundImageDescription: 選擇一張背景圖片或清空當前圖片
  backgroundImageFit:
    contain: 包含
    cover: 覆蓋
    name: 放置方式
  backgroundImageSelect: 選擇
  backgroundType: 背景效果
  backgroundTypeDescription: 背景是否顯示特效（如果覺得卡就可以關掉）
  backgroundTypes:
    halo: 光暈
    image: 圖片
    none: 無
    particle: 粒子
    video: 視頻
  backgroundVideo: 背景視頻
  backgroundVideoDescription: 選擇一個背景視頻或清空當前
  backgroundVideoSelect: 選擇
  backgroundVideoVolume: 視頻音量
  backgroundVideoVolumeDescription: 拖動以調整音量
  blurMainBody: 模糊窗口主體
  blurMainBodyDescription: 是否將啓動器窗口右側主體模糊
  colorTheme:
    appBarColor: 頂端欄
    description: 改變主題中的配色
    errorColor: 錯誤顏色
    name: 主題顏色
    primaryColor: 主要顏色
    secondaryColor: 次要顏色
    backgroundColor: 背景顏色
    sideBarColor: 側邊欄
    warningColor: 警告顏色
  darkTheme: 主題
  darkThemeDescription: 選擇深色或淺色主題
  particleMode:
    name: 粒子特效
    bubble: 氣泡
    push: 增加
    remove: 移除
    repulse: 擊退
  particleModeDescription: 選擇當你點擊粒子時的特效
  theme:
    dark: 暗色主題
    light: 亮色主題
    system: 跟隨系統
  showParticle: 顯示粒子
  showParticleDescription: 是否在背景顯示粒子效果 (這會影響性能，覺得卡可以關了)
</i18n>

<i18n locale="ru" lang="yaml">
setting:
  appearance: Внешний вид
  backgroundImage: Изображение фона
  backgroundImageBlur: Размытие изображения
  backgroundImageBlurDescription: Перетащите чтобы размыть, легко
  backgroundImageClear: Очистить
  backgroundImageDescription: Выберите изображение в качестве фона или очистите его
  backgroundImageSelect: Выбрать
  backgroundType: Тип фона
  backgroundTypeDescription: Показывать спецэффекты на фоне (Может повлиять на производительность)
  backgroundTypes:
    halo: Ореол
    image: Изображение
    none: Ничего
    particle: Частицы
  blurMainBody: Размытие главного окна
  blurMainBodyDescription: Размытие правой панели лаунчера
  darkTheme: Тема
  darkThemeDescription: Выберите тёмную или светлую тему
  particleMode:
    '': Режим частиц
    bubble: Пузыри
    push: Отталкивание
    remove: Удаление
    repulse: Отражение
  particleModeDescription: Выберите поведение частиц при нажатии
  theme:
    dark: Dark Тема
    light: Light Тема
    system: Use System Тема
  showParticle: Показывать частицы
  showParticleDescription: Показывать частицы фона (Может повлиять на производительность)
</i18n>
