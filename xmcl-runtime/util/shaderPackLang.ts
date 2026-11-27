import { ShaderPackLangEntry } from '@xmcl/runtime-api'

/**
 * 光影包 `.lang` 文件的一行。
 *
 * 保留原始行结构（注释、空行、缩进、值首尾空白、行尾），
 * 这样写回时只需要替换“值”这一段，其它内容原样保留。
 */
export interface ShaderLangLine {
  /** 不含行尾的原始内容 */
  raw: string
  /** 该行的行尾，最后一行且无末尾换行时为空字符串 */
  eol: string
  kind: 'blank' | 'comment' | 'entry' | 'invalid'
  /** entry 行解析出的键 */
  key?: string
  /** entry 行 `键=` 部分（含键的前导空白与等号），替换值时原样保留 */
  keyPrefix?: string
  /** entry 行值的真实内容（已去掉首尾空白） */
  value?: string
  /** 值前保留的空白 */
  valuePrefix?: string
  /** 值后保留的空白 */
  valueSuffix?: string
}

export interface ShaderLangParseResult {
  /** 文件是否带 UTF-8 BOM */
  bom: boolean
  /** 文件里出现最多的换行符 */
  eol: '\r\n' | '\n' | '\r'
  /** 是否有末尾换行 */
  hasFinalNewline: boolean
  lines: ShaderLangLine[]
  /** 解析出的键值对，重复键按“首个值优先”合并 */
  entries: ShaderPackLangEntry[]
}

/**
 * 以严格 UTF-8 解码语言文件。
 *
 * 语言文件不是 UTF-8 时直接报错，避免把替换字符写回光影包。
 */
export function decodeShaderLangFile(buffer: Uint8Array): string {
  try {
    // ignoreBOM: true 保留 BOM 字符，写回时可以原样还原
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer)
  } catch {
    throw new Error('The language file is not valid UTF-8')
  }
}

/**
 * 按 `\r\n` / `\n` / `\r` 拆分文本，并保留每行行尾。
 */
function splitLines(text: string): { raw: string; eol: string }[] {
  const result: { raw: string; eol: string }[] = []
  let index = 0
  while (index < text.length) {
    let end = index
    while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++
    let eol = ''
    if (text[end] === '\r' && text[end + 1] === '\n') {
      eol = '\r\n'
      end += 2
    } else if (text[end] === '\r' || text[end] === '\n') {
      eol = text[end]
      end += 1
    }
    result.push({ raw: text.slice(index, end - eol.length), eol })
    index = end
  }
  return result
}

function parseLine(raw: string, eol: string): ShaderLangLine {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { raw, eol, kind: 'blank' }
  if (trimmed.startsWith('#')) return { raw, eol, kind: 'comment' }

  // 以第一个 `=` 分割键值；值里允许再出现 `=`
  const eq = raw.indexOf('=')
  if (eq < 0) return { raw, eol, kind: 'invalid' }
  const key = raw.slice(0, eq).trim()
  if (key.length === 0) return { raw, eol, kind: 'invalid' }

  const rawValue = raw.slice(eq + 1)
  // 值前后的空白单独保存，翻译时只改中间内容
  const match = /^([ \t]*)([\s\S]*?)([ \t]*)$/.exec(rawValue)
  const valuePrefix = match ? match[1] : ''
  const value = match ? match[2] : rawValue
  const valueSuffix = match ? match[3] : ''
  return {
    raw,
    eol,
    kind: 'entry',
    key,
    keyPrefix: raw.slice(0, eq + 1),
    value,
    valuePrefix,
    valueSuffix,
  }
}

/**
 * 解析语言文件。
 *
 * - 保留 BOM、换行风格、每行行尾与末尾换行；
 * - 重复键：值相同只产生一个翻译条目，值不同保留首个值（后续冲突行写回时保持原文）。
 */
export function parseShaderLang(text: string): ShaderLangParseResult {
  const bom = text.charCodeAt(0) === 0xfeff
  const body = bom ? text.slice(1) : text
  const lines = splitLines(body).map(({ raw, eol }) => parseLine(raw, eol))

  const counts = { '\r\n': 0, '\n': 0, '\r': 0 }
  for (const line of lines) {
    if (line.eol === '\r\n' || line.eol === '\n' || line.eol === '\r') counts[line.eol] += 1
  }
  // 选择出现最多的换行风格；没有换行（单行文件）时默认 \n
  const eol = counts['\r\n'] === 0 && counts['\n'] === 0 && counts['\r'] === 0
    ? '\n'
    : counts['\r\n'] >= counts['\n'] && counts['\r\n'] >= counts['\r']
      ? '\r\n'
      : counts['\n'] >= counts['\r'] ? '\n' : '\r'

  const entries: ShaderPackLangEntry[] = []
  const seen = new Map<string, string>()
  for (const line of lines) {
    if (line.kind !== 'entry' || line.key === undefined) continue
    const value = line.value ?? ''
    const existing = seen.get(line.key)
    if (existing !== undefined) {
      // 值相同的重复键不再产生新条目；值冲突时保留首行语义
      continue
    }
    seen.set(line.key, value)
    entries.push({ key: line.key, value })
  }

  const last = lines[lines.length - 1]
  return {
    bom,
    eol,
    hasFinalNewline: !!last && last.eol.length > 0,
    lines,
    entries,
  }
}

/**
 * 把翻译合并回模板文本。
 *
 * 规则：
 * 1. 模板里每个键，若已有译文则替换值，保留缩进、注释、BOM 与换行；
 * 2. 模板中有、源文件没有的键保持原样；
 * 3. 源文件中有、模板中没有的键追加到末尾。
 *
 * @param parsed 模板（目标文件存在时用目标文件，否则用源文件）
 * @param translations 已通过校验的译文
 * @param sourceEntries 源文件条目，用于补齐模板缺失的键
 */
export function mergeShaderLang(
  parsed: ShaderLangParseResult,
  translations: ReadonlyMap<string, string>,
  sourceEntries: readonly ShaderPackLangEntry[],
): string {
  const output: string[] = []
  const existingKeys = new Set<string>()

  for (const line of parsed.lines) {
    if (line.kind === 'entry' && line.key !== undefined) {
      existingKeys.add(line.key)
      const translated = translations.get(line.key)
      if (translated !== undefined) {
        output.push(`${line.keyPrefix ?? ''}${line.valuePrefix ?? ''}${translated}${line.valueSuffix ?? ''}${line.eol}`)
        continue
      }
    }
    output.push(line.raw + line.eol)
  }

  // 追加模板中缺失的键
  const appended = sourceEntries.filter(entry => !existingKeys.has(entry.key))
  if (appended.length > 0) {
    if (output.length > 0 && !output[output.length - 1].endsWith(parsed.eol)) {
      // 模板最后一行没有换行时先补一个，避免和追加内容粘在同一行
      output[output.length - 1] += parsed.eol
    }
    appended.forEach((entry, index) => {
      const isLast = index === appended.length - 1
      const translated = translations.get(entry.key) ?? entry.value
      output.push(`${entry.key}=${translated}${isLast && !parsed.hasFinalNewline ? '' : parsed.eol}`)
    })
  }

  return (parsed.bom ? '\uFEFF' : '') + output.join('')
}

/** Fill only absent target keys, regardless of what the client submitted. */
export function fillMissingShaderLang(
  source: ShaderLangParseResult,
  target: ShaderLangParseResult | undefined,
  translations: readonly ShaderPackLangEntry[],
): { content: string; written: number } | undefined {
  const existing = new Set(target?.entries.map(entry => entry.key))
  const missing = source.entries.filter(entry => !existing.has(entry.key))
  const map = validateTranslations(source.entries, missing, translations)
  if (!missing.length) return undefined
  return { content: mergeShaderLang(target ?? source, map, missing), written: missing.length }
}

/**
 * 校验译文完整性：键必须来自源文件、不能重复，且非空源值必须有非空译文。
 *
 * 放在模块作用域而不是服务方法，避免被 IPC 按名字直接调用。
 */
function validateTranslations(source: readonly ShaderPackLangEntry[], missing: readonly ShaderPackLangEntry[], translations: readonly ShaderPackLangEntry[]) {
  const sourceKeys = new Set(source.map(entry => entry.key))
  const missingKeys = new Set(missing.map(entry => entry.key))
  const map = new Map<string, string>()
  for (const entry of translations) {
    if (typeof entry.key !== 'string' || typeof entry.value !== 'string') {
      throw new Error('Invalid translation entry')
    }
    if (!sourceKeys.has(entry.key)) {
      throw new Error(`Unexpected translation key: ${entry.key}`)
    }
    if (!missingKeys.has(entry.key)) continue
    if (map.has(entry.key)) {
      throw new Error(`Duplicated translation key: ${entry.key}`)
    }
    // 语言文件是逐行的，译文里出现换行会破坏结构
    if (entry.value.includes('\n') || entry.value.includes('\r')) {
      throw new Error(`Translation of ${entry.key} contains a line break`)
    }
    map.set(entry.key, entry.value)
  }
  for (const entry of missing) {
    if (entry.value.trim().length === 0) continue
    const translated = map.get(entry.key)
    if (translated === undefined || translated.trim().length === 0) {
      throw new Error(`Missing translation for key: ${entry.key}`)
    }
  }
  return map
}
/**
 * 校验译文是否可写回：每个非空源值都必须有译文，且译文键必须来自源文件。
 */
export function assertCompleteTranslations(
  sourceEntries: readonly ShaderPackLangEntry[],
  translations: readonly ShaderPackLangEntry[],
): Map<string, string> {
  const sourceKeys = new Set(sourceEntries.map(entry => entry.key))
  const map = new Map<string, string>()
  for (const entry of translations) {
    if (!sourceKeys.has(entry.key)) {
      throw new Error(`Unexpected translation key: ${entry.key}`)
    }
    if (map.has(entry.key)) {
      throw new Error(`Duplicated translation key: ${entry.key}`)
    }
    map.set(entry.key, entry.value)
  }
  for (const entry of sourceEntries) {
    if (entry.value.trim().length === 0) continue
    const translated = map.get(entry.key)
    if (translated === undefined || translated.trim().length === 0) {
      throw new Error(`Missing translation for key: ${entry.key}`)
    }
  }
  return map
}
