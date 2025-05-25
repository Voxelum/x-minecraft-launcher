import { loadV1Theme } from '@/util/theme.v0'
import { deserialize, deserialize as deserializeV0, serialize } from '@/util/theme.v1'
import { useStyleTag } from '@vueuse/core'
import { MediaData, ThemeData, ThemeServiceKey } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, computed, set } from 'vue'
import { Framework } from 'vuetify'
import { useLocalStorageCacheStringValue } from './cache'
import { useService } from './service'

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
    appBar: string
    sideBar: string
    background: string
    card: string

    primary: string
    info: string
    error: string
    warning: string
    success: string
    accent: string
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

function getDefaultDarkTheme(): UIThemeDataV1 {
  return {
    name: 'default-dark',
    dark: true,
    colors: {
      appBar: '#111111FF',
      sideBar: '#11111166',
      background: '#121212FF',
      card: '#0c0c0ccc',

      primary: '#4caf50',
      info: '#2196F3',
      error: '#FF5252',
      warning: '#FB8C00',
      success: '#4CAF50',
      accent: '#00e676',
    },
    blur: {
      appBar: 3,
      sideBar: 3,
      background: 3,
    },
    backgroundMusic: [],
    backgroundMusicPlayOrder: 'sequential',
    backgroundImageFit: 'cover',
    backgroundType: BackgroundType.NONE,
    backgroundVolume: 1,
  }
}

function getDefaultLightTheme(): UIThemeDataV1 {
  return {
    name: 'default-light',
    dark: false,
    colors: {
      appBar: '#e0e0e0FF',
      sideBar: '#FFFFFFFF',
      background: '#FFFFFFFF',
      card: '#e0e0e080',

      primary: '#1976D2',
      info: '#2196F3',
      error: '#FF5252',
      warning: '#FB8C00',
      success: '#4CAF50',
      accent: '#82B1FF',
    },
    blur: {
      appBar: 3,
      sideBar: 3,
      background: 3,
    },
    backgroundMusic: [],
    backgroundMusicPlayOrder: 'sequential',
    backgroundImageFit: 'cover',
    backgroundType: BackgroundType.NONE,
    backgroundVolume: 1,
  }
}

export function useThemes() {
  const themes = ref<UIThemeDataV1[]>([])
  const { getThemes } = useService(ThemeServiceKey)
  function update() {
    getThemes().then((v) => {
      themes.value = v.map((theme) => {
        const t = deserialize(theme)
        if (!t) return getDefaultDarkTheme()
        return t
      })
    })
  }
  onMounted(update)
  return {
    themes,
    update
  }
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
  const currentTheme = ref<UIThemeDataV1>(getDefaultDarkTheme())
  const isDark = computed(() => currentTheme.value.dark)
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
    get: () => currentTheme.value.colors.appBar ?? '',
    set: (v: string) => {
      currentTheme.value.colors.appBar = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const sideBarColor = computed({
    get: () => currentTheme.value.colors.sideBar ?? '',
    set: (v: string) => {
      currentTheme.value.colors.sideBar = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const primaryColor = computed({
    get: () => currentTheme.value.colors.primary ?? '',
    set: (v: string) => {
      currentTheme.value.colors.primary = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const backgroundColor = computed({
    get: () => currentTheme.value.colors.background ?? '',
    set: (v: string) => {
      currentTheme.value.colors.background = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const infoColor = computed({
    get: () => currentTheme.value.colors.info ?? '',
    set: (v: string) => {
      currentTheme.value.colors.info = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const errorColor = computed({
    get: () => currentTheme.value.colors.error ?? '',
    set: (v: string) => {
      currentTheme.value.colors.error = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const warningColor = computed({
    get: () => currentTheme.value.colors.warning ?? '',
    set: (v: string) => {
      currentTheme.value.colors.warning = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const successColor = computed({
    get: () => currentTheme.value.colors.success ?? '',
    set: (v: string) => {
      currentTheme.value.colors.success = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const accentColor = computed({
    get: () => currentTheme.value.colors.accent ?? '',
    set: (v: string) => {
      currentTheme.value.colors.accent = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const cardColor = computed({
    get: () => currentTheme.value.colors.card ?? '',
    set: (v: string) => {
      currentTheme.value.colors.card = v
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

    theme.colors.appBar = ensureRGBAHex(theme.colors.appBar)
    theme.colors.sideBar = ensureRGBAHex(theme.colors.sideBar)
    theme.colors.background = ensureRGBAHex(theme.colors.background)
    theme.colors.card = ensureRGBAHex(theme.colors.card)

    currentTheme.value = theme
  }

  const flushWrite = debounce((name: string, theme: UIThemeDataV1) => {
    setTheme(name, serialize(theme)).catch((e) => { })
  }, 800)

  function writeTheme(name: string, theme: UIThemeDataV1) {
    flushWrite(name, theme)
  }

  function resetDarkToDefault() {
    const colors = currentTheme.value.colors
    const defaultColors = getDefaultDarkTheme().colors
    colors.appBar = defaultColors.appBar
    colors.sideBar = defaultColors.sideBar
    colors.primary = defaultColors.primary
    colors.background = defaultColors.background
    colors.info = defaultColors.info
    colors.error = defaultColors.error
    colors.warning = defaultColors.warning
    colors.success = defaultColors.success
    colors.accent = defaultColors.accent
    colors.card = defaultColors.card
    writeTheme(currentTheme.value.name, currentTheme.value)
  }

  function resetLightToDefault() {
    const colors = currentTheme.value.colors
    const defaultColors = getDefaultLightTheme().colors
    colors.appBar = defaultColors.appBar
    colors.sideBar = defaultColors.sideBar
    colors.primary = defaultColors.primary
    colors.background = defaultColors.background
    colors.info = defaultColors.info
    colors.error = defaultColors.error
    colors.warning = defaultColors.warning
    colors.success = defaultColors.success
    colors.accent = defaultColors.accent
    colors.card = defaultColors.card
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
  }

  .v-application {
    background-color: ${backgroundColor.value};
  }
  `))

  const backgroundImageOverride = ref('')
  const backgroundImageOverrideOpacity = ref(1)

  return {
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
