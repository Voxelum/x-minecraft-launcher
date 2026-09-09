/**
 * Provide function to {@link parse} the options.txt and also {@link stringify} it into the string.
 *
 * @packageDocumentation
 * @module @xmcl/gamesetting
 */

/**
 * The AmbientOcclusion enum value in options.txt
 */
export enum AmbientOcclusion {
  Off = 0,
  Minimum = 1,
  Maximum = 2,
}
export enum Particles {
  Minimum = 2,
  Decreased = 1,
  All = 0,
}
export enum Difficulty {
  Peaceful = 0,
  Easy = 1,
  Normal = 2,
  Hard = 3,
}
export type MipmapLevel = 0 | 1 | 2 | 3 | 4
export type RenderDistance =
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32
export const RenderDistances = Object.freeze({ Tiny: 2, Short: 4, Normal: 8, Far: 16, Extreme: 32 })
export const Graphics = Object.freeze({ Fast: false, Fancy: true })
export type Graphic = boolean
export const RenderClouds = Object.freeze({ Off: false, Fast: 'fast', Fancy: true })
export type RenderCloud = true | false | 'fast'

export enum KeyCode {
  'Escape' = 1,
  'Digit1' = 2,
  'Digit2' = 3,
  'Digit3' = 4,
  'Digit4' = 5,
  'Digit5' = 6,
  'Digit6' = 7,
  'Digit7' = 8,
  'Digit8' = 9,
  'Digit9' = 10,
  'Digit0' = 11,
  'Minus' = 12,
  'Equal' = 13,
  'Backspace' = 14,
  'Tab' = 15,

  'KeyQ' = 16,
  'KeyW' = 17,
  'KeyE' = 18,
  'KeyR' = 19,
  'KeyT' = 20,
  'KeyY' = 21,
  'KeyU' = 22,
  'KeyI' = 23,
  'KeyO' = 24,
  'KeyP' = 25,

  'BracketLeft' = 26,
  'BracketRight' = 27,
  'Enter' = 28,
  'ControlLeft' = 29,

  'KeyA' = 30,
  'KeyS' = 31,
  'KeyD' = 32,
  'KeyF' = 33,
  'KeyG' = 34,
  'KeyH' = 35,
  'KeyJ' = 36,
  'KeyK' = 37,
  'KeyL' = 38,

  'Semicolon' = 39,
  'Quote' = 40,
  'Backquote' = 41,
  'ShiftLeft' = 42,
  'Backslash' = 43,

  'KeyZ' = 44,
  'KeyX' = 45,
  'KeyC' = 46,
  'KeyV' = 47,
  'KeyB' = 48,
  'KeyN' = 49,
  'KeyM' = 50,

  'Comma' = 51,
  'Period' = 52,
  'Slash' = 53,
  'ShiftRight' = 54,

  'Space' = 57,
  'CapsLock' = 58,

  'F1' = 59,
  'F2' = 60,
  'F3' = 61,
  'F4' = 62,
  'F5' = 63,
  'F6' = 64,
  'F7' = 65,
  'F8' = 66,
  'F9' = 67,
  'F10' = 68,

  'NumLock' = 69,
  'ScrollLock' = 70,
  'Numpad7' = 71,
  'Numpad8' = 72,
  'Numpad9' = 73,
  'NumpadSubtract' = 74,
  'Numpad4' = 75,
  'Numpad5' = 76,
  'Numpad6' = 77,
  'NumpadAdd' = 78,
  'Numpad1' = 79,
  'Numpad2' = 80,
  'Numpad3' = 81,
  'Numpad0' = 82,
  'NumpadDecimal' = 83,
  'F11' = 87,
  'F12' = 88,
  'F13' = 100,
  'F14' = 101,
  'F15' = 102,
  'F16' = 103,
  'F17' = 104,
  'F18' = 105,

  'ControlRight' = 157,

  'ArrowUp' = 200,
  'ArrowLeft' = 203,
  'ArrowRight' = 205,
  'ArrowDown' = 208,

  'MULTIPLY' = 55,
  'Left Menu/Alt' = 56,

  'NumpadEnter' = 156,
  'NumpadComma' = 179,

  'Home' = 199,
  'PageUp' = 201,
  'End' = 207,
  'PageDown' = 209,
  'Insert' = 210,
  'Delete' = 211,

  'MouseLeft' = -100,
  'MouseRight' = -99,
  'MouseMiddle' = -98,
}

const DEFAULT_FRAME = {
  version: 1139, // for 1.12
  invertYMouse: false,
  mouseSensitivity: 0.5,
  difficulty: Difficulty.Normal,

  // critical performance video settings
  renderDistance: 12 as RenderDistance,
  particles: Particles.Decreased,
  fboEnable: true,
  fancyGraphics: Graphics.Fancy as boolean | undefined,
  ao: AmbientOcclusion.Maximum,
  renderClouds: RenderClouds.Fancy as RenderCloud,
  enableVsync: true,
  useVbo: true,
  mipmapLevels: 4 as MipmapLevel,
  anaglyph3d: false,

  fov: 0,
  gamma: 0,
  saturation: 0,
  guiScale: 0,
  bobView: true,
  maxFps: 120,
  fullscreen: false,

  resourcePacks: [] as string[],
  incompatibleResourcePacks: [] as string[],
  lastServer: '',
  lang: 'en_us',
  chatVisibility: 0,
  chatColors: true,
  chatLinks: true,
  chatLinksPrompt: true,
  chatOpacity: 1,
  snooperEnabled: true,

  hideServerAddress: false,
  advancedItemTooltips: false,
  pauseOnLostFocus: true,
  touchscreen: false,
  overrideWidth: 0,
  overrideHeight: 0,
  heldItemTooltips: true,
  chatHeightFocused: 1,
  chatHeightUnfocused: 0.44366196,
  chatScale: 1,
  chatWidth: 1,
  forceUnicodeFont: false,
  reducedDebugInfo: false,
  useNativeTransport: true,
  entityShadows: true,
  mainHand: 'right',
  attackIndicator: 1,
  showSubtitles: false,
  realmsNotifications: true,
  enableWeakAttacks: false,
  autoJump: true,
  narrator: 0,
  tutorialStep: 'movement',
  'key_key.attack': -100 as KeyCode,
  'key_key.use': -99 as KeyCode,
  'key_key.forward': 17 as KeyCode,
  'key_key.left': 30 as KeyCode,
  'key_key.back': 31 as KeyCode,
  'key_key.right': 32 as KeyCode,
  'key_key.jump': 57 as KeyCode,
  'key_key.sneak': 42 as KeyCode,
  'key_key.sprint': 29 as KeyCode,
  'key_key.drop': 16 as KeyCode,
  'key_key.inventory': 18 as KeyCode,
  'key_key.chat': 20 as KeyCode,
  'key_key.playerlist': 15 as KeyCode,
  'key_key.pickItem': -98 as KeyCode,
  'key_key.command': 53 as KeyCode,
  'key_key.screenshot': 60 as KeyCode,
  'key_key.togglePerspective': 63 as KeyCode,
  'key_key.smoothCamera': 0 as KeyCode,
  'key_key.fullscreen': 87 as KeyCode,
  'key_key.spectatorOutlines': 0 as KeyCode,
  'key_key.swapHands': 33 as KeyCode,
  'key_key.saveToolbarActivator': 46 as KeyCode,
  'key_key.loadToolbarActivator': 45 as KeyCode,
  'key_key.advancements': 38 as KeyCode,
  'key_key.hotbar.1': 2 as KeyCode,
  'key_key.hotbar.2': 3 as KeyCode,
  'key_key.hotbar.3': 4 as KeyCode,
  'key_key.hotbar.4': 5 as KeyCode,
  'key_key.hotbar.5': 6 as KeyCode,
  'key_key.hotbar.6': 7 as KeyCode,
  'key_key.hotbar.7': 8 as KeyCode,
  'key_key.hotbar.8': 9 as KeyCode,
  'key_key.hotbar.9': 10 as KeyCode,
  soundCategory_master: 1 as KeyCode,
  soundCategory_music: 1 as KeyCode,
  soundCategory_record: 1 as KeyCode,
  soundCategory_weather: 1 as KeyCode,
  soundCategory_block: 1 as KeyCode,
  soundCategory_hostile: 1 as KeyCode,
  soundCategory_neutral: 1 as KeyCode,
  soundCategory_player: 1 as KeyCode,
  soundCategory_ambient: 1 as KeyCode,
  soundCategory_voice: 1 as KeyCode,
  modelPart_cape: true,
  modelPart_jacket: true,
  modelPart_left_sleeve: true,
  modelPart_right_sleeve: true,
  modelPart_left_pants_leg: true,
  modelPart_right_pants_leg: true,
  modelPart_hat: true,
}

export type FullFrame = typeof DEFAULT_FRAME
export type Frame = Partial<FullFrame>

/**
 * Get the default values in options.txt.
 */
export function getDefaultFrame(): FullFrame {
  return Object.assign({}, DEFAULT_FRAME, {
    resourcePacks: [] as string[],
    incompatibleResourcePacks: [] as string[],
  })
}

export type ModelPart =
  | 'cape'
  | 'jacket'
  | 'left_sleeve'
  | 'right_sleeve'
  | 'left_pants_leg'
  | 'right_pants_leg'
  | 'hat'

export type SoundCategories =
  | 'master'
  | 'music'
  | 'record'
  | 'weather'
  | 'block'
  | 'hostile'
  | 'neutral'
  | 'player'
  | 'ambient'
  | 'voice'

export type HotKeys =
  | 'attack'
  | 'use'
  | 'forward'
  | 'left'
  | 'back'
  | 'right'
  | 'jump'
  | 'sneak'
  | 'sprint'
  | 'drop'
  | 'inventory'
  | 'chat'
  | 'playerlist'
  | 'pickItem'
  | 'command'
  | 'screenshot'
  | 'togglePerspective'
  | 'smoothCamera'
  | 'fullscreen'
  | 'spectatorOutlines'
  | 'swapHands'
  | 'saveToolbarActivator'
  | 'loadToolbarActivator'
  | 'advancements'
  | 'hotbar.1'
  | 'hotbar.2'
  | 'hotbar.3'
  | 'hotbar.4'
  | 'hotbar.5'
  | 'hotbar.6'
  | 'hotbar.7'
  | 'hotbar.8'
  | 'hotbar.9'

/**
 * Parse raw game setting options.txt content
 *
 * @param str the options.txt content
 * @param strict strictly follow the current version of options format (outdate version might cause problem. If your options.txt is new one with new fields, don't turn on this)
 */
export function parse(str: string, strict?: boolean): GameSetting | Frame {
  const intPattern = /^\d+$/
  const floatPattern = /^[-+]?[0-9]*\.[0-9]+$/
  const booleanPattern = /^(true)|(false)$/
  const lines = str.split('\n')
  if (!lines || lines.length === 0) {
    return strict ? getDefaultFrame() : {}
  }
  const setting = lines
    .map((l) => {
      const i = l.indexOf(':')
      if (i !== -1) {
        return [l.slice(0, i), l.slice(i + 1)]
      } else {
        // drop the line
        return ['', l]
      }
    })
    .filter((pair) => pair[0].length !== 0)
    .map(([key, value]) => {
      value = value.trim()
      let newValue = undefined as any
      if (intPattern.test(value)) {
        newValue = Number.parseInt(value, 10)
      } else if (floatPattern.test(value)) {
        newValue = Number.parseFloat(value)
      } else if (booleanPattern.test(value)) {
        newValue = value === 'true'
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Vanilla Minecraft writes arrays as JSON, so try JSON.parse first.
        // This correctly decodes escape sequences (\uXXXX, \\, \", \n, ...)
        // produced by the matching JSON.stringify in `stringify()` below.
        //
        // Without this, names containing characters that JSON.stringify
        // encoded (e.g. resource packs with `§` in their filename) would
        // be re-read as literal `\u00a7`, then re-escaped on write to
        // `\\u00a7`, then `\\\\u00a7`, and so on — adding a backslash on
        // every save until the file is hopelessly corrupted (gh #1379).
        //
        // The pre-existing custom parser is kept as a fallback for
        // non-standard formats (e.g. MultiMC's unquoted `[foo,bar]`).
        try {
          newValue = JSON.parse(value)
        } catch {
          const raw = value.slice(1, -1)
          if (raw.length === 0) {
            newValue = []
          } else {
            // parse the sequence of string might wrapped by "", but it could contain space inside the ""
            const result = [] as string[]
            let buffer = ''
            let inQuote = false
            for (let i = 0; i < raw.length; i++) {
              const char = raw[i]
              if (char === '"') {
                inQuote = !inQuote
              } else if (char === ',' && !inQuote) {
                result.push(buffer)
                buffer = ''
              } else {
                buffer += char
              }
            }
            if (buffer.length > 0) {
              result.push(buffer)
            }
            newValue = result
          }
        }
      } else {
        newValue = value
      }

      return { [key]: newValue }
    })
    .reduce((prev, current) => Object.assign(prev, current), {})
  if (!strict) {
    return setting as Frame
  }
  const source: any = getDefaultFrame()
  const target: any = {}
  Object.keys(source).forEach((key) => {
    target[key] = typeof setting[key] === typeof source[key] ? setting[key] : source[key]
    delete setting.key
  })
  return target as GameSetting
}

/**
 * Decode unicode escape sequences
 */
export function decodeUnicodeEscapes(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Encode non-ASCII characters to unicode escape sequences
 */
export function encodeUnicodeEscapes(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))
}

/**
 * Generate text format game setting for options.txt file.
 *
 * @param setting The game setting object
 * @param original
 * @param eol The end of line character, default is `\n`
 */
export function stringify(
  setting: GameSetting | Frame | any,
  original?: string,
  eol = '\n',
): string {
  let model: any
  if (original) {
    model = parse(original) as any
    for (const key in model) {
      if (key in model && key in setting) {
        model[key] = setting[key]
      }
    }
  } else {
    model = setting
  }
  return Object.keys(model)
    .filter((key) => key !== undefined && key !== 'undefined')
    .map((key) => {
      const val = model[key]
      if (typeof val === 'undefined') {
        return ''
      }
      if (typeof val === 'string') {
        return `${key}:${encodeUnicodeEscapes(val)}`
      }
      if (Array.isArray(val)) {
        const encoded = val.map((v) => typeof v === 'string' ? encodeUnicodeEscapes(v) : v)
        return `${key}:${JSON.stringify(encoded)}`
      }
      return `${key}:${JSON.stringify(val)}`
    })
    .join(eol)
}

export type GameSetting = ReturnType<typeof getDefaultFrame>

const LOCALE_TO_MC_LANG: Record<string, string> = {
  ar: 'ar_sa',
  ar_eg: 'ar_sa',
  bn: 'bn_bd',
  cs: 'cs_cz',
  de: 'de_de',
  en: 'en_us',
  en_in: 'en_us',
  en_us: 'en_us',
  en_gb: 'en_gb',
  es: 'es_es',
  es_es: 'es_es',
  fr: 'fr_fr',
  gl: 'gl_es',
  hi: 'hi_in',
  hu: 'hu_hu',
  id: 'id_id',
  it: 'it_it',
  it_it: 'it_it',
  ja: 'ja_jp',
  ja_jp: 'ja_jp',
  ko: 'ko_kr',
  kz: 'kk_kz',
  kk: 'kk_kz',
  lolcat: 'lol_aa',
  nl: 'nl_nl',
  pl: 'pl_pl',
  pt_br: 'pt_br',
  pt: 'pt_pt',
  ru: 'ru_ru',
  sa: 'sa_in',
  ta: 'ta_in',
  th: 'th_th',
  tr: 'tr_tr',
  uk: 'uk_ua',
  vi: 'vi_vn',
  zh_cn: 'zh_cn',
  zh_tw: 'zh_tw',
  zh_hk: 'zh_hk',
  zh: 'zh_cn',
}

function isLegacyMinecraftVersion(version: string): boolean {
  const match = version.match(/^1\.(\d+)/)
  if (match) {
    const minor = parseInt(match[1], 10)
    return minor < 13
  }
  return false
}

/**
 * Map an app/locale string (e.g. `zh-CN`, `uk`, `en`, `de`) to Minecraft's language code
 * (e.g. `zh_cn`, `uk_ua`, `en_us` for 1.13+, or `zh_CN`, `uk_UA`, `en_US` for legacy <1.13).
 */
export function toMinecraftLanguage(locale: string, minecraftVersion?: string): string {
  const norm = (locale || 'en').toLowerCase().replace('-', '_')
  const mcCode = LOCALE_TO_MC_LANG[norm] ?? (norm.includes('_') ? norm : `${norm}_${norm}`)

  if (minecraftVersion && isLegacyMinecraftVersion(minecraftVersion)) {
    const [lang, region] = mcCode.split('_')
    return region ? `${lang}_${region.toUpperCase()}` : lang
  }

  return mcCode
}

/**
 * Safely update or insert the `lang:` line in options.txt content without modifying other settings.
 */
export function setGameSettingLanguage(content: string, lang: string): string {
  if (/^lang:.*$/m.test(content)) {
    return content.replace(/^lang:.*$/m, `lang:${lang}`)
  }
  if (!content) {
    return `lang:${lang}\n`
  }
  return content.endsWith('\n') ? `${content}lang:${lang}\n` : `${content}\nlang:${lang}\n`
}
