import { loadV1Theme } from '@/util/theme.v0'
import { deserialize, deserialize as deserializeV0, serialize } from '@/util/theme.v1'
import { useStyleTag } from '@vueuse/core'
import { MediaData, ThemeData, ThemeServiceKey } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, computed, set } from 'vue'
import { Framework } from 'vuetify'
import { useLocalStorageCacheStringValue } from './cache'
import { useService } from './service'
import { injection } from '@/util/inject'

export const kTheme: InjectionKey<ReturnType<typeof useTheme>> = Symbol('theme')

export enum ParticleMode {
  PUSH = 'push',
  REMOVE = 'remove',
  REPULSE = 'repulse',
  BUBBLE = 'bubble',
}

export enum BackgroundType {
  NONE = 'none',
  PARTICLE = 'particle',
  HALO = 'halo',
  IMAGE = 'image',
  VIDEO = 'video',
}

export interface UIThemeDataV1 {
  name: string

  dark: boolean
  colors: {
    lightAppBarColor: string
    lightSideBarColor: string
    darkAppBarColor: string
    darkSideBarColor: string
    darkPrimaryColor: string
    darkBackground: string
    darkInfoColor: string
    darkErrorColor: string
    darkWarningColor: string
    darkSuccessColor: string
    darkAccentColor: string
    darkCardColor: string
    lightPrimaryColor: string
    lightBackground: string
    lightInfoColor: string
    lightErrorColor: string
    lightWarningColor: string
    lightSuccessColor: string
    lightAccentColor: string
    lightCardColor: string
  }

  blur: {
    appBar?: number
    sideBar?: number
    background?: number
    card?: number
  }

  backgroundMusic: MediaData[]
  backgroundMusicPlayOrder?: 'sequential' | 'shuffle'
  backgroundImage?: MediaData // image or video
  backgroundColorOverlay?: boolean
  backgroundType?: BackgroundType
  backgroundVolume?: number
  backgroundImageFit: 'cover' | 'contain'

  font?: MediaData
  fontSize?: number
  particleMode?: ParticleMode
}

export function getDefaultTheme(): UIThemeDataV1 {
  return {
    name: 'default',
    dark: true,
    backgroundMusic: [],
    backgroundMusicPlayOrder: 'sequential',
    colors: {
      lightAppBarColor: '#e0e0e0FF',
      lightSideBarColor: '#FFFFFFFF',
      darkAppBarColor: '#111111FF',
      darkSideBarColor: '#11111166',
      darkPrimaryColor: '#4caf50',
      darkBackground: '#121212A5',
      darkInfoColor: '#2196F3',
      darkErrorColor: '#FF5252',
      darkWarningColor: '#FB8C00',

      darkSuccessColor: '#4CAF50',
      darkAccentColor: '#00e676',
      darkCardColor: '#0c0c0ccc',
      lightPrimaryColor: '#1976D2',
      lightBackground: '#FFFFFF',
      lightInfoColor: '#2196F3',
      lightErrorColor: '#FF5252',
      lightWarningColor: '#FB8C00',
      lightSuccessColor: '#4CAF50',
      lightAccentColor: '#82B1FF',
      lightCardColor: '#e0e0e080',
    },
    backgroundColorOverlay: true,
    backgroundVolume: 1,
    backgroundImage: undefined,
    backgroundImageFit: 'cover',
    backgroundType: BackgroundType.NONE,
    font: undefined,
    fontSize: 16,
    blur: {
      background: 3,
      card: 20,
      appBar: 3,
      sideBar: 3,
    }
  }
}

export function useThemesItems() {
  const { themes } = injection(kTheme)
  const { t } = useI18n()
  //   const themes = computed(() => [{
  //   text: t('setting.theme.dark'),
  //   value: 'dark',
  // }, {
  //   text: t('setting.theme.light'),
  //   value: 'light',
  // }, {
  //   text: t('setting.theme.system'),
  //   value: 'system',
  // }])

  const items = computed(() => {
    return themes.value.map((theme) => {
      return {
        text: theme.name === 'default-dark' ? t('setting.theme.dark') : theme.name === 'default-light' ? t('setting.theme.light') : theme.name,
        value: theme.name,
      }
    })
  })

  return items
}

export interface UIThemeData {
  name: string

  colors: {
    lightAppBarColor: string
    lightSideBarColor: string
    darkAppBarColor: string
    darkSideBarColor: string
    darkPrimaryColor: string
    darkBackground: string
    darkInfoColor: string
    darkErrorColor: string
    darkWarningColor: string
    darkSuccessColor: string
    darkAccentColor: string
    darkCardColor: string
    lightPrimaryColor: string
    lightBackground: string
    lightInfoColor: string
    lightErrorColor: string
    lightWarningColor: string
    lightSuccessColor: string
    lightAccentColor: string
    lightCardColor: string
  }
  backgroundMusic: MediaData[]
  backgroundMusicPlayOrder?: 'sequential' | 'shuffle'
  backgroundImage?: MediaData // image or video
  backgroundColorOverlay?: boolean
  backgroundType?: BackgroundType
  backgroundVolume?: number
  backgroundImageFit: 'cover' | 'contain'
  font?: MediaData
  fontSize?: number
  particleMode?: ParticleMode
  blur: number
  blurSidebar?: number
  blurAppBar?: number
}

export function useTheme(framework: Framework, { addMedia, removeMedia, exportTheme, importTheme, getThemes, getTheme, setTheme } = useService(ThemeServiceKey)) {
  const selectedThemeName = useLocalStorageCacheStringValue('selectedThemeName', 'default' as string)
  const currentTheme = ref<UIThemeDataV1>(getDefaultTheme())
  const themes = ref<UIThemeDataV1[]>([])

  function update() {
    getThemes().then((v) => {
      themes.value = v.map((theme) => {
        const t = deserialize(theme)
        if (!t) return getDefaultTheme()
        return t
      })
    })
  }
  onMounted(update)

  const isDark = computed({
    get: () => currentTheme.value.dark,
    set: (dark: boolean) => {
      currentTheme.value.dark = dark
      writeTheme(currentTheme.value.name, currentTheme.value)
    }
  })
  watch(isDark, (dark) => {
    framework.theme.dark = dark
  }, { immediate: true })

  const backgroundType = computed({
    get() { return currentTheme.value.backgroundType ?? BackgroundType.NONE },
    set(v: BackgroundType) {
      currentTheme.value.backgroundType = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const blur = computed({
    get() { return currentTheme.value.blur?.background ?? 0 },
    set(v: number) {
      if (!currentTheme.value.blur) currentTheme.value.blur = {};
      currentTheme.value.blur.background = v;
      writeTheme(currentTheme.value.name, currentTheme.value);
    },
  })
  const blurCard = computed({
    get() { return currentTheme.value.blur.card ?? 22 },
    set(v: number) {
      currentTheme.value.blur.card = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    }
  })
  const backgroundImage = computed(() => currentTheme.value.backgroundImage)
  const backgroundColorOverlay = computed({
    get() { return currentTheme.value.backgroundColorOverlay ?? false },
    set(v: boolean) {
      currentTheme.value.backgroundColorOverlay = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const backgroundMusic = computed(() => currentTheme.value.backgroundMusic ?? [])
  const backgroundImageFit = computed({
    get() { return currentTheme.value.backgroundImageFit },
    set(v: 'cover' | 'contain') {
      currentTheme.value.backgroundImageFit = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const particleMode = computed({
    get() { return currentTheme.value.particleMode ?? ParticleMode.PUSH },
    set(v: ParticleMode) {
      currentTheme.value.particleMode = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const blurSidebar = computed({
    get() { return currentTheme.value.blur?.sideBar ?? 4 },
    set(v: number) {
      if (!currentTheme.value) return
      if (!currentTheme.value.blur) currentTheme.value.blur = {};
      currentTheme.value.blur.sideBar = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const blurAppBar = computed({
    get() { return currentTheme.value.blur?.appBar ?? 4 },
    set(v: number) {
      if (!currentTheme.value) return
      if (!currentTheme.value.blur) currentTheme.value.blur = {};
      currentTheme.value.blur.appBar = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const volume = computed({
    get() { return currentTheme.value.backgroundVolume ?? 0 },
    set(v: number) {
      if (!currentTheme.value) return
      currentTheme.value.backgroundVolume = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const appBarColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkAppBarColor : currentTheme.value.colors.lightAppBarColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkAppBarColor = v
      } else {
        currentTheme.value.colors.lightAppBarColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const sideBarColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkSideBarColor : currentTheme.value.colors.lightSideBarColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkSideBarColor = v
      } else {
        currentTheme.value.colors.lightSideBarColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const primaryColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkPrimaryColor : currentTheme.value.colors.lightPrimaryColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkPrimaryColor = v
      } else {
        currentTheme.value.colors.lightPrimaryColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const backgroundColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkBackground : currentTheme.value.colors.lightBackground ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkBackground = v
      } else {
        currentTheme.value.colors.lightBackground = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const infoColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkInfoColor : currentTheme.value.colors.lightInfoColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkInfoColor = v
      } else {
        currentTheme.value.colors.lightInfoColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const errorColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkErrorColor : currentTheme.value.colors.lightErrorColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkErrorColor = v
      } else {
        currentTheme.value.colors.lightErrorColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const warningColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkWarningColor : currentTheme.value.colors.lightWarningColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkWarningColor = v
      } else {
        currentTheme.value.colors.lightWarningColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const successColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkSuccessColor : currentTheme.value.colors.lightSuccessColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkSuccessColor = v
      } else {
        currentTheme.value.colors.lightSuccessColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const accentColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkAccentColor : currentTheme.value.colors.lightAccentColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkAccentColor = v
      } else {
        currentTheme.value.colors.lightAccentColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const cardColor = computed({
    get: () => isDark.value ? currentTheme.value.colors.darkCardColor : currentTheme.value.colors.lightCardColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkCardColor = v
      } else {
        currentTheme.value.colors.lightCardColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })

  async function readTheme(name: string) {
    let theme = await getTheme(name).then(v => v ? deserializeV0(v) : undefined)
    if (!theme) {
      theme = loadV1Theme()
    }
    if (!theme) {
      return undefined
    }
    const ensureRGBAHex = (color: string) => {
      if (color.length === 7) {
        return color + 'FF'
      }
      return color
    }

    theme.colors.darkAppBarColor = ensureRGBAHex(theme.colors.darkAppBarColor)
    theme.colors.darkSideBarColor = ensureRGBAHex(theme.colors.darkSideBarColor)
    theme.colors.darkBackground = ensureRGBAHex(theme.colors.darkBackground)
    theme.colors.darkCardColor = ensureRGBAHex(theme.colors.darkCardColor)

    theme.colors.lightAppBarColor = ensureRGBAHex(theme.colors.lightAppBarColor)
    theme.colors.lightSideBarColor = ensureRGBAHex(theme.colors.lightSideBarColor)
    theme.colors.lightBackground = ensureRGBAHex(theme.colors.lightBackground)
    theme.colors.lightCardColor = ensureRGBAHex(theme.colors.lightCardColor)

    currentTheme.value = theme
  }

  const flushWrite = debounce((name: string, theme: UIThemeDataV1) => {
    setTheme(name, serialize(theme)).then(() => update, () => { })
  }, 800)

  function writeTheme(name: string, theme: UIThemeDataV1) {
    flushWrite(name, theme)
  }

  function resetDarkToDefault() {
    const colors = currentTheme.value.colors
    const defaultColors = getDefaultTheme().colors
    colors.darkAppBarColor = defaultColors.darkAppBarColor
    colors.darkSideBarColor = defaultColors.darkSideBarColor
    colors.darkPrimaryColor = defaultColors.darkPrimaryColor
    colors.darkBackground = defaultColors.darkBackground
    colors.darkInfoColor = defaultColors.darkInfoColor
    colors.darkErrorColor = defaultColors.darkErrorColor
    colors.darkWarningColor = defaultColors.darkWarningColor
    colors.darkSuccessColor = defaultColors.darkSuccessColor
    colors.darkAccentColor = defaultColors.darkAccentColor
    colors.darkCardColor = defaultColors.darkCardColor
    writeTheme(currentTheme.value.name, currentTheme.value)
  }

  function resetLightToDefault() {
    const colors = currentTheme.value.colors
    const defaultColors = getDefaultTheme().colors
    colors.lightAppBarColor = defaultColors.lightAppBarColor
    colors.lightSideBarColor = defaultColors.lightSideBarColor
    colors.lightPrimaryColor = defaultColors.lightPrimaryColor
    colors.lightBackground = defaultColors.lightBackground
    colors.lightInfoColor = defaultColors.lightInfoColor
    colors.lightErrorColor = defaultColors.lightErrorColor
    colors.lightWarningColor = defaultColors.lightWarningColor
    colors.lightSuccessColor = defaultColors.lightSuccessColor
    colors.lightAccentColor = defaultColors.lightAccentColor
    colors.lightCardColor = defaultColors.lightCardColor
    writeTheme(currentTheme.value.name, currentTheme.value)
  }

  function resetToDefault() {
    if (isDark.value) {
      resetDarkToDefault()
    } else {
      resetLightToDefault()
    }
  }

  watch(selectedThemeName, async (themeName) => {
    readTheme(themeName)
  }, { immediate: true })

  async function addMusic(filePath: string) {
    const media = await addMedia(filePath)
    const theme = currentTheme.value
    if (!theme) return
    theme.backgroundMusic.push(media)
    writeTheme(theme.name, theme)
  }

  async function removeMusic(index: number) {
    const theme = currentTheme.value
    if (!theme) return
    const m = theme.backgroundMusic.splice(index, 1)
    if (m) {
      await removeMedia(m[0].url).catch(() => { })
    }
    writeTheme(theme.name, theme)
  }

  async function setBackgroundImage(path: string) {
    const media = await addMedia(path)
    if (media.type !== 'image' && media.type !== 'video') return
    const theme = currentTheme.value
    if (!theme) return
    const old = theme.backgroundImage
    if (old) {
      await removeMedia(old.url).catch(() => { })
    }
    set(theme, 'backgroundImage', media)
    writeTheme(theme.name, theme)
  }

  async function clearBackgroundImage() {
    const theme = currentTheme.value
    if (!theme) return
    if (theme.backgroundImage) {
      await removeMedia(theme.backgroundImage.url).catch(() => { })
      theme.backgroundImage = undefined
      writeTheme(theme.name, theme)
    }
  }

  const font = computed(() => currentTheme.value.font)
  const fontSize = computed({
    get() { return currentTheme.value.fontSize ?? 16 },
    set(v: number) {
      currentTheme.value.fontSize = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })

  async function setFont(path: string) {
    const media = await addMedia(path)
    console.log(media)
    if (media.type !== 'font') return
    const theme = currentTheme.value
    if (!theme) return
    theme.font = media
    writeTheme(theme.name, theme)
  }

  async function resetFont() {
    const theme = currentTheme.value
    if (!theme) return
    if (theme.font) {
      await removeMedia(theme.font.url).catch(() => { })
      theme.font = undefined
      theme.fontSize = 16
      writeTheme(theme.name, theme)
    }
  }

  function _exportTheme(filePath: string) {
    const theme = currentTheme.value
    const serialized: ThemeData = serialize(theme)
    return exportTheme(serialized, filePath)
  }

  async function _importTheme(filePath: string) {
    const data = await importTheme(filePath)
    if (data.ui !== 'keystone') {
      throw new Error('Invalid theme file')
    }
    if (data.version === 0) {
      const themeV1 = deserializeV0(data)
      currentTheme.value = themeV1
      writeTheme(themeV1.name, themeV1)
    } else if (data.version === 1) {
      const themeV1 = deserialize(data)
      currentTheme.value = themeV1
      writeTheme(themeV1.name, themeV1)
    }
  }

  watch(primaryColor, (newColor) => { framework.theme.currentTheme.primary = newColor }, { immediate: true })
  watch(accentColor, (newColor) => { framework.theme.currentTheme.accent = newColor }, { immediate: true })
  watch(infoColor, (newColor) => { framework.theme.currentTheme.info = newColor }, { immediate: true })
  watch(errorColor, (newColor) => { framework.theme.currentTheme.error = newColor }, { immediate: true })
  watch(successColor, (newColor) => { framework.theme.currentTheme.success = newColor }, { immediate: true })
  watch(warningColor, (newColor) => { framework.theme.currentTheme.warning = newColor }, { immediate: true })

  useStyleTag(computed(() => `
  @font-face {
    font-family: 'custom';
    src: url('${font.value?.url}');
  }

  html {
    font-size: ${fontSize.value}px;
  }
  
  .v-application {
    font-family: 'custom', 'Roboto', sans-serif;
  }
  `), {
    immediate: true,
    id: 'font-style',
  })

  useStyleTag(computed(() => `
  :root {
    --color-primary: ${primaryColor.value};
    --color-accent: ${accentColor.value};
    --color-info: ${infoColor.value};
    --color-error: ${errorColor.value};
    --color-success: ${successColor.value};
    --color-warning: ${warningColor.value};
    --color-border: ${isDark.value ? 'hsla(0, 0%, 100%, .12)' : 'hsla(0, 0%, 100%, .12)'};
    --color-highlight-bg: ${isDark.value ? 'hsla(0, 0%, 100%, .12)' : 'hsla(0, 0%, 100%, .12)'};
    --color-secondary-text: ${isDark.value ? 'rgba(156, 163, 175, 1)' : 'rgba(75, 85, 99, 1)'};
    --color-sidebar-bg: ${sideBarColor.value};
    --color-appbar-bg: ${appBarColor.value};
    --color-card-bg: ${cardColor.value};
    --blur-card: ${blurCard.value}px;
  }

  .v-application {
    background-color: ${backgroundColor.value};
  }
  `))

  const backgroundImageOverride = ref('')
  const backgroundImageOverrideOpacity = ref(1)

  return {
    themes,
    isDark,
    currentTheme,
    backgroundImage,
    backgroundImageFit,
    backgroundMusic,
    backgroundType,
    particleMode,
    blurSidebar,
    blurAppBar,
    blurCard,
    volume,
    blur,
    // darkTheme, // This should be removed or replaced by isDark if it was exported
    exportTheme: _exportTheme, // Note: _exportTheme also needs updates for V2
    importTheme: _importTheme, // Note: _importTheme needs significant updates for V2
    backgroundImageOverride,
    backgroundImageOverrideOpacity,
    backgroundColorOverlay,

    appBarColor,
    sideBarColor,
    primaryColor,
    backgroundColor,
    infoColor,
    errorColor,
    warningColor,
    successColor,
    accentColor,
    cardColor,
    resetToDefault,

    font,
    setFont,
    fontSize,
    resetFont,

    removeMusic,
    addMusic,
    setBackgroundImage,
    clearBackgroundImage,
  }
}
