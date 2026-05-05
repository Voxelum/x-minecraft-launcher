/**
 * @module @xmcl/text-component
 */
/**
 * @see https://minecraft.gamepedia.com/Raw_JSON_text_format
 */
export interface TextComponent {
  /**
   * A string representing raw text to display directly in chat. Note that selectors such as "@a" and "@p" are not translated into player names; use selector instead. Can use escape characters, such as \n for newline (enter), \t for tab, etc.
   */
  text: string
  /**
   * The translation identifier of text to be displayed using the player's selected language. This identifier is the same as the identifiers found in lang files from assets or resource packs. Ignored when  text exist in the root object.
   */
  translate?: string
  /**
   * A list of chat component arguments and/or string arguments to be used by translate. Useless otherwise.
   *
   * The arguments are text corresponding to the arguments used by the translation string in the current language, in order (for example, the first list element corresponds to "%1$s" in a translation string). Argument structure repeats this raw JSON text structure.
   */
  with?: string[]
  /**
   * A player's score in an objective. Displays nothing if the player is not tracked in the given objective.
   * Ignored when any of the previous fields exist in the root object.
   */
  score?: {
    name: string
    objective: string
    value: string
  }
  /**
   * A string containing a selector (@p,@a,@r,@e or @s) and, optionally, selector arguments.
   *
   * Unlike text, the selector is translated into the correct player/entity names.
   * If more than one player/entity is detected by the selector, it is displayed in a form such as 'Name1 and Name2' or 'Name1, Name2, Name3, and Name4'.
   * Ignored when any of the previous fields exist in the root object.
   *
   * - Clicking a player's name inserted into a /tellraw command this way suggests a command to whisper to that player.
   * - Shift-clicking a player's name inserts that name into chat.
   * - Shift-clicking a non-player entity's name inserts its UUID into chat.
   */
  selector?: string
  /**
   * A string that can be used to display the key needed to preform a certain action.
   * An example is `key.inventory` which always displays "E" unless the player has set a different key for opening their inventory.
   *
   * Ignored when any of the previous fields exist in the root object.
   */
  keybind?: string
  /**
   *  A string indicating the NBT path used for looking up NBT values from an entity or a block entity. Ignored when any of the previous fields exist in the root object.
   */
  nbt?: string
  /**
   * A string specifying the coordinates of the block entity from which the NBT value is obtained. The coordinates can be absolute or relative. Useless if  nbt is absent.
   */
  block?: string
  /**
   * A string specifying the target selector for the entity from which the NBT value is obtained. Useless if  nbt is absent.
   */
  entity?: string
  /**
   * A list element whose structure repeats this raw JSON text structure. Note that all properties of this object are inherited by children except for text, extra, translate, with, and score.
   *
   * This means that children retain the same formatting and events as this object unless they explicitly override them.
   */
  extra?: TextComponent[]
  /**
   * The color to render this text in. Valid values are "black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray", "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white", and "reset" (cancels out the effects of colors used by parent objects). Technically, "bold", "italic", "underlined", "strikethrough", and "obfuscated" are also accepted, but it may be better practice to use the tags below for such formats.
   */
  color?: string
  bold?: boolean
  italic?: boolean
  underlined?: boolean
  strikethrough?: boolean
  obfuscated?: boolean
  /**
   * When the text is shift-clicked by a player, this string is inserted in their chat input. It does not overwrite any existing text the player was writing.
   */
  insertion?: string
  /**
   *  Allows for events to occur when the player clicks on text.
   */
  clickEvent?: {
    /**
     * The action to perform when clicked.
     * Valid values are
     * - "open_url" (opens value as a URL in the player's default web browser),
     * - "open_file" (opens the value file on the user's computer),
     * - "run_command" (has value entered in chat as though the player typed it themselves. This can be used to run commands, provided the player has the required permissions),
     * - "change_page" (can be used only in written books) changes to page value if that page exists,
     * - "suggest_command" (similar to "run_command" but it cannot be used in a written book, the text appears only in the player's chat input and it is not automatically entered. Unlike insertion, this replaces the existing contents of the chat input),
     * - "copy_to_clipboard"‌[upcoming: 1.15] (copy the value to the clipboard). "open_file" is used in messages automatically generated by the game (e.g. on taking a screenshot) and cannot be used in commands or signs.
     */
    action: ClickEventAction
    /**
     * The URL, file, chat, command or book page used by the specified action. Note that commands must be prefixed with the usual "/" slash.
     */
    value: string
  }
  hoverEvent?: {
    /**
     * The type of tooltip to show. Valid values are
     * - "show_text" (shows raw JSON text),
     * - "show_item" (shows the tooltip of an item that can have NBT tags),
     * - "show_entity" (shows an entity's name, possibly its type, and its UUID).
     */
    action: HoverEventAction
    /**
     * The formatting of this tag varies depending on the action. Note that "show_text" is the only action to support an Object as the value; all other action values are Strings and should thus be wrapped in quotes.
     *
     * - "show_text" can be either a raw string of text or an object with the same formatting as this base object. Note that clickEvent and hoverEvent do not function within the tooltip, but the formatting and extra tags still work.
     * - "show_item" can be a string formatted like item NBT data. Contains the "id" tag, and optionally the "Damage" tag and "tag" tag (which is the same compound used as "dataTag" in the /give command).
     * - "show_entity" can be string formatted like a compound with the string values "type" (such as "Zombie"), "name", and "id" (should be an entity UUID, but can actually be any string).
     */
    value: string | TextComponent
  }
}

export type ClickEventAction = 'open_file' | 'open_url' | 'run_command' | 'suggest_command'
export type HoverEventAction = 'show_text' | 'show_item' | 'show_entity'

export interface Style {
  /**
   * The friendly name of the color, like `light_purple` or `red`
   */
  color?: string
  bold?: boolean
  italic?: boolean
  underlined?: boolean
  strikethrough?: boolean
  obfuscated?: boolean
}

/**
 * Get Minecraft style code for the style
 */
export function getStyleCode(style: TextComponent): string {
  let code = ''
  for (const l of TextFormat.list) {
    if (l.matchStyle(style)) {
      code += l
    }
  }
  return code
}

/**
 * The renderable node
 */
export type RenderNode = {
  /**
   * The css style string
   */
  style: object
  /**
   * The text component backed by
   */
  component: TextComponent
  /**
   * Children
   */
  children: RenderNode[]
}

/**
 * Get suggest css style object for input style
 */
export function getSuggestedStyle(style: TextComponent | Style): object {
  const styledObject: object = {}
  for (const l of TextFormat.list) {
    if (l.matchStyle(style)) {
      Object.assign(styledObject, l.cssForeground)
    }
  }
  return styledObject
}

/**
 * Render a text component into html style object
 * @returns the render node hint for html/css info
 */
export function render(src: TextComponent): RenderNode {
  const children = [] as RenderNode[]
  for (const component of src.extra || []) {
    children.push(render(component))
  }
  return { children, component: src, style: getSuggestedStyle(src) }
}

/**
 * Flat all components (this component and its children) in this component by DFS into a list.
 * @param component The root component
 */
export function flat(component: TextComponent): TextComponent[] {
  const arr: TextComponent[] = [component]
  if (component.extra && component.extra.length !== 0) {
    for (const s of component.extra) {
      arr.push(...flat(s))
    }
  }
  return arr
}

/**
 * Convert a text component to Minecraft specific formatted string like `§1colored§r`
 */
export function toFormattedString(comp: TextComponent): string {
  let v = ''
  for (const component of flat(comp)) {
    const text = component.text
    if (text.length !== 0) {
      v += `${getStyleCode(component)}${text}${TextFormat.RESET}`
    }
  }
  return v
}

/**
 * Convert a formatted string to text component json
 * @param formatted The formatted string
 */
export function fromFormattedString(formatted: string): TextComponent {
  const firstCode = formatted.indexOf('§')
  if (firstCode === -1) {
    return { text: formatted }
  }

  const textComponent: TextComponent = {
    text: formatted.substring(0, firstCode),
  }

  let builder = ''
  const style: Style = {
    bold: false,
    obfuscated: false,
    strikethrough: false,
    underlined: false,
    italic: false,
    color: undefined,
  }

  for (let i = firstCode; i < formatted.length; i++) {
    const word = formatted.charCodeAt(i)
    if (word === 167 && i + 1 < formatted.length) {
      if (builder.length !== 0) {
        if (!textComponent.extra) {
          textComponent.extra = []
        }
        textComponent.extra.push({ text: builder, ...style })
        builder = ''
      }
      // apply style
      const format = TextFormat.fromCode(formatted.charAt(i + 1).toLowerCase())
      if (format) {
        format.applyToStyle(style)
      }
      ++i // ignore the next char
    } else {
      builder += formatted[i]
    }
  }
  if (builder.length !== 0) {
    if (!textComponent.extra) {
      textComponent.extra = []
    }
    textComponent.extra.push({ text: builder, ...style })
  }
  return textComponent
}

class TextFormat<T extends keyof Style> {
  static readonly CONTROL_STRING = '§'
  constructor(
    readonly key: T,
    readonly value: Style[T],
    readonly name: string,
    readonly code: string,
    readonly cssForeground: object,
    readonly cssBackground?: object,
  ) {}
  applyToStyle(style: Style) {
    style[this.key] = this.value
  }
  matchStyle(style: Style) {
    return style[this.key] === this.value
  }

  static readonly BLACK = new TextFormat(
    'color',
    'black',
    'BLACK',
    '0',
    { color: '#000000' },
    { color: '#000000' },
  )
  static readonly DARK_BLUE = new TextFormat(
    'color',
    'dark_blue',
    'DARK_BLUE',
    '1',
    { color: '#0000AA' },
    { color: '#00002A' },
  )
  static readonly DARK_GREEN = new TextFormat(
    'color',
    'dark_green',
    'DARK_GREEN',
    '2',
    { color: '#00AA00' },
    { color: '#002A00' },
  )
  static readonly DARK_AQUA = new TextFormat(
    'color',
    'dark_aqua',
    'DARK_AQUA',
    '3',
    { color: '#00AAAA' },
    { color: '#002A2A' },
  )
  static readonly DARK_RED = new TextFormat(
    'color',
    'dark_red',
    'DARK_RED',
    '4',
    { color: '#AA0000' },
    { color: '#2A0000' },
  )
  static readonly DARK_PURPLE = new TextFormat(
    'color',
    'dark_purple',
    'DARK_PURPLE',
    '5',
    { color: '#AA00AA' },
    { color: '#2A002A' },
  )
  static readonly GOLD = new TextFormat(
    'color',
    'gold',
    'GOLD',
    '6',
    { color: '#FFAA00' },
    { color: '#2A2A00' },
  )
  static readonly GRAY = new TextFormat(
    'color',
    'gray',
    'GRAY',
    '7',
    { color: '#AAAAAA' },
    { color: '#2A2A2A' },
  )
  static readonly DARK_GRAY = new TextFormat(
    'color',
    'dark_gray',
    'DARK_GRAY',
    '8',
    { color: '#555555' },
    { color: '#151515' },
  )
  static readonly BLUE = new TextFormat(
    'color',
    'blue',
    'BLUE',
    '9',
    { color: '#5555FF' },
    { color: '#15153F' },
  )
  static readonly GREEN = new TextFormat(
    'color',
    'green',
    'GREEN',
    'a',
    { color: '#55FF55' },
    { color: '#153F15' },
  )
  static readonly AQUA = new TextFormat(
    'color',
    'aqua',
    'AQUA',
    'b',
    { color: '#55FFFF' },
    { color: '#153F3F' },
  )
  static readonly RED = new TextFormat(
    'color',
    'red',
    'RED',
    'c',
    { color: '#FF5555' },
    { color: '#3F1515' },
  )
  static readonly LIGHT_PURPLE = new TextFormat(
    'color',
    'light_purple',
    'LIGHT_PURPLE',
    'd',
    { color: '#FF55FF' },
    { color: '#3F153F' },
  )
  static readonly YELLOW = new TextFormat(
    'color',
    'yellow',
    'YELLOW',
    'e',
    { color: '#FFFF55' },
    { color: '#3F3F15' },
  )
  static readonly WHITE = new TextFormat(
    'color',
    'white',
    'WHITE',
    'f',
    { color: '#FFFFFF' },
    { color: '#3F3F3F' },
  )
  static readonly OBFUSCATED = new TextFormat('obfuscated', true, 'OBFUSCATED', 'k', {})
  static readonly BOLD = new TextFormat('bold', true, 'BOLD', 'l', { 'font-weight': 'bold' })
  static readonly STRIKETHROUGH = new TextFormat('strikethrough', true, 'STRIKETHROUGH', 'm', {
    'text-decoration': 'line-through',
  })
  static readonly UNDERLINE = new TextFormat('underlined', true, 'UNDERLINE', 'n', {
    'text-decoration': 'underline',
  })
  static readonly ITALIC = new TextFormat('italic', true, 'ITALIC', 'o', { 'font-style': 'italic' })
  static readonly RESET = {
    name: 'RESET',
    code: 'r',
    applyToStyle(style: Style) {
      style.bold = false
      style.strikethrough = false
      style.underlined = false
      style.italic = false
      style.obfuscated = false
      style.color = undefined
    },
    matchStyle(style: Style) {
      return false
    },
    cssBackground: {},
    cssForeground: {},
    toString() {
      return `${TextFormat.CONTROL_STRING}r`
    },
  }

  static readonly list = [
    TextFormat.BLACK,
    TextFormat.DARK_BLUE,
    TextFormat.DARK_GREEN,
    TextFormat.DARK_AQUA,
    TextFormat.DARK_RED,
    TextFormat.DARK_PURPLE,
    TextFormat.GOLD,
    TextFormat.GRAY,
    TextFormat.DARK_GRAY,
    TextFormat.BLUE,
    TextFormat.GREEN,
    TextFormat.AQUA,
    TextFormat.RED,
    TextFormat.LIGHT_PURPLE,
    TextFormat.YELLOW,
    TextFormat.WHITE,
    TextFormat.OBFUSCATED,
    TextFormat.BOLD,
    TextFormat.STRIKETHROUGH,
    TextFormat.UNDERLINE,
    TextFormat.ITALIC,
    TextFormat.RESET,
  ]

  /**
   * Get the text format from text code
   * @param code The text code character like 0, 1, 2
   * @returns The TextFormat instance
   */
  static fromCode(code: string) {
    const seq = '0123456789abcdefklmnor'
    const index = seq.indexOf(code)
    if (!index) {
      return undefined
    }
    return this.list[index]
  }

  toString() {
    return `${TextFormat.CONTROL_STRING}${this.code}`
  }
}
