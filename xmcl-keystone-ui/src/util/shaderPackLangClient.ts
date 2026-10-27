import { toShaderPackMcLang, type ShaderPackLangEntry } from '@xmcl/runtime-api'

/**
 * 必须逐字节保留的 token：光影包语言文件里常见的 Minecraft 格式码与 printf 占位符。
 */
const FORMAT_TOKEN = /(§[0-9A-Za-z]|&[0-9A-FK-ORa-fk-or]|%%|%(?:\d+\$)?[sdif]|\\n)/g

export interface ProtectedShaderValue {
  text: string
  tokens: string[]
}

/**
 * 把格式码/占位符替换成 ⟦XMCLn⟧ 标记，避免 AI 翻译时改动它们。
 */
export function protectShaderValue(value: string): ProtectedShaderValue {
  const tokens: string[] = []
  const text = value.replace(FORMAT_TOKEN, (match) => {
    const marker = `⟦XMCL${tokens.length}⟧`
    tokens.push(match)
    return marker
  })
  return { text, tokens }
}

/**
 * 还原受保护的 token，并校验每个标记恰好出现一次、不残留未知标记。
 */
export function restoreShaderValue(value: string, protectedValue: ProtectedShaderValue): string {
  let result = value
  for (let i = 0; i < protectedValue.tokens.length; i++) {
    const marker = `⟦XMCL${i}⟧`
    if (result.split(marker).length - 1 !== 1) {
      throw new Error(`AI changed or dropped formatting token ${protectedValue.tokens[i]}`)
    }
    result = result.replace(marker, protectedValue.tokens[i])
  }
  if (/⟦XMCL\d+⟧/.test(result)) {
    throw new Error('AI returned an unknown formatting token')
  }
  return result
}

/**
 * 判断某个值是否值得送去翻译：空值、纯格式码、纯数字、纯符号直接跳过。
 */
export function isTranslatableShaderValue(value: string): boolean {
  const stripped = value
    .replace(FORMAT_TOKEN, '')
    .replace(/[\s\d\p{P}\p{S}]/gu, '')
  return /[\p{L}]/u.test(stripped)
}

/**
 * 按估算字符量切批，保证单次请求不会超出模型输出上限，同时保持键顺序。
 */
export function splitShaderLangBatches(
  entries: ShaderPackLangEntry[],
  maxChars = 3400,
  maxEntries = Number.POSITIVE_INFINITY,
) {
  const batches: ShaderPackLangEntry[][] = []
  const entryLimit = Math.max(1, Math.floor(maxEntries))
  let batch: ShaderPackLangEntry[] = []
  let size = 0
  for (const entry of entries) {
    const nextSize = entry.key.length + entry.value.length + 12
    if (batch.length > 0 && (batch.length >= entryLimit || size + nextSize > maxChars)) {
      batches.push(batch)
      batch = []
      size = 0
    }
    batch.push(entry)
    size += nextSize
  }
  if (batch.length > 0) batches.push(batch)
  return batches
}

/**
 * 把语言代码转成可读语言名（用于界面展示）。
 */
export function shaderLangLocaleLabel(locale: string): string {
  const normalized = locale.replace(/_/g, '-').toLowerCase()
  try {
    return new Intl.DisplayNames(['zh-CN'], { type: 'language' }).of(normalized) ?? locale
  } catch {
    return locale
  }
}

/**
 * 目标语言选项。
 */
export interface ShaderPackTargetLanguage {
  /** 启动器语言代码，如 zh-CN */
  locale: string
  /** Minecraft 语言代码，如 zh_cn */
  mcLang: string
  /** 原生语言名，用于界面展示，如 简体中文 */
  label: string
  /** 英文语言名，用于生成 AI 翻译提示词，如 Simplified Chinese */
  promptName: string
}

/**
 * 启动器语言代码到英文语言名的映射，用于给 AI 生成明确的翻译目标。
 */
const PROMPT_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  'en-IN': 'English (India)',
  ar: 'Arabic',
  'ar-EG': 'Arabic (Egypt)',
  bn: 'Bengali',
  de: 'German',
  'es-ES': 'Spanish',
  fr: 'French',
  gl: 'Galician',
  hi: 'Hindi',
  hu: 'Hungarian',
  id: 'Indonesian',
  'it-IT': 'Italian',
  'ja-JP': 'Japanese',
  ko: 'Korean',
  kz: 'Kazakh',
  lolcat: 'LOLCAT (Minecraft meme English)',
  nl: 'Dutch',
  pl: 'Polish',
  'pt-BR': 'Portuguese (Brazil)',
  ru: 'Russian',
  sa: 'Sanskrit',
  ta: 'Tamil',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
  'zh-CN': 'Simplified Chinese',
  'zh-HK': 'Traditional Chinese (Hong Kong)',
  'zh-TW': 'Traditional Chinese',
}

/**
 * 取得某个启动器语言在提示词里使用的英文语言名。
 */
export function getShaderPackPromptLanguageName(locale: string, fallback?: string): string {
  if (PROMPT_LANGUAGE_NAMES[locale]) return PROMPT_LANGUAGE_NAMES[locale]
  const base = locale.split('-')[0]
  if (PROMPT_LANGUAGE_NAMES[base]) return PROMPT_LANGUAGE_NAMES[base]
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) ?? fallback ?? locale
  } catch {
    return fallback ?? locale
  }
}

/**
 * 根据启动器支持的语言列表生成可用的翻译目标语言。
 *
 * 同一个 Minecraft 语言代码只保留第一个（例如 `en` 与 `en-IN` 都映射到 `en_us`），
 * 避免下拉框出现重复项。
 */
export function getShaderPackTargetLanguages(
  locales: readonly { locale: string, name: string }[],
): ShaderPackTargetLanguage[] {
  const result: ShaderPackTargetLanguage[] = []
  const seen = new Set<string>()
  for (const item of locales) {
    const mcLang = toShaderPackMcLang(item.locale)
    if (seen.has(mcLang)) continue
    seen.add(mcLang)
    result.push({
      locale: item.locale,
      mcLang,
      label: item.name || item.locale,
      promptName: getShaderPackPromptLanguageName(item.locale, item.name),
    })
  }
  return result
}

/**
 * 在目标语言列表里按 Minecraft 语言代码查找目标语言。
 */
export function findShaderPackTargetLanguage(
  languages: readonly ShaderPackTargetLanguage[],
  mcLang: string | undefined,
): ShaderPackTargetLanguage | undefined {
  if (!mcLang) return undefined
  return languages.find(item => item.mcLang.toLowerCase() === mcLang.toLowerCase())
}
