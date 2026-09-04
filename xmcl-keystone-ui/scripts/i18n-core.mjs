// @ts-nocheck
/**
 * i18n-core — shared logic for the unified i18n CLI / daemon.
 *
 * Pure(ish) helpers: locale loading, source scanning, lint computation, and
 * surgical line-based key removal / renaming. No side effects on import.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseCompile } from '@intlify/message-compiler'
import { NodeTypes, baseParse } from '@vue/compiler-dom'
import { parse as parseSfc } from '@vue/compiler-sfc'
import yaml from 'js-yaml'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const UI_ROOT = resolve(__dirname, '..')
export const REPO_ROOT = resolve(UI_ROOT, '..')

// ---------------------------------------------------------------------------
// vue-i18n message compiler — used to validate that every locale string
// actually compiles, catching the `createCompileError` / SyntaxError class of
// bugs (e.g. unbalanced braces) that otherwise only surface at runtime.
// ---------------------------------------------------------------------------
export const LOCALES_DIR = join(UI_ROOT, 'locales')
export const SRC_DIR = join(UI_ROOT, 'src')
export const MAIN_SRC_DIR = join(REPO_ROOT, 'xmcl-electron-app', 'main')
export const MAIN_LOCALES_DIR = join(MAIN_SRC_DIR, 'locales')
export const MAIN_DEFINED_LOCALES_FILE = join(MAIN_SRC_DIR, 'definedLocales.ts')
export const SETTINGS_FILE = join(REPO_ROOT, '.vscode', 'settings.json')
export const BASE_LOCALE = 'en'
export const INDENT = 2
const SRC_EXTS = ['.vue', '.ts', '.tsx', '.js', '.jsx']

// ---------------------------------------------------------------------------
// YAML / object helpers
// ---------------------------------------------------------------------------

/** Flatten a nested message object into a Map of dot-joined key -> leaf value. */
export function flatten(obj, prefix = '', out = new Map()) {
  if (obj === null || obj === undefined) return out
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
    else if (SRC_EXTS.includes(extname(name)) && !/\.(?:test|spec)\.[^.]+$/.test(name)) out.push(full)
  }
  return out
}

export const isSourceFile = (p) => SRC_EXTS.includes(extname(p))

function loadLocaleKeys(directory, locales) {
  const localeKeys = new Map()
  const localeErrors = new Map()
  const localeNames = new Set()
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.yaml'))) {
    const locale = file.replace(/\.yaml$/, '')
    if (locales && !locales.has(locale)) continue
    localeNames.add(locale)
    try {
      localeKeys.set(locale, flatten(yaml.load(readFileSync(join(directory, file), 'utf8'))))
    } catch (e) {
      localeErrors.set(locale, String(e?.message || e).split('\n')[0])
    }
  }
  return { localeKeys, localeErrors, localeNames }
}

function readDefinedMainLocales() {
  const content = readFileSync(MAIN_DEFINED_LOCALES_FILE, 'utf8')
  const sourceFile = ts.createSourceFile(MAIN_DEFINED_LOCALES_FILE, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const imports = new Map()
  let initializer
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause?.name && ts.isStringLiteral(statement.moduleSpecifier)) {
      const match = /\.\/locales\/([^/]+)\.yaml$/.exec(statement.moduleSpecifier.text)
      if (match) imports.set(statement.importClause.name.text, match[1])
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === 'definedLocales') initializer = declaration.initializer
      }
    }
  }
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) throw new Error('Cannot read definedLocales from Electron main process')
  const locales = new Set()
  for (const property of initializer.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      const locale = imports.get(property.name.text)
      if (locale) locales.add(locale)
    } else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)) {
      const locale = imports.get(property.initializer.text)
      if (locale) locales.add(locale)
    }
  }
  return locales
}

// ---------------------------------------------------------------------------
// Source scanning (vue-i18n usages)
// ---------------------------------------------------------------------------
const TRANSLATION_FUNCTION_RE = /^\$?t[cem]?$/

/** Scan one source file -> { staticKeys, prefixes, localDefined, locations }. */
export function scanSource(file, content) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/')
  const staticKeys = new Set()
  const prefixes = new Set()
  const localDefined = new Set()
  const localMessages = new Map()
  const localErrors = new Map()
  const locations = new Map()

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

  const isTranslationCall = (expression) => {
    if (ts.isIdentifier(expression)) return TRANSLATION_FUNCTION_RE.test(expression.text)
    return ts.isPropertyAccessExpression(expression) && TRANSLATION_FUNCTION_RE.test(expression.name.text)
  }
  const scanScript = (source, offset, scriptKind = ts.ScriptKind.TS) => {
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)
    const recordArgument = (argument) => {
      if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
        record(argument.text, offset + argument.getStart(sourceFile))
      } else if (ts.isTemplateExpression(argument)) {
        record(`${argument.head.text}\${}`, offset + argument.getStart(sourceFile))
      } else if (ts.isConditionalExpression(argument)) {
        recordArgument(argument.whenTrue)
        recordArgument(argument.whenFalse)
      } else if (ts.isParenthesizedExpression(argument)) {
        recordArgument(argument.expression)
      } else if (ts.isBinaryExpression(argument) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(argument.operatorToken.kind)) {
        recordArgument(argument.left)
        recordArgument(argument.right)
      }
    }
    const visit = (node) => {
      if (ts.isCallExpression(node) && isTranslationCall(node.expression)) {
        const argument = node.arguments[0]
        if (argument) recordArgument(argument)
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }

  if (extname(file) !== '.vue') {
    const scriptKind = extname(file).includes('x') ? ts.ScriptKind.TSX : extname(file) === '.js' ? ts.ScriptKind.JS : ts.ScriptKind.TS
    scanScript(content, 0, scriptKind)
    return { staticKeys, prefixes, localDefined, localMessages, localErrors, source: rel, locations }
  }

  const { descriptor } = parseSfc(content, { filename: file })
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (block) scanScript(block.content, block.loc.start.offset, block.lang === 'js' ? ts.ScriptKind.JS : ts.ScriptKind.TS)
  }
  for (const block of descriptor.customBlocks.filter((candidate) => candidate.type === 'i18n')) {
    const locale = block.attrs.locale ?? BASE_LOCALE
    try {
      const messages = flatten(yaml.load(block.content))
      const existing = localMessages.get(locale) ?? new Map()
      for (const [key, value] of messages) existing.set(key, value)
      localMessages.set(locale, existing)
      if (locale === BASE_LOCALE) for (const key of messages.keys()) localDefined.add(key)
    } catch (e) {
      localErrors.set(locale, String(e?.message || e).split('\n')[0])
    }
  }

  if (descriptor.template) {
    const templateOffset = descriptor.template.loc.start.offset
    const root = baseParse(descriptor.template.content, { onError() {} })
    const scanExpression = (expression) => {
      if (expression?.type === NodeTypes.SIMPLE_EXPRESSION && !expression.isStatic) {
        scanScript(expression.content, templateOffset + expression.loc.start.offset)
      }
    }
    const walk = (node) => {
      if (node.type === NodeTypes.INTERPOLATION) scanExpression(node.content)
      if (node.type === NodeTypes.ELEMENT) {
        for (const prop of node.props) {
          if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'keypath' && prop.value) {
            record(prop.value.content, templateOffset + prop.value.loc.start.offset)
          } else if (prop.type === NodeTypes.DIRECTIVE) {
            scanExpression(prop.exp)
          }
        }
      }
      if (node.children) for (const child of node.children) walk(child)
      if (node.branches) for (const branch of node.branches) walk(branch)
    }
    walk(root)
  }
  return { staticKeys, prefixes, localDefined, localMessages, localErrors, source: rel, locations }
}

// ---------------------------------------------------------------------------
// State: cached locale keys + per-file scans + allow-list
// ---------------------------------------------------------------------------

/** Build the full state by reading every locale + source file once. */
export function buildState() {
  const { localeKeys, localeErrors, localeNames } = loadLocaleKeys(LOCALES_DIR)
  const fileScans = new Map()
  for (const file of listSourceFiles()) {
    fileScans.set(file, scanSource(file, readFileSync(file, 'utf8')))
  }
  return { localeKeys, localeErrors, localeNames, fileScans, allowList: loadAllowList() }
}

export function buildMainState() {
  const { localeKeys, localeErrors, localeNames } = loadLocaleKeys(MAIN_LOCALES_DIR, readDefinedMainLocales())
  const fileScans = new Map()
  for (const file of listSourceFiles(MAIN_SRC_DIR)) {
    fileScans.set(file, scanSource(file, readFileSync(file, 'utf8')))
  }
  return { localeKeys, localeErrors, localeNames, fileScans, allowList: new Set() }
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
      state.localeNames?.add(locale)
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
      state.localeNames?.delete(locale)
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
  const usageLocations = new Map()
  for (const res of state.fileScans.values()) {
    for (const k of res.staticKeys) if (!res.localDefined.has(k)) usedStatic.add(k)
    for (const p of res.prefixes) usedPrefixes.add(p)
    for (const [k, loc] of res.locations) if (!usageLocations.has(k)) usageLocations.set(k, loc)
  }

  const isUsed = (key) => {
    if (usedStatic.has(key) || state.allowList.has(key)) return true
    for (const p of usedPrefixes) if (key.startsWith(p)) return true
    return false
  }
  const missingByKey = new Map()
  for (const res of state.fileScans.values()) {
    for (const key of res.staticKeys) {
      if (baseKeys.has(key) || res.localDefined.has(key) || state.allowList.has(key)) continue
      if (!missingByKey.has(key)) missingByKey.set(key, { key, at: res.locations.get(key) ?? '' })
    }
  }
  const missing = [...missingByKey.values()].sort((a, b) => a.key.localeCompare(b.key))
  const unused = [...baseKeys.keys()].filter((k) => !isUsed(k)).sort()
  const extra = []
  const coverage = []
  const { invalid, warnings } = computeMessageDiagnostics(state)
  const invalidKeys = new Set(invalid.filter(({ key }) => key !== null).map(({ locale, key }) => `${locale}\0${key}`))
  const localeNames = state.localeNames ?? new Set([...state.localeKeys.keys(), ...state.localeErrors.keys()])
  for (const locale of localeNames) {
    if (locale === BASE_LOCALE) continue
    const keys = state.localeKeys.get(locale) ?? new Map()
    for (const k of keys.keys()) if (!baseKeys.has(k)) extra.push({ locale, key: k })
    const translated = state.localeErrors.has(locale)
      ? 0
      : [...baseKeys.keys()].filter((key) => keys.has(key) && !invalidKeys.has(`${locale}\0${key}`)).length
    coverage.push({
      locale,
      translated,
      total: baseKeys.size,
      missing: baseKeys.size - translated,
      percent: Number((translated * 100 / baseKeys.size).toFixed(1)),
    })
  }
  extra.sort((a, b) => a.locale.localeCompare(b.locale) || a.key.localeCompare(b.key))
  coverage.sort((a, b) => b.percent - a.percent || a.locale.localeCompare(b.locale))
  for (const result of state.fileScans.values()) {
    if (!result.localMessages?.size && !result.localErrors?.size) continue
    const inline = computeMessageDiagnostics({ localeKeys: result.localMessages, localeErrors: result.localErrors })
    invalid.push(...inline.invalid.map((diagnostic) => ({ ...diagnostic, file: result.source })))
    warnings.push(...inline.warnings.map((diagnostic) => ({ ...diagnostic, file: result.source })))
  }
  const sortDiagnostics = (a, b) => a.locale.localeCompare(b.locale) || String(a.key).localeCompare(String(b.key)) || String(a.file).localeCompare(String(b.file))
  invalid.sort(sortDiagnostics)
  warnings.sort(sortDiagnostics)
  return { missing, unused, extra, invalid, warnings, coverage }
}

/**
 * Validate that every locale file is well-formed: it must parse as YAML AND
 * every message string must compile with vue-i18n's message compiler. This is
 * the class of bug that only shows up at runtime (e.g. unbalanced `{}` braces,
 * a stray `@`/`|`) and previously reached users. Returns an array of
 * { locale, key, code, message }. `key` is null for whole-file YAML errors.
 */
function computeMessageDiagnostics(state) {
  const invalid = []
  const warnings = []
  const argumentsByLocale = new Map()
  if (state.localeErrors) {
    for (const [locale, message] of state.localeErrors) {
      invalid.push({ locale, key: null, code: 'yaml', message })
    }
  }
  for (const [locale, keys] of state.localeKeys) {
    const localeArguments = new Map()
    argumentsByLocale.set(locale, localeArguments)
    for (const [key, value] of keys) {
      if (typeof value !== 'string') {
        const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
        invalid.push({ locale, key, code: 'type', message: `Expected a string message, got ${type}` })
        continue
      }
      if (value.trim().length === 0) {
        invalid.push({ locale, key, code: 'empty', message: 'Message must not be empty' })
        continue
      }
      try {
        const { ast } = baseCompile(value, { onError(e) { throw e } })
        const argumentsUsed = new Set()
        const visit = (node) => {
          if (!node || typeof node !== 'object') return
          // @intlify/message-compiler uses node types 4 and 5 for named and list interpolations.
          if (node.type === 4 && typeof node.key === 'string') argumentsUsed.add(node.key)
          if (node.type === 5 && Number.isInteger(node.index)) argumentsUsed.add(`#${node.index}`)
          for (const child of Object.values(node)) {
            if (Array.isArray(child)) child.forEach(visit)
            else visit(child)
          }
        }
        visit(ast)
        localeArguments.set(key, argumentsUsed)
      } catch (e) {
        invalid.push({ locale, key, code: `compile${e?.code ?? ''}`, message: String(e?.message || e).split('\n')[0] })
      }
    }
  }
  const baseArguments = argumentsByLocale.get(BASE_LOCALE) ?? new Map()
  for (const [locale, keys] of argumentsByLocale) {
    if (locale === BASE_LOCALE) continue
    for (const [key, actual] of keys) {
      const expected = baseArguments.get(key)
      if (!expected) continue
      const missing = [...expected].filter((name) => !actual.has(name)).sort()
      const extra = [...actual].filter((name) => !expected.has(name)).sort()
      if (extra.length) {
        const parts = []
        if (missing.length) parts.push(`missing: ${missing.join(', ')}`)
        if (extra.length) parts.push(`extra: ${extra.join(', ')}`)
        invalid.push({ locale, key, code: 'placeholders', message: `Placeholder mismatch (${parts.join('; ')})`, missing, extra })
      } else if (missing.length) {
        warnings.push({ locale, key, code: 'placeholders-missing', message: `Translation omits placeholders: ${missing.join(', ')}`, missing })
      }
    }
  }
  const sortDiagnostics = (a, b) => a.locale.localeCompare(b.locale) || String(a.key).localeCompare(String(b.key))
  invalid.sort(sortDiagnostics)
  warnings.sort(sortDiagnostics)
  return { invalid, warnings }
}

export function computeInvalid(state) {
  return computeMessageDiagnostics(state).invalid
}

export function computeWarnings(state) {
  return computeMessageDiagnostics(state).warnings
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
