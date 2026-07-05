// @ts-nocheck
/**
 * i18n-core — shared logic for the unified i18n CLI / daemon.
 *
 * Pure(ish) helpers: locale loading, source scanning, lint computation, and
 * surgical line-based key removal / renaming. No side effects on import.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const UI_ROOT = resolve(__dirname, '..')
export const REPO_ROOT = resolve(UI_ROOT, '..')

// ---------------------------------------------------------------------------
// vue-i18n message compiler — used to validate that every locale string
// actually compiles, catching the `createCompileError` / SyntaxError class of
// bugs (e.g. unbalanced braces) that otherwise only surface at runtime in the
// user's browser. `baseCompile` is the exact compiler vue-i18n uses, pulled in
// transitively via `vue-i18n`; try normal resolution first, then fall back to
// pnpm's virtual store. Returns null if it can't be found (validation is then
// limited to YAML parsing).
// ---------------------------------------------------------------------------
const require = createRequire(import.meta.url)
function loadBaseCompile() {
  try { return require('@intlify/message-compiler').baseCompile } catch { /* not hoisted */ }
  try {
    const pnpmDir = join(REPO_ROOT, 'node_modules', '.pnpm')
    const entry = readdirSync(pnpmDir).find((n) => n.startsWith('@intlify+message-compiler@'))
    if (entry) {
      return require(join(pnpmDir, entry, 'node_modules', '@intlify', 'message-compiler')).baseCompile
    }
  } catch { /* store layout differs — give up gracefully */ }
  return null
}
const baseCompile = loadBaseCompile()
export const LOCALES_DIR = join(UI_ROOT, 'locales')
export const SRC_DIR = join(UI_ROOT, 'src')
export const SETTINGS_FILE = join(REPO_ROOT, '.vscode', 'settings.json')
export const BASE_LOCALE = 'en'
export const INDENT = 2
const SRC_EXTS = ['.vue', '.ts']

// ---------------------------------------------------------------------------
// YAML / object helpers
// ---------------------------------------------------------------------------

/** Flatten a nested message object into a Map of dot-joined key -> leaf value. */
export function flatten(obj, prefix = '', out = new Map()) {
  if (obj == null) return out
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out.set(key, v)
  }
  return out
}

/** Strip // and block comments from JSONC so JSON.parse can read it.
 * String-aware so `://` and `file:///` inside string values are preserved. */
function parseJsonc(text) {
  let out = ''
  let inStr = false
  let strCh = ''
  let inLine = false
  let inBlock = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const nx = text[i + 1]
    if (inLine) { if (ch === '\n') { inLine = false; out += ch } continue }
    if (inBlock) { if (ch === '*' && nx === '/') { inBlock = false; i++ } continue }
    if (inStr) {
      out += ch
      if (ch === '\\') { out += nx ?? ''; i++ } else if (ch === strCh) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") { inStr = true; strCh = ch; out += ch; continue }
    if (ch === '/' && nx === '/') { inLine = true; i++; continue }
    if (ch === '/' && nx === '*') { inBlock = true; i++; continue }
    out += ch
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

export function loadAllowList() {
  const allow = new Set()
  try {
    const settings = parseJsonc(readFileSync(SETTINGS_FILE, 'utf8'))
    for (const k of settings['i18n-ally.keysInUse'] ?? []) allow.add(k)
  } catch { /* settings.json is optional */ }
  return allow
}

/** Recursively list source files under `dir`. */
export function listSourceFiles(dir = SRC_DIR, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) listSourceFiles(full, out)
    else if (SRC_EXTS.includes(extname(name))) out.push(full)
  }
  return out
}

export const isSourceFile = (p) => SRC_EXTS.includes(extname(p))

// ---------------------------------------------------------------------------
// Source scanning (vue-i18n usages)
// ---------------------------------------------------------------------------
const CALL_RE = /(?<![\w$])\$?t[cem]?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g
const KEYPATH_RE = /\bkeypath\s*=\s*"([^"${}]+)"/g
const I18N_BLOCK_RE = /<i18n\b([^>]*)>([\s\S]*?)<\/i18n>/g
const TPL_RE = /`((?:\\.|[^`\\])*)`/g

/** Scan one source file -> { staticKeys, prefixes, localDefined, locations }. */
export function scanSource(file, content) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/')
  const staticKeys = new Set()
  const prefixes = new Set()
  const localDefined = new Set()
  const locations = new Map()

  const bodyForUsage = content.replace(I18N_BLOCK_RE, (whole, attrs, inner) => {
    const localeMatch = /locale\s*=\s*["']([^"']+)["']/.exec(attrs)
    const locale = localeMatch ? localeMatch[1] : BASE_LOCALE
    if (locale === BASE_LOCALE) {
      try {
        for (const key of flatten(yaml.load(inner)).keys()) localDefined.add(key)
      } catch { /* ignore malformed inline block */ }
    }
    return whole.replace(/[^\n]/g, ' ')
  })

  const lineAt = (index) => content.slice(0, index).split('\n').length
  const record = (raw, index) => {
    const key = raw.trim()
    if (!key) return
    if (key.includes('${')) {
      const prefix = key.slice(0, key.indexOf('${'))
      const dot = prefix.lastIndexOf('.')
      if (dot >= 0) prefixes.add(prefix.slice(0, dot + 1))
      return
    }
    if (key.endsWith('.')) { prefixes.add(key); return }
    staticKeys.add(key)
    if (!locations.has(key)) locations.set(key, `${rel}:${lineAt(index)}`)
  }

  let m
  CALL_RE.lastIndex = 0
  while ((m = CALL_RE.exec(bodyForUsage))) record(m[2], m.index)
  KEYPATH_RE.lastIndex = 0
  while ((m = KEYPATH_RE.exec(bodyForUsage))) record(m[1], m.index)
  TPL_RE.lastIndex = 0
  while ((m = TPL_RE.exec(bodyForUsage))) {
    const lit = m[1]
    const idx = lit.indexOf('${')
    if (idx < 0) continue
    const prefix = lit.slice(0, idx)
    const dot = prefix.lastIndexOf('.')
    if (dot <= 0) continue
    prefixes.add(prefix.slice(0, dot + 1))
  }
  return { staticKeys, prefixes, localDefined, locations }
}

// ---------------------------------------------------------------------------
// State: cached locale keys + per-file scans + allow-list
// ---------------------------------------------------------------------------

/** Build the full state by reading every locale + source file once. */
export function buildState() {
  const localeKeys = new Map()
  const localeErrors = new Map()
  for (const file of readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.yaml'))) {
    const locale = file.replace(/\.yaml$/, '')
    try {
      localeKeys.set(locale, flatten(yaml.load(readFileSync(join(LOCALES_DIR, file), 'utf8'))))
    } catch (e) {
      // A malformed YAML must not crash the whole lint — record it so it can be
      // reported as an `invalid` finding instead.
      localeErrors.set(locale, String(e?.message || e).split('\n')[0])
    }
  }
  const fileScans = new Map()
  for (const file of listSourceFiles()) {
    fileScans.set(file, scanSource(file, readFileSync(file, 'utf8')))
  }
  return { localeKeys, localeErrors, fileScans, allowList: loadAllowList() }
}

/** Apply a single changed/added/removed path to an existing state (in place). */
export function applyChange(state, p) {
  const abs = resolve(p)
  if (abs === SETTINGS_FILE) { state.allowList = loadAllowList(); return 'allow' }
  const inLocales = !relative(LOCALES_DIR, abs).startsWith('..')
  const inSrc = !relative(SRC_DIR, abs).startsWith('..')
  let exists = false
  try { exists = statSync(abs).isFile() } catch { exists = false }

  if (inLocales && abs.endsWith('.yaml')) {
    const locale = abs.slice(LOCALES_DIR.length + 1).replace(/\.yaml$/, '')
    if (exists) {
      try {
        state.localeKeys.set(locale, flatten(yaml.load(readFileSync(abs, 'utf8'))))
        state.localeErrors?.delete(locale)
      } catch (e) {
        // Keep the last-good keys, but flag the parse error for the next lint.
        state.localeErrors?.set(locale, String(e?.message || e).split('\n')[0])
      }
    } else {
      state.localeKeys.delete(locale)
      state.localeErrors?.delete(locale)
    }
    return 'locale'
  }
  if (inSrc && isSourceFile(abs)) {
    if (exists) state.fileScans.set(abs, scanSource(abs, readFileSync(abs, 'utf8')))
    else state.fileScans.delete(abs)
    return 'src'
  }
  return null
}

// ---------------------------------------------------------------------------
// Lint computation
// ---------------------------------------------------------------------------
export function computeLint(state) {
  const baseKeys = state.localeKeys.get(BASE_LOCALE)
  if (!baseKeys) throw new Error(`Base locale "${BASE_LOCALE}.yaml" not found`)

  const usedStatic = new Set()
  const usedPrefixes = new Set()
  const localDefined = new Set()
  const usageLocations = new Map()
  for (const res of state.fileScans.values()) {
    for (const k of res.staticKeys) usedStatic.add(k)
    for (const p of res.prefixes) usedPrefixes.add(p)
    for (const k of res.localDefined) localDefined.add(k)
    for (const [k, loc] of res.locations) if (!usageLocations.has(k)) usageLocations.set(k, loc)
  }

  const isUsed = (key) => {
    if (usedStatic.has(key) || state.allowList.has(key)) return true
    for (const p of usedPrefixes) if (key.startsWith(p)) return true
    return false
  }
  const isDefined = (key) => {
    if (baseKeys.has(key) || localDefined.has(key) || state.allowList.has(key)) return true
    const prefix = key + '.'
    for (const k of baseKeys.keys()) if (k.startsWith(prefix)) return true
    return false
  }

  const missing = [...usedStatic].filter((k) => !isDefined(k)).sort()
    .map((k) => ({ key: k, at: usageLocations.get(k) ?? '' }))
  const unused = [...baseKeys.keys()].filter((k) => !isUsed(k)).sort()
  const extra = []
  for (const [locale, keys] of state.localeKeys) {
    if (locale === BASE_LOCALE) continue
    for (const k of keys.keys()) if (!baseKeys.has(k)) extra.push({ locale, key: k })
  }
  extra.sort((a, b) => a.locale.localeCompare(b.locale) || a.key.localeCompare(b.key))
  return { missing, unused, extra, invalid: computeInvalid(state) }
}

/**
 * Validate that every locale file is well-formed: it must parse as YAML AND
 * every message string must compile with vue-i18n's message compiler. This is
 * the class of bug that only shows up at runtime (e.g. unbalanced `{}` braces,
 * a stray `@`/`|`) and previously reached users. Returns an array of
 * { locale, key, code, message }. `key` is null for whole-file YAML errors.
 */
export function computeInvalid(state) {
  const out = []
  if (state.localeErrors) {
    for (const [locale, message] of state.localeErrors) {
      out.push({ locale, key: null, code: 'yaml', message })
    }
  }
  if (baseCompile) {
    for (const [locale, keys] of state.localeKeys) {
      for (const [key, value] of keys) {
        if (typeof value !== 'string' || value.length === 0) continue
        try {
          baseCompile(value, { onError(e) { throw e } })
        } catch (e) {
          out.push({ locale, key, code: `compile${e?.code ?? ''}`, message: String(e?.message || e).split('\n')[0] })
        }
      }
    }
  }
  out.sort((a, b) => a.locale.localeCompare(b.locale) || String(a.key).localeCompare(String(b.key)))
  return out
}

// ---------------------------------------------------------------------------
// Line-based key editing (remove / rename) — operates directly on files
// ---------------------------------------------------------------------------
const indentOf = (line) => line.length - line.trimStart().length
const isSkippable = (line) => line.trim() === '' || line.trimStart().startsWith('#')

function keyOf(line) {
  const s = line.trimStart()
  if (s.startsWith("'") || s.startsWith('"')) {
    const q = s[0]
    const end = s.indexOf(q, 1)
    if (end === -1 || s[end + 1] !== ':') return null
    return s.slice(1, end)
  }
  const colon = s.indexOf(':')
  if (colon === -1) return null
  return s.slice(0, colon).trimEnd()
}

const YAML_BOOLISH = /^(y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF|null|Null|NULL|~)$/
function needsQuote(k) {
  if (k === '') return true
  if (YAML_BOOLISH.test(k)) return true
  if (/^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(k)) return true
  if (/\s$/.test(k)) return true
  if (k.includes(': ') || k.endsWith(':')) return true
  return false
}
const quoteKey = (k) => (needsQuote(k) ? `'${k.replace(/'/g, "''")}'` : k)

function locate(lines, segments) {
  let windowStart = 0
  let windowEnd = lines.length
  let expectedIndent = 0
  const parents = []
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s]
    let found = -1
    for (let i = windowStart; i < windowEnd; i++) {
      const line = lines[i]
      if (isSkippable(line)) continue
      const indent = indentOf(line)
      if (indent < expectedIndent) break
      if (indent === expectedIndent && keyOf(line) === seg) { found = i; break }
    }
    if (found === -1) return null
    const blockIndent = expectedIndent
    let blockEnd = windowEnd
    let childIndent = -1
    for (let j = found + 1; j < windowEnd; j++) {
      if (isSkippable(lines[j])) continue
      const indent = indentOf(lines[j])
      if (indent <= blockIndent) { blockEnd = j; break }
      if (childIndent === -1) childIndent = indent
    }
    if (s === segments.length - 1) {
      while (blockEnd > found + 1 && isSkippable(lines[blockEnd - 1])) blockEnd--
      return { start: found, end: blockEnd, parents }
    }
    if (childIndent === -1) return null
    parents.push(found)
    windowStart = found + 1
    windowEnd = blockEnd
    expectedIndent = childIndent
  }
  return null
}

function hasChildren(lines, idx) {
  const p = indentOf(lines[idx])
  for (let i = idx + 1; i < lines.length; i++) {
    if (isSkippable(lines[i])) continue
    return indentOf(lines[i]) > p
  }
  return false
}

function pruneParents(lines, parents) {
  for (let i = parents.length - 1; i >= 0; i--) {
    const idx = parents[i]
    if (!hasChildren(lines, idx)) lines.splice(idx, 1)
    else break
  }
}

function replaceLeafToken(line, newLeaf) {
  const indent = indentOf(line)
  const s = line.slice(indent)
  let rest
  if (s[0] === "'" || s[0] === '"') rest = s.slice(s.indexOf(s[0], 1) + 1)
  else rest = s.slice(s.indexOf(':'))
  return ' '.repeat(indent) + quoteKey(newLeaf) + rest
}

function shiftBlock(block, delta) {
  if (delta === 0) return block.slice()
  if (delta > 0) { const pad = ' '.repeat(delta); return block.map((l) => (l === '' ? l : pad + l)) }
  const cut = -delta
  return block.map((l) => l.slice(cut))
}

function findInsertion(lines, parentSegments) {
  if (parentSegments.length === 0) return { index: lines.length, baseIndent: 0, missing: [] }
  let k = parentSegments.length
  let parentHit = null
  while (k > 0) {
    parentHit = locate(lines, parentSegments.slice(0, k))
    if (parentHit) break
    k--
  }
  if (k === 0 || !parentHit) return { index: lines.length, baseIndent: 0, missing: parentSegments.slice() }
  const parentIndent = indentOf(lines[parentHit.start])
  return { index: parentHit.end, baseIndent: parentIndent + INDENT, missing: parentSegments.slice(k) }
}

const readLines = (raw) => raw.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
const localeFilesFor = (only) => {
  let files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.yaml'))
  if (only && only.length) files = files.filter((f) => only.includes(f.replace(/\.yaml$/, '')))
  return files
}

/** Remove one key (leaf or subtree) from a single line array. */
function removeKeyFromLines(lines, key, keepEmpty) {
  const hit = locate(lines, key.split('.'))
  if (!hit) return false
  lines.splice(hit.start, hit.end - hit.start)
  if (!keepEmpty) pruneParents(lines, hit.parents)
  return true
}

/** Remove keys across locale files. opts: { locales, keepEmpty, dryRun }. */
export function removeKeys(keys, opts = {}) {
  const files = localeFilesFor(opts.locales)
  const perFile = []
  const seen = new Set()
  let totalRemoved = 0
  for (const file of files) {
    const path = join(LOCALES_DIR, file)
    const raw = readFileSync(path, 'utf8')
    const eol = raw.includes('\r\n') ? '\r\n' : '\n'
    const trailing = raw.endsWith(eol) ? eol : ''
    const lines = readLines(raw)
    const removed = []
    for (const key of keys) {
      if (removeKeyFromLines(lines, key, opts.keepEmpty)) { removed.push(key); seen.add(key); totalRemoved++ }
    }
    if (removed.length === 0) continue
    perFile.push({ file, removed })
    if (!opts.dryRun) writeFileSync(path, lines.join('\n') + trailing, 'utf8')
  }
  return { perFile, totalRemoved, filesChanged: perFile.length, notFound: keys.filter((k) => !seen.has(k)), files: files.length }
}

/** Rename one key across locale files. opts: { locales, keepEmpty, dryRun }. */
export function renameKey(oldKey, newKey, opts = {}) {
  const files = localeFilesFor(opts.locales)
  const oldSegs = oldKey.split('.')
  const newSegs = newKey.split('.')
  const newParentSegs = newSegs.slice(0, -1)
  const newLeaf = newSegs[newSegs.length - 1]
  const newLeafIndent = newParentSegs.length * INDENT

  const perFile = []
  let renamed = 0
  let skippedExisting = 0
  let notFound = 0
  for (const file of files) {
    const path = join(LOCALES_DIR, file)
    const raw = readFileSync(path, 'utf8')
    const eol = raw.includes('\r\n') ? '\r\n' : '\n'
    const trailing = raw.endsWith(eol) ? eol : ''
    const lines = readLines(raw)

    if (locate(lines, newSegs)) { perFile.push({ file, status: 'target-exists' }); skippedExisting++; continue }
    const hit = locate(lines, oldSegs)
    if (!hit) { notFound++; continue }

    const oldLeafIndent = indentOf(lines[hit.start])
    let block = lines.slice(hit.start, hit.end)
    block[0] = replaceLeafToken(block[0], newLeaf)
    block = shiftBlock(block, newLeafIndent - oldLeafIndent)

    lines.splice(hit.start, hit.end - hit.start)
    if (!opts.keepEmpty) pruneParents(lines, hit.parents)

    const ins = findInsertion(lines, newParentSegs)
    const chunk = []
    let ind = ins.baseIndent
    for (const seg of ins.missing) { chunk.push(' '.repeat(ind) + quoteKey(seg) + ':'); ind += INDENT }
    chunk.push(...block)
    lines.splice(ins.index, 0, ...chunk)

    perFile.push({ file, status: 'renamed' })
    renamed++
    if (!opts.dryRun) writeFileSync(path, lines.join('\n') + trailing, 'utf8')
  }
  return { perFile, renamed, skippedExisting, notFound, files: files.length }
}
