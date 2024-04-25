import { useStyleTag } from '@vueuse/core'
import { MediaData, ThemeData, ThemeServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, computed, set } from 'vue'
import { Framework } from 'vuetify'
import { useLocalStorageCacheStringValue } from './cache'
import { useService } from './service'
import debounce from 'lodash.debounce'

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
  particleMode?: ParticleMode
  blur: number
  blurSidebar?: number
  blurAppBar?: number
}

export function useTheme(framework: Framework, { addMedia, removeMedia, exportTheme, importTheme } = useService(ThemeServiceKey)) {
  const selectedThemeName = useLocalStorageCacheStringValue('selectedThemeName', 'default' as string)
  const darkTheme = useLocalStorageCacheStringValue<'dark' | 'light' | 'system'>('darkTheme', 'system')
  const currentTheme = ref<UIThemeData>({
    name: 'default',
    backgroundMusic: [],
    backgroundMusicPlayOrder: 'sequential',
    colors: {
      lightAppBarColor: '#e0e0e0FF',
      lightSideBarColor: '#FFFFFFFF',
      darkAppBarColor: '#111111FF',
      darkSideBarColor: '#111111FF',
      darkPrimaryColor: '#4caf50',
      darkBackground: '#121212',
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
    backgroundColorOverlay: false,
    backgroundVolume: 1,
    backgroundImage: undefined,
    backgroundImageFit: 'cover',
    font: undefined,
    blur: 4,
    blurSidebar: 0,
    blurAppBar: 0,
  })
  const isDark = computed(() => {
    if (darkTheme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return darkTheme.value === 'dark'
  })
  watch(isDark, (dark) => {
    framework.theme.dark = dark
  }, { immediate: true })

  const backgroundType = computed({
    get() { return currentTheme.value?.backgroundType ?? BackgroundType.NONE },
    set(v: BackgroundType) {
      if (!currentTheme.value) return
      currentTheme.value.backgroundType = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const blur = computed({
    get() { return currentTheme.value.blur },
    set(v: number) {
      currentTheme.value.blur = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const backgroundImage = computed(() => currentTheme.value?.backgroundImage)
  const backgroundColorOverlay = computed({
    get() { return currentTheme.value?.backgroundColorOverlay ?? false },
    set(v: boolean) {
      currentTheme.value.backgroundColorOverlay = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const backgroundMusic = computed(() => currentTheme.value?.backgroundMusic ?? [])
  const backgroundImageFit = computed({
    get() { return currentTheme.value.backgroundImageFit },
    set(v: 'cover' | 'contain') {
      currentTheme.value.backgroundImageFit = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const particleMode = computed({
    get() { return currentTheme.value?.particleMode ?? ParticleMode.PUSH },
    set(v: ParticleMode) {
      currentTheme.value.particleMode = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const blurSidebar = computed({
    get() { return currentTheme.value?.blurSidebar ?? 4 },
    set(v: number) {
      if (!currentTheme.value) return
      currentTheme.value.blurSidebar = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const blurAppBar = computed({
    get() { return currentTheme.value?.blurAppBar ?? 4 },
    set(v: number) {
      if (!currentTheme.value) return
      currentTheme.value.blurAppBar = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })
  const volume = computed({
    get() { return currentTheme.value?.backgroundVolume ?? 0 },
    set(v: number) {
      if (!currentTheme.value) return
      currentTheme.value.backgroundVolume = v
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })

  const appBarColor = computed({
    get: () => isDark.value ? currentTheme.value?.colors.darkAppBarColor : currentTheme.value?.colors.lightAppBarColor ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkSideBarColor : currentTheme.value?.colors.lightSideBarColor ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkPrimaryColor : currentTheme.value?.colors.lightPrimaryColor ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkBackground : currentTheme.value?.colors.lightBackground ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkInfoColor : currentTheme.value?.colors.lightInfoColor ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkErrorColor : currentTheme.value?.colors.lightErrorColor ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkWarningColor : currentTheme.value?.colors.lightWarningColor ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkSuccessColor : currentTheme.value?.colors.lightSuccessColor ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkAccentColor : currentTheme.value?.colors.lightAccentColor ?? '',
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
    get: () => isDark.value ? currentTheme.value?.colors.darkCardColor : currentTheme.value?.colors.lightCardColor ?? '',
    set: (v: string) => {
      if (isDark.value) {
        currentTheme.value.colors.darkCardColor = v
      } else {
        currentTheme.value.colors.lightCardColor = v
      }
      writeTheme(currentTheme.value.name, currentTheme.value)
    },
  })

  function migrateLegacyTheme(ui: UIThemeData) {
    const readNum = (key: string) => {
      const v = localStorage.getItem(key)
      if (v) {
        localStorage.removeItem(key)
        return parseInt(v)
      }
      return undefined
    }
    const blur = readNum('blur')
    const backgroundType = localStorage.getItem('backgroundType') as BackgroundType
    const backgroundImage = localStorage.getItem('background')
    const imageFill = localStorage.getItem('imageFill') as 'cover' | 'contain'
    const particleMode = localStorage.getItem('particleMode') as ParticleMode
    const backgroundVideo = localStorage.getItem('backgroundVideo')
    const videoVolume = readNum('volume')
    const blurSidebar = readNum('blurSidebar')
    const blurAppBar = readNum('blurAppBar')

    const lightAppBarColor = localStorage.getItem('lightAppBarColor')
    const lightSideBarColor = localStorage.getItem('lightSideBarColor')
    const darkAppBarColor = localStorage.getItem('darkAppBarColor')
    const darkSideBarColor = localStorage.getItem('darkSideBarColor')
    const darkPrimaryColor = localStorage.getItem('darkPrimaryColor')
    const darkBackground = localStorage.getItem('darkBackground')
    const darkInfoColor = localStorage.getItem('darkInfoColor')
    const darkErrorColor = localStorage.getItem('darkErrorColor')
    const darkWarningColor = localStorage.getItem('darkWarningColor')
    const darkSuccessColor = localStorage.getItem('darkSuccessColor')
    const darkAccentColor = localStorage.getItem('darkAccentColor')
    const darkCardColor = localStorage.getItem('darkCardColor')
    const lightPrimaryColor = localStorage.getItem('lightPrimaryColor')
    const lightBackground = localStorage.getItem('lightBackground')
    const lightInfoColor = localStorage.getItem('lightInfoColor')
    const lightErrorColor = localStorage.getItem('lightErrorColor')
    const lightWarningColor = localStorage.getItem('lightWarningColor')
    const lightSuccessColor = localStorage.getItem('lightSuccessColor')
    const lightAccentColor = localStorage.getItem('lightAccentColor')
    const lightCardColor = localStorage.getItem('lightCardColor')

    if (lightAppBarColor) ui.colors.lightAppBarColor = lightAppBarColor
    if (lightSideBarColor) ui.colors.lightSideBarColor = lightSideBarColor
    if (darkAppBarColor) ui.colors.darkAppBarColor = darkAppBarColor
    if (darkSideBarColor) ui.colors.darkSideBarColor = darkSideBarColor
    if (darkPrimaryColor) ui.colors.darkPrimaryColor = darkPrimaryColor
    if (darkBackground) ui.colors.darkBackground = darkBackground
    if (darkInfoColor) ui.colors.darkInfoColor = darkInfoColor
    if (darkErrorColor) ui.colors.darkErrorColor = darkErrorColor
    if (darkWarningColor) ui.colors.darkWarningColor = darkWarningColor
    if (darkSuccessColor) ui.colors.darkSuccessColor = darkSuccessColor
    if (darkAccentColor) ui.colors.darkAccentColor = darkAccentColor
    if (darkCardColor) ui.colors.darkCardColor = darkCardColor
    if (lightPrimaryColor) ui.colors.lightPrimaryColor = lightPrimaryColor
    if (lightBackground) ui.colors.lightBackground = lightBackground
    if (lightInfoColor) ui.colors.lightInfoColor = lightInfoColor
    if (lightErrorColor) ui.colors.lightErrorColor = lightErrorColor
    if (lightWarningColor) ui.colors.lightWarningColor = lightWarningColor
    if (lightSuccessColor) ui.colors.lightSuccessColor = lightSuccessColor
    if (lightAccentColor) ui.colors.lightAccentColor = lightAccentColor
    if (lightCardColor) ui.colors.lightCardColor = lightCardColor

    if (backgroundType) ui.backgroundType = backgroundType
    if (backgroundImage && backgroundType === BackgroundType.IMAGE) ui.backgroundImage = { url: backgroundImage, type: 'image', mimeType: 'image/png' }
    else if (backgroundVideo && backgroundType === BackgroundType.VIDEO) ui.backgroundImage = { url: backgroundVideo, type: 'video', mimeType: 'video/mp4' }
    if (imageFill) ui.backgroundImageFit = imageFill
    if (particleMode) ui.particleMode = particleMode
    if (videoVolume) ui.backgroundVolume = videoVolume
    if (blurSidebar) ui.blurSidebar = blurSidebar
    if (blurAppBar) ui.blurAppBar = blurAppBar
    if (blur) ui.blur = blur
  }

  function readTheme(name: string) {
    const themes = localStorage.getItem('themes')
    if (!themes) return
    const parsed = JSON.parse(themes) as Record<string, UIThemeData>

    const ensureRGBAHex = (color: string) => {
      if (color.length === 7) {
        return color + 'FF'
      }
      return color
    }

    const theme = parsed[name]

    theme.colors.lightAppBarColor = ensureRGBAHex(theme.colors.lightAppBarColor)
    theme.colors.lightSideBarColor = ensureRGBAHex(theme.colors.lightSideBarColor)
    theme.colors.darkAppBarColor = ensureRGBAHex(theme.colors.darkAppBarColor)
    theme.colors.darkSideBarColor = ensureRGBAHex(theme.colors.darkSideBarColor)
    theme.colors.lightBackground = ensureRGBAHex(theme.colors.lightBackground)
    theme.colors.darkBackground = ensureRGBAHex(theme.colors.darkBackground)

    return theme
  }

  const flushWrite = debounce((name: string, theme: UIThemeData) => {
    const themes = localStorage.getItem('themes')
    const parsed = themes ? JSON.parse(themes) as Record<string, UIThemeData> : {}
    parsed[name] = theme
    console.log(theme)
    localStorage.setItem('themes', JSON.stringify(parsed))
  }, 800)

  function writeTheme(name: string, theme: UIThemeData) {
    flushWrite(name, theme)
  }

  function resetDarkToDefault() {
    const colors = currentTheme.value.colors
    colors.darkAppBarColor = '#111111FF'
    colors.darkSideBarColor = '#111111FF'
    colors.darkPrimaryColor = '#4caf50'
    colors.darkBackground = '#121212'
    colors.darkInfoColor = '#2196F3'
    colors.darkErrorColor = '#FF5252'
    colors.darkWarningColor = '#FB8C00'
    colors.darkSuccessColor = '#4CAF50'
    colors.darkAccentColor = '#00e676'
    colors.darkCardColor = '#0c0c0ccc'
  }

  function resetLightToDefault() {
    const colors = currentTheme.value.colors
    colors.lightAppBarColor = '#e0e0e0FF'
    colors.lightSideBarColor = '#FFFFFFFF'
    colors.lightPrimaryColor = '#1976D2'
    colors.lightBackground = '#FFFFFF'
    colors.lightInfoColor = '#2196F3'
    colors.lightErrorColor = '#FF5252'
    colors.lightWarningColor = '#FB8C00'
    colors.lightSuccessColor = '#4CAF50'
    colors.lightAccentColor = '#82B1FF'
    colors.lightCardColor = '#e0e0e080'
  }

  function resetToDefault() {
    if (darkTheme.value) {
      resetDarkToDefault()
    } else {
      resetLightToDefault()
    }
  }

  watch(selectedThemeName, async (theme) => {
    const t = readTheme(theme)
    if (t) {
      currentTheme.value = t
    } else {
      migrateLegacyTheme(currentTheme.value)
    }
  }, { immediate: true })

  async function addMusic(filePath: string) {
    const media = await addMedia(filePath)
    const theme = currentTheme.value
    if (!theme) return
    theme.backgroundMusic?.push(media)
    writeTheme(theme.name, theme)
  }

  async function removeMusic(index: number) {
    const theme = currentTheme.value
    if (!theme) return
    const m = theme.backgroundMusic?.splice(index, 1)
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

  const font = computed(() => currentTheme.value?.font)

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
      writeTheme(theme.name, theme)
    }
  }

  function _exportTheme(filePath: string) {
    const theme = currentTheme.value
    const assets: Record<string, MediaData | MediaData[]> = {}
    if (theme.backgroundImage) {
      assets.backgroundImage = theme.backgroundImage
    }
    if (theme.backgroundMusic) {
      assets.backgroundMusic = theme.backgroundMusic
    }
    if (theme.font) {
      assets.font = theme.font
    }
    const settings: ThemeData['settings'] = {}
    if (theme.backgroundType) {
      settings.backgroundType = theme.backgroundType
    }
    if (theme.backgroundImageFit) {
      settings.backgroundImageFit = theme.backgroundImageFit
    }
    if (theme.backgroundMusicPlayOrder) {
      settings.backgroundMusicPlayOrder = theme.backgroundMusicPlayOrder
    }
    if (theme.backgroundVolume) {
      settings.backgroundVolume = theme.backgroundVolume
    }
    if (theme.particleMode) {
      settings.particleMode = theme.particleMode
    }
    if (theme.blur) {
      settings.blur = theme.blur
    }
    if (theme.blurSidebar) {
      settings.blurSidebar = theme.blurSidebar
    }
    if (theme.blurAppBar) {
      settings.blurAppBar = theme.blurAppBar
    }
    if (theme.backgroundColorOverlay) {
      settings.backgroundColorOverlay = theme.backgroundColorOverlay
    }
    settings.dark = isDark.value
    const serialized: ThemeData = {
      name: theme.name,
      ui: 'keystone',
      version: 0,
      assets,
      colors: theme.colors,
      settings,
    }
    return exportTheme(serialized, filePath)
  }

  async function _importTheme(filePath: string) {
    const data = await importTheme(filePath)
    if (data.ui !== 'keystone') {
      throw new Error('Invalid theme file')
    }
    const theme: UIThemeData = {
      name: data.name,
      backgroundMusic: [],
      colors: data.colors as any,
      backgroundImageFit: 'cover',
      blur: 4,
    }
    if (data.assets.backgroundImage) {
      theme.backgroundImage = data.assets.backgroundImage as MediaData
    }
    if (data.assets.backgroundMusic) {
      theme.backgroundMusic = data.assets.backgroundMusic as MediaData[]
    }
    if (data.settings?.backgroundType) {
      theme.backgroundType = data.settings.backgroundType as BackgroundType
    }
    if (data.settings?.backgroundImageFit) {
      theme.backgroundImageFit = data.settings.backgroundImageFit as 'cover' | 'contain'
    }
    if (data.settings?.backgroundMusicPlayOrder) {
      theme.backgroundMusicPlayOrder = data.settings.backgroundMusicPlayOrder as 'sequential' | 'shuffle'
    }
    if (data.settings?.backgroundVolume) {
      theme.backgroundVolume = data.settings.backgroundVolume as number
    }
    if (data.settings?.particleMode) {
      theme.particleMode = data.settings.particleMode as ParticleMode
    }
    if (data.settings?.blur) {
      theme.blur = data.settings.blur as number
    }
    if (data.settings?.blurSidebar) {
      theme.blurSidebar = data.settings.blurSidebar as number
    }
    if (data.settings?.blurAppBar) {
      theme.blurAppBar = data.settings.blurAppBar as number
    }
    if (data.settings?.backgroundColorOverlay) {
      theme.backgroundColorOverlay = data.settings?.backgroundColorOverlay as boolean
    }
    if (data.assets.font) {
      theme.font = data.assets.font as MediaData
    }
    if (data.settings?.dark) {
      darkTheme.value = data.settings.dark ? 'dark' : 'light'
    } else {
      darkTheme.value = 'light'
    }
    writeTheme(theme.name, theme)
    currentTheme.value = theme
    selectedThemeName.value = theme.name
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
    volume,
    blur,
    darkTheme,
    exportTheme: _exportTheme,
    importTheme: _importTheme,
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
    resetFont,

    removeMusic,
    addMusic,
    setBackgroundImage,
    clearBackgroundImage,
  }
}
