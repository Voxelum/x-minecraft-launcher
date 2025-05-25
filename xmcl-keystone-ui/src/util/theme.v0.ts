import { MediaData, ThemeData } from '@xmcl/runtime-api'
import { BackgroundType, ParticleMode, UIThemeData, UIThemeDataV1 } from '../composables/theme'

export function loadV1Theme(): UIThemeDataV1 {
  const name = localStorage.getItem('selectedThemeName')
  const themeDark = localStorage.getItem('darkTheme')
  const isDark = themeDark === 'dark'
    ? true
    : themeDark === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  const themes = localStorage.getItem('themes')
  const parsed = themes ? JSON.parse(themes) as Record<string, UIThemeData> : {}
  const legacy = parsed[name ?? 'default'] as UIThemeData

  const transformed = getV1Theme(legacy, isDark)
  return transformed
}

export function deserialize(data: ThemeData): UIThemeDataV1 {
  const theme: UIThemeDataV1 = {
    name: data.name,
    backgroundMusic: [],
    colors: {} as any,
    backgroundImageFit: 'cover',
    blur: {},
    dark: false
  }
  if (data.assets.backgroundImage) {
    theme.backgroundImage = data.assets.backgroundImage as MediaData
  }
  if (data.assets.backgroundMusic) {
    theme.backgroundMusic = data.assets.backgroundMusic as MediaData[]
  }
  if (data.settings?.backgroundType) {
    theme.backgroundType = data.settings.backgroundType as BackgroundType
  } else {
    theme.backgroundType = BackgroundType.NONE
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
    theme.blur.background = data.settings.blur as number
  }
  if (data.settings?.blurSidebar) {
    theme.blur.sideBar = data.settings.blurSidebar as number
  }
  if (data.settings?.blurAppBar) {
    theme.blur.appBar = data.settings.blurAppBar as number
  }
  if (data.settings?.backgroundColorOverlay) {
    theme.backgroundColorOverlay = data.settings?.backgroundColorOverlay as boolean
  }
  if (data.assets.font) {
    theme.font = data.assets.font as MediaData
  }
  if (data.settings?.fontSize) {
    theme.fontSize = data.settings.fontSize as number ?? 16
  }
  const dark = !!data.settings?.dark
  if (dark) {
    theme.dark = dark
  }
  if (data.colors) {
    theme.colors = data.colors as any
  }

  return theme
}

function getV1Theme(ui: UIThemeData, dark: boolean) {
  const newData: UIThemeDataV1 = {} as any
  newData.name = ui.name
  newData.colors = ui.colors
  newData.blur = {
    appBar: ui.blurAppBar,
    sideBar: ui.blurSidebar,
    background: ui.blur,
    card: undefined,
  }
  newData.backgroundMusic = ui.backgroundMusic
  newData.backgroundMusicPlayOrder = ui.backgroundMusicPlayOrder
  newData.backgroundImage = ui.backgroundImage
  newData.backgroundColorOverlay = ui.backgroundColorOverlay
  newData.backgroundType = ui.backgroundType
  newData.backgroundVolume = ui.backgroundVolume
  newData.backgroundImageFit = ui.backgroundImageFit
  newData.font = ui.font
  newData.fontSize = ui.fontSize
  newData.particleMode = ui.particleMode
  newData.dark = dark
  return newData
}

export function migrateLegacyTheme(ui: UIThemeData) {
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
