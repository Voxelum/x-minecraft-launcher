import { MediaData, ThemeServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, computed } from 'vue'
import { Framework } from 'vuetify'
import { useLocalStorageCache, useLocalStorageCacheStringValue } from './cache'
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
  backgroundType?: BackgroundType
  backgroundVolume?: number
  backgroundImageFit: 'cover' | 'contain'
  font?: MediaData
  particleMode?: ParticleMode
  blur: number
  blurSidebar?: number
  blurAppBar?: number
}

export function useTheme(framework: Framework) {
  const { addMedia, removeMedia } = useService(ThemeServiceKey)

  const selectedThemeName = useLocalStorageCacheStringValue('selectedThemeName', 'default')
  const darkTheme = useLocalStorageCache<boolean | 'system'>('darkTheme', () => 'system' as boolean | 'system', (v) => v === 'system' ? v : v ? 'true' : 'false', (v) => v === 'system' ? v : Boolean(v))
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
    backgroundImageFit: 'cover',
    blur: 4,
  })
  const isDark = computed(() => {
    if (darkTheme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return darkTheme.value
  })
  watch(isDark, (dark) => {
    framework.theme.dark = dark
  })

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

  const cssVars = computed(() => ({
    '--primary': primaryColor.value,
    'background-color': backgroundColor.value,
  }))

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
    return parsed[name]
  }

  function writeTheme(name: string, theme: UIThemeData) {
    const themes = localStorage.getItem('themes')
    const parsed = themes ? JSON.parse(themes) as Record<string, UIThemeData> : {}
    parsed[name] = theme
    localStorage.setItem('themes', JSON.stringify(parsed))
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
      await removeMedia(m[0].url)
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
      await removeMedia(old.url)
    }
    theme.backgroundImage = media
    writeTheme(theme.name, theme)
  }

  async function clearBackgroundImage() {
    const theme = currentTheme.value
    if (!theme) return
    if (theme.backgroundImage) {
      await removeMedia(theme.backgroundImage.url)
      theme.backgroundImage = undefined
      writeTheme(theme.name, theme)
    }
  }

  if (primaryColor.value) { framework.theme.currentTheme.primary = primaryColor.value }
  if (accentColor.value) { framework.theme.currentTheme.accent = accentColor.value }
  if (infoColor.value) { framework.theme.currentTheme.info = infoColor.value }
  if (errorColor.value) { framework.theme.currentTheme.error = errorColor.value }
  if (successColor.value) { framework.theme.currentTheme.success = successColor.value }
  if (warningColor.value) { framework.theme.currentTheme.warning = warningColor.value }

  watch(primaryColor, (newColor) => { framework.theme.currentTheme.primary = newColor })
  watch(accentColor, (newColor) => { framework.theme.currentTheme.accent = newColor })
  watch(infoColor, (newColor) => { framework.theme.currentTheme.info = newColor })
  watch(errorColor, (newColor) => { framework.theme.currentTheme.error = newColor })
  watch(successColor, (newColor) => { framework.theme.currentTheme.success = newColor })
  watch(warningColor, (newColor) => { framework.theme.currentTheme.warning = newColor })

  return {
    isDark,
    currentTheme,
    backgroundImage,
    backgroundImageFit,
    backgroundType,
    particleMode,
    blurSidebar,
    blurAppBar,
    volume,
    blur,

    cssVars,
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

    removeMusic,
    addMusic,
    setBackgroundImage,
    clearBackgroundImage,
  }
}
