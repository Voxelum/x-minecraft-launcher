import { BackgroundType, UIThemeDataV1, getDefaultTheme } from '@/composables/theme'
import { MediaData, ThemeData } from '@xmcl/runtime-api'

export function serialize(theme: UIThemeDataV1) {
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
    if (theme.blur.background !== undefined) {
      settings.blur = theme.blur.background; // Assuming ThemeData.settings.blur is for background
    }
    if (theme.blur.sideBar !== undefined) {
      settings.blurSidebar = theme.blur.sideBar; // Assuming ThemeData.settings.blurSidebar exists
    }
    if (theme.blur.appBar !== undefined) {
      settings.blurAppBar = theme.blur.appBar; // Assuming ThemeData.settings.blurAppBar exists
    }
    if (theme.blur.card !== undefined) {
      settings.blurCard = theme.blur.card;
    }
  }
  if (theme.backgroundColorOverlay) {
    settings.backgroundColorOverlay = theme.backgroundColorOverlay
  }
  if (theme.fontSize) {
    settings.fontSize = theme.fontSize
  }
  settings.dark = theme.dark
  const serialized: ThemeData = {
    name: theme.name,
    ui: 'keystone',
    version: 1,
    assets,
    colors: theme.colors,
    settings,
  }
  return serialized
}

export function deserialize(data: ThemeData): UIThemeDataV1 {
  const defaultColors = getDefaultTheme().colors
  const theme: UIThemeDataV1 = {
    name: data.name,
    dark: !!(data.settings?.dark),
    colors: {
      lightAppBarColor: data.colors?.lightAppBarColor ?? defaultColors.lightAppBarColor,
      lightSideBarColor: data.colors?.lightSideBarColor ?? defaultColors.lightSideBarColor,
      darkAppBarColor: data.colors?.darkAppBarColor ?? defaultColors.darkAppBarColor,
      darkSideBarColor: data.colors?.darkSideBarColor ?? defaultColors.darkSideBarColor,
      darkPrimaryColor: data.colors?.darkPrimaryColor ?? defaultColors.darkPrimaryColor,
      darkBackground: data.colors?.darkBackground ?? defaultColors.darkBackground,
      darkInfoColor: data.colors?.darkInfoColor ?? defaultColors.darkInfoColor,
      darkErrorColor: data.colors?.darkErrorColor ?? defaultColors.darkErrorColor,
      darkWarningColor: data.colors?.darkWarningColor ?? defaultColors.darkWarningColor,
      darkSuccessColor: data.colors?.darkSuccessColor ?? defaultColors.darkSuccessColor,
      darkAccentColor: data.colors?.darkAccentColor ?? defaultColors.darkAccentColor,
      darkCardColor: data.colors?.darkCardColor ?? defaultColors.darkCardColor,
      lightPrimaryColor: data.colors?.lightPrimaryColor ?? defaultColors.lightPrimaryColor,
      lightBackground: data.colors?.lightBackground ?? defaultColors.lightBackground,
      lightInfoColor: data.colors?.lightInfoColor ?? defaultColors.lightInfoColor,
      lightErrorColor: data.colors?.lightErrorColor ?? defaultColors.lightErrorColor,
      lightWarningColor: data.colors?.lightWarningColor ?? defaultColors.lightWarningColor,
      lightSuccessColor: data.colors?.lightSuccessColor ?? defaultColors.lightSuccessColor,
      lightAccentColor: data.colors?.lightAccentColor ?? defaultColors.lightAccentColor,
      lightCardColor: data.colors?.lightCardColor ?? defaultColors.lightCardColor,
    },
    backgroundMusic: [],
    backgroundMusicPlayOrder: 'sequential',
    backgroundImageFit: 'cover',
    backgroundType: BackgroundType.NONE,
    backgroundVolume: 1,
    blur: {},
  }
  if (data.assets.backgroundImage) {
    theme.backgroundImage = data.assets.backgroundImage as MediaData
  }
  if (data.assets.backgroundMusic) {
    theme.backgroundMusic = data.assets.backgroundMusic as MediaData[]
  }
  if (data.assets.font) {
    theme.font = data.assets.font as MediaData
  }
  if (data.settings) {
    if (data.settings.backgroundVolume) {
      theme.backgroundVolume = data.settings.backgroundVolume as number
    }
    if (data.settings.backgroundMusicPlayOrder) {
      theme.backgroundMusicPlayOrder = data.settings.backgroundMusicPlayOrder as any
    }
    if (data.settings.backgroundColorOverlay) {
      theme.backgroundColorOverlay = data.settings.backgroundColorOverlay as any
    }
    if (data.settings.fontSize) {
      theme.fontSize = data.settings.fontSize as number
    }
    if (data.settings.backgroundType) {
      theme.backgroundType = data.settings.backgroundType as any
    }
    if (data.settings.backgroundImageFit) {
      theme.backgroundImageFit = data.settings.backgroundImageFit as any
    }
    if (data.settings.particleMode) {
      theme.particleMode = data.settings.particleMode as any
    }
    if (data.settings.blur) {
      theme.blur.background = data.settings.blur as any
    }
    if (data.settings.blurSidebar) {
      theme.blur.sideBar = data.settings.blurSidebar as any
    }
    if (data.settings.blurAppBar) {
      theme.blur.appBar = data.settings.blurAppBar as any
    }
    if (data.settings.blurCard) {
      theme.blur.card = data.settings.blurCard as any
    }
  }
  return theme
}