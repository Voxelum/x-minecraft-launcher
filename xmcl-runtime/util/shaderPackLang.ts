export interface ShaderPackLangEntry {
  key: string
  /** 可翻译的值，已去掉首尾空白 */
  value: string
}

interface LangLine {
  text: string
  eol: string
  key?: string
  prefix?: string
  leading?: string
  trailing?: string
}

export interface ParsedShaderPackLang {
  bytes: number
  bom: boolean
  eol: '\r\n' | '\n' | '\r'
  hasFinalNewline: boolean
  lines: LangLine[]
  entries: ShaderPackLangEntry[]
}

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

/**
 * 按 CRLF/LF/CR 切分，并保留每行自己的行尾，方便原样写回。
 */
function splitLines(content: string): LangLine[] {
  const parts = content.split(/(\r\n|\n|\r)/)
  const lines: LangLine[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i] ?? ''
    const eol = parts[i + 1] ?? ''
    if (text === '' && eol === '' && i >= parts.length - 1) continue
    lines.push({ text, eol })
  }
  return lines
}

/**
 * 解析单行：`#` 开头为注释；以第一个 `=` 分隔键值；值可以再包含 `=`。
 */
function parseValue(line: LangLine) {
  if (line.text.trimStart().startsWith('#')) return
  const separator = line.text.indexOf('=')
  if (separator <= 0) return

  const key = line.text.slice(0, separator)
  if (!key.trim()) return

  const rawValue = line.text.slice(separator + 1)
  const leading = rawValue.match(/^\s*/)?.[0] ?? ''
  const trailing = rawValue.match(/\s*$/)?.[0] ?? ''
  const core = rawValue.slice(leading.length, rawValue.length - trailing.length)

  line.key = key
  line.prefix = line.text.slice(0, separator + 1)
  line.leading = leading
  line.trailing = trailing
  return core
}

/**
 * 解析 OptiFine/Iris 光影包语言文件。
 *
 * 解析器刻意保留原始行结构，这样翻译后的文件可以原样保留注释、空行、BOM、
 * 换行符、末尾换行以及键顺序。
 */
export function parseShaderPackLang(buffer: Buffer): ParsedShaderPackLang {
  const hasBom = buffer.length >= 3 && buffer.subarray(0, 3).equals(UTF8_BOM)
  const raw = hasBom ? buffer.subarray(3) : buffer
  const content = raw.toString('utf8')

  // Buffer#toString 会静默替换非法字节，重新编码对比可以发现替换字符，
  // 从而拒绝源文件而不是把损坏内容的语言文件写回压缩包。
  if (!Buffer.from(content, 'utf8').equals(raw)) {
    throw new Error('Shader language file is not valid UTF-8')
  }

  const crlf = (content.match(/\r\n/g) ?? []).length
  const lf = (content.match(/(^|[^\r])\n/g) ?? []).length
  const cr = (content.match(/\r(?!\n)/g) ?? []).length
  const eol: '\r\n' | '\n' | '\r' = crlf >= lf && crlf >= cr ? '\r\n' : (lf >= cr ? '\n' : '\r')
  const lines = splitLines(content)
  const entries: ShaderPackLangEntry[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const value = parseValue(line)
    if (value === undefined || !line.key) continue
    if (seen.has(line.key)) {
      throw new Error(`Duplicate shader language key: ${line.key}`)
    }
    seen.add(line.key)
    entries.push({ key: line.key, value })
  }

  return {
    bytes: buffer.length,
    bom: hasBom,
    eol,
    hasFinalNewline: content.endsWith('\n') || content.endsWith('\r'),
    lines,
    entries,
  }
}

function setLineValue(line: LangLine, value: string) {
  if (!line.key || line.prefix === undefined) return
  const trimmed = value.trim()
  line.text = line.prefix + (line.leading ?? '') + trimmed + (line.trailing ?? '')
}

/**
 * 把翻译结果合并进模板文件。
 *
 * 目标语言文件已存在时以目标文件为模板，这样可以保留目标文件已有的注释、顺序
 * 和人工翻译；源文件有而模板没有的键追加到末尾；目标独有的键原样保留。
 */
export function mergeShaderPackLang(
  source: ParsedShaderPackLang,
  target: ParsedShaderPackLang | undefined,
  translations: Record<string, string>,
): Buffer {
  const template = target ?? source
  const outputLines = template.lines.map(line => ({ ...line }))
  const existingKeys = new Set<string>()
  for (const line of outputLines) {
    if (!line.key) continue
    if (existingKeys.has(line.key)) {
      throw new Error(`Duplicate shader language key in target: ${line.key}`)
    }
    existingKeys.add(line.key)
    const translated = translations[line.key]
    if (translated !== undefined) setLineValue(line, translated)
  }

  const missing = source.entries.filter(entry => !existingKeys.has(entry.key))
  if (missing.length > 0) {
    const last = outputLines[outputLines.length - 1]
    if (last && !last.eol) last.eol = template.eol
    for (let i = 0; i < missing.length; i++) {
      const entry = missing[i]
      const translated = translations[entry.key] ?? entry.value
      outputLines.push({
        text: `${entry.key}=${translated}`,
        eol: i === missing.length - 1 && !template.hasFinalNewline ? '' : template.eol,
      })
    }
  }

  // 翻译是全有或全无的：非空源值缺少翻译通常意味着 AI 悄悄丢了键，
  // 这里直接拒绝写回半成品文件。
  for (const entry of source.entries) {
    if (!entry.value.trim()) continue
    if (translations[entry.key] === undefined) {
      throw new Error(`Missing shader language translation for key: ${entry.key}`)
    }
  }

  const body = outputLines.map(line => line.text + line.eol).join('')
  const output = template.bom ? Buffer.concat([UTF8_BOM, Buffer.from(body, 'utf8')]) : Buffer.from(body, 'utf8')
  return output
}
