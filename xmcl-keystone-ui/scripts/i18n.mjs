#!/usr/bin/env node
// @ts-nocheck
/**
 * Unified i18n CLI for the renderer locales, backed by an optional caching
 * daemon that watches `src/` and `locales/` so repeated lints never re-scan
 * unchanged files.
 *
 *   node scripts/i18n.mjs <command> [options]
 *
 * Commands:
 *   lint    [--missing|--unused|--extra] [--strict] [--json] [--watch] [--no-daemon]
 *   remove  <key> [<key> …]            [--dry-run] [--locale=en,zh] [--keep-empty]
 *   rename  <oldKey> <newKey>          [--dry-run] [--locale=en,zh] [--keep-empty]
 *   daemon                              run the watcher/server in the foreground
 *   start                               spawn the daemon in the background
 *   stop                                stop a running daemon
 *   status                              show daemon status
 *
 * `lint` automatically uses a running daemon for an instant, cache-backed
 * result; with no daemon it falls back to a one-shot scan. `remove`/`rename`
 * edit the YAML files directly (a running daemon picks up the change via its
 * watcher).
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, watch, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BASE_LOCALE, LOCALES_DIR, SETTINGS_FILE, SRC_DIR, applyChange, buildState,
  computeLint, isSourceFile, removeKeys, renameKey,
} from './i18n-core.mjs'

const __filename = fileURLToPath(import.meta.url)
const idHash = createHash('sha1').update(SRC_DIR).digest('hex').slice(0, 8)
const PIPE = process.platform === 'win32'
  ? `\\\\.\\pipe\\xmcl-i18n-${idHash}`
  : join(os.tmpdir(), `xmcl-i18n-${idHash}.sock`)
const PIDFILE = join(os.tmpdir(), `xmcl-i18n-${idHash}.pid`)

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2)
const command = argv[0]
const rest = argv.slice(1)
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const positional = rest.filter((a) => !a.startsWith('--'))
const flagValue = (name) => {
  const f = [...flags].find((x) => x.startsWith(`--${name}=`))
  return f ? f.slice(name.length + 3) : null
}
const localesOpt = () => {
  const v = flagValue('locale')
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null
}

// ---------------------------------------------------------------------------
// IPC client
// ---------------------------------------------------------------------------
function request(req, timeout = 5000) {
  return new Promise((resolve) => {
    const sock = net.connect(PIPE)
    let buf = ''
    let done = false
    const finish = (v) => { if (!done) { done = true; try { sock.destroy() } catch {} resolve(v) } }
    sock.setTimeout(timeout, () => finish(null))
    sock.on('connect', () => sock.write(JSON.stringify(req) + '\n'))
    sock.on('data', (d) => {
      buf += d
      const i = buf.indexOf('\n')
      if (i >= 0) { try { finish(JSON.parse(buf.slice(0, i))) } catch { finish(null) } }
    })
    sock.on('error', () => finish(null))
    sock.on('close', () => finish(null))
  })
}

// ---------------------------------------------------------------------------
// Lint printing
// ---------------------------------------------------------------------------
function printLint(result, opts) {
  const { missing, unused, extra, invalid = [] } = result
  const anyFilter = opts.onlyMissing || opts.onlyUnused || opts.onlyExtra
  const showMissing = !anyFilter || opts.onlyMissing
  const showUnused = !anyFilter || opts.onlyUnused
  const showExtra = !anyFilter || opts.onlyExtra

  if (opts.json) {
    console.log(JSON.stringify({
      invalid,
      missing: showMissing ? missing : undefined,
      unused: showUnused ? unused : undefined,
      extra: showExtra ? extra : undefined,
    }, null, 2))
    return
  }
  // `invalid` is always reported — a locale that doesn't parse/compile is a
  // hard error regardless of which filters are active.
  if (invalid.length) {
    console.log(c.bold(c.red(`\n✖ ${invalid.length} invalid message(s)`)) + c.dim(' (unparseable YAML or uncompilable vue-i18n message)'))
    for (const { locale, key, code, message } of invalid) {
      const where = key ? `${locale}  ${key}` : `${locale}  ${c.dim('(whole file)')}`
      console.log(`  ${c.red(where)}  ${c.dim(`[${code}] ${message}`)}`)
    }
  } else console.log(c.green('✔ all locale messages parse & compile'))
  if (showMissing) {
    if (missing.length) {
      console.log(c.bold(c.red(`\n✖ ${missing.length} missing key(s)`)) + c.dim(' (used in code, absent from en.yaml)'))
      for (const { key, at } of missing) console.log(`  ${c.red(key)}  ${c.dim(at)}`)
    } else console.log(c.green('✔ no missing keys'))
  }
  if (showUnused) {
    if (unused.length) {
      console.log(c.bold(c.yellow(`\n⚠ ${unused.length} unused key(s)`)) + c.dim(' (in en.yaml, never referenced)'))
      for (const key of unused) console.log(`  ${c.yellow(key)}`)
    } else console.log(c.green('✔ no unused keys'))
  }
  if (showExtra) {
    if (extra.length) {
      console.log(c.bold(c.yellow(`\n⚠ ${extra.length} extra key(s)`)) + c.dim(' (in a translation locale, absent from en.yaml)'))
      for (const { locale, key } of extra) console.log(`  ${c.dim(locale)}  ${c.yellow(key)}`)
    } else console.log(c.green('✔ no extra keys in translation locales'))
  }
  console.log('')
}

function lintExitCode(result, opts) {
  const anyFilter = opts.onlyMissing || opts.onlyUnused || opts.onlyExtra
  const showMissing = !anyFilter || opts.onlyMissing
  const showUnused = !anyFilter || opts.onlyUnused
  const showExtra = !anyFilter || opts.onlyExtra
  if (result.invalid?.length) return 1
  if (showMissing && result.missing.length) return 1
  if (opts.strict && showUnused && result.unused.length) return 1
  if (opts.strict && showExtra && result.extra.length) return 1
  return 0
}

// ---------------------------------------------------------------------------
// File watcher (used by the daemon and by `lint --watch`)
// ---------------------------------------------------------------------------
function watchTree(roots, onChange) {
  const watchers = new Map()
  const ignored = (name) => name === 'node_modules' || name === 'dist' || name.startsWith('.')
  const addDir = (dir) => {
    if (watchers.has(dir)) return
    let w
    try {
      w = watch(dir, (event, name) => {
        if (!name) return
        const full = join(dir, name)
        try { if (statSync(full).isDirectory()) addDir(full) } catch { /* removed */ }
        onChange(full)
      })
    } catch { return }
    watchers.set(dir, w)
    try {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory() && !ignored(e.name)) addDir(join(dir, e.name))
      }
    } catch { /* dir vanished */ }
  }
  for (const r of roots) addDir(r)
  // Watch the settings file's directory so we can react to allow-list edits.
  try {
    const dir = dirname(SETTINGS_FILE)
    if (!watchers.has(dir)) {
      watchers.set(dir, watch(dir, (_e, name) => { if (name && join(dir, name) === SETTINGS_FILE) onChange(SETTINGS_FILE) }))
    }
  } catch { /* optional */ }
  return () => { for (const w of watchers.values()) try { w.close() } catch {} }
}

/** Debounce changes and apply them to `state`, calling `after` once settled. */
function makeChangeApplier(state, after) {
  const pending = new Set()
  let timer = null
  return (path) => {
    const abs = resolve(path)
    if (abs !== SETTINGS_FILE && !abs.endsWith('.yaml') && !isSourceFile(abs)) return
    pending.add(abs)
    clearTimeout(timer)
    timer = setTimeout(() => {
      const changed = [...pending]
      pending.clear()
      let touched = false
      for (const p of changed) if (applyChange(state, p)) touched = true
      if (touched) after(changed)
    }, 150)
  }
}

// ---------------------------------------------------------------------------
// Daemon server
// ---------------------------------------------------------------------------
function runDaemon() {
  const t0 = Date.now()
  const state = buildState()
  const apply = makeChangeApplier(state, (changed) => {
    console.log(c.dim(`[${new Date().toLocaleTimeString()}] refreshed (${changed.length} change(s))`))
  })
  const stopWatch = watchTree([SRC_DIR, LOCALES_DIR], apply)

  const handle = async (req) => {
    switch (req?.cmd) {
      case 'ping': return { ok: true, pong: true }
      case 'status': return {
        ok: true, pid: process.pid, locales: state.localeKeys.size,
        sourceFiles: state.fileScans.size, allowList: state.allowList.size,
      }
      case 'lint': try { return { ok: true, result: computeLint(state) } } catch (e) { return { ok: false, error: String(e?.message || e) } }
      case 'stop': setTimeout(() => { stopWatch(); try { unlinkSync(PIDFILE) } catch {} process.exit(0) }, 10); return { ok: true, stopping: true }
      default: return { ok: false, error: `unknown cmd: ${req?.cmd}` }
    }
  }

  const server = net.createServer((sock) => {
    let buf = ''
    sock.on('data', (d) => {
      buf += d
      const i = buf.indexOf('\n')
      if (i < 0) return
      let req
      try { req = JSON.parse(buf.slice(0, i)) } catch { sock.end(); return }
      handle(req).then((res) => sock.end(JSON.stringify(res) + '\n'))
    })
    sock.on('error', () => {})
  })
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') { console.error(c.red('A daemon is already running.')); process.exit(1) }
    throw e
  })
  if (process.platform !== 'win32') { try { unlinkSync(PIPE) } catch {} }
  server.listen(PIPE, () => {
    try { writeFileSync(PIDFILE, String(process.pid)) } catch {}
    console.log(c.green(`i18n daemon ready`) + c.dim(` — ${state.fileScans.size} source files, ${state.localeKeys.size} locales in ${Date.now() - t0}ms`))
    console.log(c.dim(`watching ${SRC_DIR} and ${LOCALES_DIR}\nlistening on ${PIPE}\nrun "i18n lint" in another shell for instant results; Ctrl+C or "i18n stop" to quit.`))
  })
  const shutdown = () => { stopWatch(); try { unlinkSync(PIDFILE) } catch {} process.exit(0) }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function cmdLint() {
  const opts = {
    onlyMissing: flags.has('--missing'), onlyUnused: flags.has('--unused'),
    onlyExtra: flags.has('--extra'), strict: flags.has('--strict'), json: flags.has('--json'),
  }

  if (flags.has('--watch')) {
    // Foreground continuous lint: build once, re-lint on every change.
    const state = buildState()
    const render = () => {
      if (!opts.json) process.stdout.write('\x1b[2J\x1b[H') // clear screen
      printLint(computeLint(state), opts)
      console.log(c.dim('watching for changes… Ctrl+C to exit'))
    }
    render()
    const apply = makeChangeApplier(state, render)
    watchTree([SRC_DIR, LOCALES_DIR], apply)
    return // keep process alive
  }

  let result = null
  if (!flags.has('--no-daemon')) {
    const res = await request({ cmd: 'lint' })
    if (res?.ok) result = res.result
  }
  if (!result) result = computeLint(buildState())
  printLint(result, opts)
  process.exit(lintExitCode(result, opts))
}

function cmdRemove() {
  if (positional.length === 0) { console.error('Usage: i18n remove <key> [<key> …] [--dry-run] [--locale=en,zh] [--keep-empty]'); process.exit(2) }
  const dryRun = flags.has('--dry-run')
  const r = removeKeys(positional, { locales: localesOpt(), keepEmpty: flags.has('--keep-empty'), dryRun })
  for (const { file, removed } of r.perFile) {
    console.log(`${dryRun ? c.yellow('would edit') : c.green('edited')} ${c.bold(file)} ${c.dim(`(-${removed.length}: ${removed.join(', ')})`)}`)
  }
  console.log('')
  if (r.notFound.length) console.log(c.yellow(`Not found in any locale: ${r.notFound.join(', ')}`))
  if (r.totalRemoved === 0) { console.log(c.red(`No matching keys found in ${r.files} locale file(s).`)); process.exit(1) }
  console.log(c.bold(`${dryRun ? 'Would remove' : 'Removed'} ${r.totalRemoved} occurrence(s) across ${r.filesChanged} file(s).`))
  if (dryRun) console.log(c.dim('Dry run — no files were written.'))
}

function cmdRename() {
  const [oldKey, newKey] = positional
  if (!oldKey || !newKey || positional.length !== 2) { console.error('Usage: i18n rename <oldKey> <newKey> [--dry-run] [--locale=en,zh] [--keep-empty]'); process.exit(2) }
  if (oldKey === newKey) { console.error('oldKey and newKey are identical.'); process.exit(2) }
  if (newKey.startsWith(oldKey + '.') || oldKey.startsWith(newKey + '.')) { console.error('Cannot rename a key into its own ancestor or descendant.'); process.exit(2) }
  const dryRun = flags.has('--dry-run')
  const r = renameKey(oldKey, newKey, { locales: localesOpt(), keepEmpty: flags.has('--keep-empty'), dryRun })
  for (const { file, status } of r.perFile) {
    if (status === 'renamed') console.log(`${dryRun ? c.yellow('would rename') : c.green('renamed')} ${c.bold(file)} ${c.dim(`(${oldKey} → ${newKey})`)}`)
    else if (status === 'target-exists') console.log(`${c.yellow('skipped')} ${c.bold(file)} ${c.dim(`(target ${newKey} already exists)`)}`)
  }
  console.log('')
  if (r.notFound) console.log(c.dim(`${oldKey} not present in ${r.notFound} locale file(s).`))
  if (r.renamed === 0) { console.log(c.red(r.skippedExisting ? 'Nothing renamed — target already exists.' : `Key "${oldKey}" not found in any locale file.`)); process.exit(1) }
  console.log(c.bold(`${dryRun ? 'Would rename' : 'Renamed'} ${oldKey} → ${newKey} in ${r.renamed} file(s).`))
  if (r.skippedExisting) console.log(c.yellow(`Skipped ${r.skippedExisting} file(s) where the target already existed.`))
  if (dryRun) console.log(c.dim('Dry run — no files were written.'))
}

async function cmdStart() {
  const ping = await request({ cmd: 'ping' }, 800)
  if (ping?.ok) { console.log(c.yellow('Daemon already running.')); return }
  const child = spawn(process.execPath, [__filename, 'daemon'], { detached: true, stdio: 'ignore' })
  child.unref()
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 100))
    const res = await request({ cmd: 'status' }, 500)
    if (res?.ok) { console.log(c.green(`Daemon started (pid ${res.pid}) — ${res.sourceFiles} source files, ${res.locales} locales.`)); return }
  }
  console.error(c.red('Daemon did not come up in time.'))
  process.exit(1)
}

async function cmdStop() {
  const res = await request({ cmd: 'stop' }, 1500)
  if (res?.ok) { console.log(c.green('Daemon stopped.')); return }
  // Fall back to pidfile.
  try {
    const pid = parseInt(readFileSync(PIDFILE, 'utf8'), 10)
    process.kill(pid)
    try { unlinkSync(PIDFILE) } catch {}
    console.log(c.green(`Daemon (pid ${pid}) terminated.`))
  } catch { console.log(c.yellow('No running daemon found.')) }
}

async function cmdStatus() {
  const res = await request({ cmd: 'status' }, 1000)
  if (res?.ok) console.log(c.green(`running`) + c.dim(` — pid ${res.pid}, ${res.sourceFiles} source files, ${res.locales} locales, ${res.allowList} allow-listed keys.`))
  else console.log(c.yellow('not running'))
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
const HELP = `Usage: i18n <command> [options]

Commands:
  lint     check missing / unused / extra keys   [--missing|--unused|--extra] [--strict] [--json] [--watch] [--no-daemon]
  remove   delete one or more keys               <key> [<key> …] [--dry-run] [--locale=en,zh] [--keep-empty]
  rename   move/rename a key                      <oldKey> <newKey> [--dry-run] [--locale=en,zh] [--keep-empty]
  daemon   run the watcher/server (foreground)
  start    start the daemon in the background
  stop     stop the running daemon
  status   show daemon status`

switch (command) {
  case 'lint': cmdLint(); break
  case 'remove': case 'rm': cmdRemove(); break
  case 'rename': case 'mv': cmdRename(); break
  case 'daemon': runDaemon(); break
  case 'start': cmdStart(); break
  case 'stop': cmdStop(); break
  case 'status': cmdStatus(); break
  case undefined: case '--help': case '-h': case 'help': console.log(HELP); break
  default: console.error(c.red(`Unknown command: ${command}\n`)); console.log(HELP); process.exit(2)
}
