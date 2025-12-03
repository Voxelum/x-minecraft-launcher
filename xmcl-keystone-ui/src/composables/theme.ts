import { injection } from '@/util/inject'
import { loadV1Theme } from '@/util/theme.v0'
import { deserialize, deserialize as deserializeV0, serialize } from '@/util/theme.v1'
import { useStyleTag } from '@vueuse/core'
import { InstanceThemeServiceKey, MediaData, ThemeData, ThemeServiceKey } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref, computed, set } from 'vue'
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

export interface ShimedUIThemeData {
  dark: boolean
  colors: {
    appBarColor: string
    sideBarColor: string
    primaryColor: string
    background: string
    infoColor: string
    errorColor: string
    warningColor: string
    successColor: string
    accentColor: string
    cardColor: string
  }

}

/**
 * Resolve media data from an HTTP URL by querying the content-type header
 */
async function resolveMediaFromUrl(url: string, expectedType: 'audio' | 'video' | 'image' | 'font'): Promise<MediaData> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Invalid URL: must be an HTTP or HTTPS URL')
  }

  let mimeType: string | undefined

  try {
    // Try to get the content-type from the server using HEAD request
    const response = await fetch(url, { method: 'HEAD' })
    const contentType = response.headers.get('content-type')
    if (contentType) {
      // Extract mime type (remove charset and other params)
      mimeType = contentType.split(';')[0].trim()
    }
  } catch {
    // If HEAD request fails, fall back to extension-based detection
  }

  // If we couldn't get mime type from headers, fall back to extension-based detection
  if (!mimeType) {
    const extension = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
    switch (expectedType) {
      case 'image':
        mimeType = extension === 'png' ? 'image/png'
          : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
            : extension === 'gif' ? 'image/gif'
              : extension === 'webp' ? 'image/webp'
                : extension === 'svg' ? 'image/svg+xml'
                  : 'image/png'
        break
      case 'video':
        mimeType = extension === 'mp4' ? 'video/mp4'
          : extension === 'webm' ? 'video/webm'
            : extension === 'ogg' ? 'video/ogg'
              : 'video/mp4'
        break
      case 'audio':
        mimeType = extension === 'mp3' ? 'audio/mpeg'
          : extension === 'ogg' ? 'audio/ogg'
            : extension === 'wav' ? 'audio/wav'
              : extension === 'flac' ? 'audio/flac'
                : 'audio/mpeg'
        break
      case 'font':
        mimeType = extension === 'ttf' ? 'font/ttf'
          : extension === 'otf' ? 'font/otf'
            : extension === 'woff' ? 'font/woff'
              : extension === 'woff2' ? 'font/woff2'
                : 'font/ttf'
        break
    }
  }

  // Determine the actual type from the mime type
  let type: 'audio' | 'video' | 'image' | 'font' = expectedType
  if (mimeType.startsWith('audio/')) type = 'audio'
  else if (mimeType.startsWith('video/')) type = 'video'
  else if (mimeType.startsWith('image/')) type = 'image'
  else if (mimeType.startsWith('font/') || mimeType === 'application/font-woff' || mimeType === 'application/font-woff2') type = 'font'

  return {
    url,
    type,
    mimeType,
  }
}

export interface ThemeWritterOptions {
  /**
   * If provided, media files will be stored under the instance's theme folder.
   * This keeps instance theme media separate from global theme media.
   */
  instancePath?: string
}

export function useThemeWritter(currentTheme: Ref<UIThemeDataV1>, save: () => void, options: ThemeWritterOptions = {}) {
  const { addMedia, removeMedia, exportTheme, importTheme } = useService(ThemeServiceKey)
  const instanceThemeService = useService(InstanceThemeServiceKey)
  const { instancePath } = options

  // Use instance-specific methods when instancePath is provided
  const _addMedia = (filePath: string) => instancePath ? instanceThemeService.addMedia(instancePath, filePath) : addMedia(filePath)
  const _removeMedia = (url: string) => instancePath ? instanceThemeService.removeMedia(instancePath, url) : removeMedia(url)

  const writeTheme = debounce(() => {
    save()
  }, 800)

  // Setter functions
  const isDark = computed({
    get: () => currentTheme.value.dark,
    set: (v: boolean) => {
      currentTheme.value.dark = v
      writeTheme()
    },
  })
  const backgroundType = computed({
    get() { return currentTheme.value.backgroundType ?? BackgroundType.NONE },
    set(v: BackgroundType) {
      currentTheme.value.backgroundType = v
      writeTheme()
    },
  })
  const blur = computed({
    get() { return currentTheme.value.blur?.background ?? 0 },
    set(v: number) {
      if (!currentTheme.value.blur) currentTheme.value.blur = {};
      currentTheme.value.blur.background = v;
      writeTheme();
    },
  })
  const blurCard = computed({
    get() { return currentTheme.value.blur.card ?? 22 },
    set(v: number) {
      currentTheme.value.blur.card = v
      writeTheme()
    }
  })
  const backgroundImage = computed(() => currentTheme.value.backgroundImage)
  const backgroundColorOverlay = computed({
    get() { return currentTheme.value.backgroundColorOverlay ?? false },
    set(v: boolean) {
      currentTheme.value.backgroundColorOverlay = v
      writeTheme()
    },
  })
  const backgroundMusic = computed(() => currentTheme.value.backgroundMusic ?? [])
  const backgroundImageFit = computed({
    get() { return currentTheme.value.backgroundImageFit },
    set(v: 'cover' | 'contain') {
      currentTheme.value.backgroundImageFit = v
      writeTheme()
    },
  })
  const particleMode = computed({
    get() { return currentTheme.value.particleMode ?? ParticleMode.PUSH },
    set(v: ParticleMode) {
      currentTheme.value.particleMode = v
      writeTheme()
    },
  })
  const blurSidebar = computed({
    get() { return currentTheme.value.blur?.sideBar ?? 4 },
    set(v: number) {
      if (!currentTheme.value) return
      if (!currentTheme.value.blur) currentTheme.value.blur = {};
      currentTheme.value.blur.sideBar = v
      writeTheme()
    },
  })
  const blurAppBar = computed({
    get() { return currentTheme.value.blur?.appBar ?? 4 },
    set(v: number) {
      if (!currentTheme.value) return
      if (!currentTheme.value.blur) currentTheme.value.blur = {};
      currentTheme.value.blur.appBar = v
      writeTheme()
    },
  })
  const volume = computed({
    get() { return currentTheme.value.backgroundVolume ?? 0 },
    set(v: number) {
      if (!currentTheme.value) return
      currentTheme.value.backgroundVolume = v
      writeTheme()
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
      writeTheme()
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
      writeTheme()
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
      writeTheme()
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
      writeTheme()
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
      writeTheme()
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
      writeTheme()
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
      writeTheme()
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
      writeTheme()
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
      writeTheme()
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
      writeTheme()
    },
  })
  const font = computed(() => currentTheme.value.font)
  const fontSize = computed({
    get() { return currentTheme.value.fontSize ?? 16 },
    set(v: number) {
      currentTheme.value.fontSize = v
      writeTheme()
    },
  })

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
    writeTheme()
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
    writeTheme()
  }

  function resetToDefault() {
    if (isDark.value) {
      resetDarkToDefault()
    } else {
      resetLightToDefault()
    }
  }

  async function addMusic(filePath: string) {
    const media = await _addMedia(filePath)
    const theme = currentTheme.value
    if (!theme) return
    theme.backgroundMusic.push(media)
    writeTheme()
  }

  async function removeMusic(index: number) {
    const theme = currentTheme.value
    if (!theme) return
    const m = theme.backgroundMusic.splice(index, 1)
    if (m) {
      await _removeMedia(m[0].url).catch(() => { })
    }
    writeTheme()
  }

  async function setBackgroundImage(path: string) {
    const media = await _addMedia(path)
    if (media.type !== 'image' && media.type !== 'video') return
    const theme = currentTheme.value
    if (!theme) return
    const old = theme.backgroundImage
    if (old && old.url.startsWith('http://launcher/')) {
      await _removeMedia(old.url).catch(() => { })
    }
    set(theme, 'backgroundImage', media)
    writeTheme()
  }

  async function setBackgroundImageUrl(url: string, type: 'image' | 'video') {
    const media = await resolveMediaFromUrl(url, type)
    const theme = currentTheme.value
    if (!theme) return
    const old = theme.backgroundImage
    if (old && old.url.startsWith('http://launcher/')) {
      await _removeMedia(old.url).catch(() => { })
    }
    set(theme, 'backgroundImage', media)
    writeTheme()
  }

  async function clearBackgroundImage() {
    const theme = currentTheme.value
    if (!theme) return
    if (theme.backgroundImage) {
      // Only remove local media files
      if (theme.backgroundImage.url.startsWith('http://launcher/')) {
        await _removeMedia(theme.backgroundImage.url).catch(() => { })
      }
      theme.backgroundImage = undefined
      writeTheme()
    }
  }

  async function setFont(path: string) {
    const media = await _addMedia(path)
    console.log(media)
    if (media.type !== 'font') return
    const theme = currentTheme.value
    if (!theme) return
    theme.font = media
    writeTheme()
  }

  async function setFontUrl(url: string) {
    const media = await resolveMediaFromUrl(url, 'font')
    const theme = currentTheme.value
    if (!theme) return
    theme.font = media
    writeTheme()
  }

  async function resetFont() {
    const theme = currentTheme.value
    if (!theme) return
    if (theme.font) {
      // Only remove local media files
      if (theme.font.url.startsWith('http://launcher/')) {
        await _removeMedia(theme.font.url).catch(() => { })
      }
      theme.font = undefined
      theme.fontSize = 16
      writeTheme()
    }
  }

  async function addMusicUrl(url: string) {
    const media = await resolveMediaFromUrl(url, 'audio')
    const theme = currentTheme.value
    if (!theme) return
    theme.backgroundMusic.push(media)
    writeTheme()
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
      writeTheme()
    } else if (data.version === 1) {
      const themeV1 = deserialize(data)
      currentTheme.value = themeV1
      writeTheme()
    }
  }

  return {
    isDark,
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
    font,
    fontSize,
    resetDarkToDefault,
    resetLightToDefault,
    resetToDefault,
    addMusic,
    addMusicUrl,
    removeMusic,
    setBackgroundImage,
    setBackgroundImageUrl,
    clearBackgroundImage,
    setFont,
    setFontUrl,
    resetFont,
    exportTheme: _exportTheme,
    importTheme: _importTheme,
  }
}

export function useTheme(override: Ref<UIThemeDataV1 | undefined>, framework: Framework, { getThemes, getTheme } = useService(ThemeServiceKey)) {
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

  const suppressed = ref(false)

  const targetTheme = computed(() => override.value && !suppressed.value ? override.value : currentTheme.value)

  const isDark = computed(() => targetTheme.value.dark)
  const backgroundType = computed(() => targetTheme.value.backgroundType ?? BackgroundType.NONE)
  const blur = computed(() => targetTheme.value.blur?.background ?? 0)
  const blurCard = computed(() => targetTheme.value.blur?.card ?? 22)
  const backgroundImage = computed(() => targetTheme.value.backgroundImage)
  const backgroundColorOverlay = computed(() => targetTheme.value.backgroundColorOverlay ?? false)
  const backgroundMusic = computed(() => targetTheme.value.backgroundMusic ?? [])
  const backgroundImageFit = computed(() => targetTheme.value.backgroundImageFit)
  const particleMode = computed(() => targetTheme.value.particleMode ?? ParticleMode.PUSH)
  const blurSidebar = computed(() => targetTheme.value.blur?.sideBar ?? 4)
  const blurAppBar = computed(() => targetTheme.value.blur?.appBar ?? 4)
  const volume = computed(() => targetTheme.value.backgroundVolume ?? 0)
  const colors = computed(() => targetTheme.value.colors)
  const appBarColor = computed(() => isDark.value ? colors.value.darkAppBarColor : colors.value.lightAppBarColor ?? '')
  const sideBarColor = computed(() => isDark.value ? colors.value.darkSideBarColor : colors.value.lightSideBarColor ?? '')
  const primaryColor = computed(() => isDark.value ? colors.value.darkPrimaryColor : colors.value.lightPrimaryColor ?? '')
  const backgroundColor = computed(() => isDark.value ? colors.value.darkBackground : colors.value.lightBackground ?? '')
  const infoColor = computed(() => isDark.value ? colors.value.darkInfoColor : colors.value.lightInfoColor ?? '')
  const errorColor = computed(() => isDark.value ? colors.value.darkErrorColor : colors.value.lightErrorColor ?? '')
  const warningColor = computed(() => isDark.value ? colors.value.darkWarningColor : colors.value.lightWarningColor ?? '')
  const successColor = computed(() => isDark.value ? colors.value.darkSuccessColor : colors.value.lightSuccessColor ?? '')
  const accentColor = computed(() => isDark.value ? colors.value.darkAccentColor : colors.value.lightAccentColor ?? '')
  const cardColor = computed(() => isDark.value ? colors.value.darkCardColor : colors.value.lightCardColor ?? '')
  const font = computed(() => targetTheme.value.font)
  const fontSize = computed(() => targetTheme.value.fontSize ?? 16)
  watch(isDark, (dark) => {
    framework.theme.dark = dark
  }, { immediate: true })


  async function readTheme(name: string) {
    let theme = await getTheme(name).then(v => v ? deserializeV0(v) : loadV1Theme())
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

  watch(selectedThemeName, async (themeName) => {
    readTheme(themeName)
  }, { immediate: true })

  watch(primaryColor, (newColor) => { framework.theme.currentTheme.primary = newColor }, { immediate: true })
  watch(accentColor, (newColor) => { framework.theme.currentTheme.accent = newColor }, { immediate: true })
  watch(infoColor, (newColor) => { framework.theme.currentTheme.info = newColor }, { immediate: true })
  watch(errorColor, (newColor) => { framework.theme.currentTheme.error = newColor }, { immediate: true })
  watch(successColor, (newColor) => { framework.theme.currentTheme.success = newColor }, { immediate: true })
  watch(warningColor, (newColor) => { framework.theme.currentTheme.warning = newColor }, { immediate: true })

  const fontFace = computed(() => font.value?.url ? `@font-face {
    font-family: 'custom';
    src: url('${font.value?.url}');
  }` : '')
  useStyleTag(computed(() => `
  ${fontFace.value}
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
    --color-bg: ${backgroundColor.value};
    --blur-card: ${blurCard.value}px;
  }

  html, body {
    background-color: var(--color-bg);
  }

  .v-application {
    background-color: transparent;
  }
  .v-application.dark {
    background-color: transparent;
  }
  .theme--light.v-application{
    background-color: transparent;
  }
  `))

  const backgroundImageOverride = ref('')
  const backgroundImageOverrideOpacity = ref(1)

  return {
    suppressed,
    update,
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
    font,
    fontSize,
  }
}
