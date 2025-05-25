import { BackgroundType, UIThemeDataV1 } from '@/composables/theme'
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
  const theme: UIThemeDataV1 = {
    name: data.name,
    dark: !!(data.settings?.dark),
    colors: {
      appBar: data.colors?.appBar ?? '#111111FF',
      sideBar: data.colors?.sideBar ?? '#11111166',
      background: data.colors?.background ?? '#121212FF',
      card: data.colors?.card ?? '#0c0c0ccc',

      primary: data.colors?.primary ?? '#4caf50',
      info: data.colors?.info ?? '#2196F3',
      error: data.colors?.error ?? '#FF5252',
      warning: data.colors?.warning ?? '#FB8C00',
      success: data.colors?.success ?? '#4CAF50',
      accent: data.colors?.accent ?? '#00e676',
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