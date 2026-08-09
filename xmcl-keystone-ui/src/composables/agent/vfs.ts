import { parseShaderOptions, stringifyShaderOptions, type LaunchHistoryRecord } from '@xmcl/runtime-api'

export interface VfsReplacement {
  match: string
  replace: string
  all?: boolean
}
export function filterAgentLogFiles(files: string[]) {
  return files.filter(file => !file.toLowerCase().endsWith('.gz'))
}

export type VfsWriteChange =
  | { content: string; replacements?: never }
  | { content?: never; replacements: VfsReplacement[] }

export interface VfsRootStats {
  mods?: { total: number; enabled: number; disabled: number }
  resourcePacks?: { total: number; enabled: number; disabled: number }
  shaderPacks?: { total: number; enabled: number; disabled: number }
  saves?: number
  logs?: number
  crashReports?: number
  launches?: number
  config?: number
  artifacts?: number
  gameProcesses?: number
  remoteServer?: string
}

export interface VfsDirectoryEntry {
  name: string
  type: 'folder' | 'file'
  summary: string
  counts?: Record<string, number>
}

export function createVfsRootEntries(stats: VfsRootStats): VfsDirectoryEntry[] {
  const resourceFolder = (name: string, label: string, counts: VfsRootStats['mods']): VfsDirectoryEntry => ({
    name,
    type: 'folder',
    summary: counts
      ? `${counts.total} installed ${label}: ${counts.enabled} enabled, ${counts.disabled} disabled.`
      : `Installed ${label}; summary unavailable.`,
    ...(counts ? { counts } : {}),
  })
  const countedFolder = (name: string, label: string, count: number | undefined): VfsDirectoryEntry => ({
    name,
    type: 'folder',
    summary: count === undefined ? `${label}; summary unavailable.` : `${count} ${label}.`,
    ...(count === undefined ? {} : { counts: { total: count } }),
  })

  return [
    resourceFolder('mods', 'mods', stats.mods),
    resourceFolder('resourcepacks', 'resource packs', stats.resourcePacks),
    resourceFolder('shaderpacks', 'shader packs', stats.shaderPacks),
    countedFolder('saves', 'saved worlds', stats.saves),
    countedFolder('logs', 'original instance log files', stats.logs),
    countedFolder('crash-reports', 'original instance crash reports', stats.crashReports),
    countedFolder('launches', 'recorded game launches with associated evidence', stats.launches),
    countedFolder('config', 'instance config files', stats.config),
    ...(stats.artifacts ? [countedFolder('artifacts', 'temporary Agent tool-output files', stats.artifacts)] : []),
    {
      name: 'server',
      type: 'folder',
      summary: 'Local dedicated server configuration and logs.',
    },
    ...(stats.remoteServer ? [{
      name: 'remote',
      type: 'folder' as const,
      summary: `Remote dedicated server at ${stats.remoteServer}.`,
    }] : []),
    countedFolder('game-processes', 'running game processes for this instance', stats.gameProcesses),
    { name: 'instance.json', type: 'file', summary: 'Selected instance metadata and runtime settings.' },
    { name: 'options.txt', type: 'file', summary: 'Parsed Minecraft game options.' },
    { name: 'optionsshaders.txt', type: 'file', summary: 'Selected shader pack options.' },
  ]
}

export function createVfsLaunchEntries(record: LaunchHistoryRecord) {
  return [
    { name: 'summary.json', type: 'file' as const, summary: 'Launch metadata, outcome, and evidence availability.' },
    ...(record.evidence.launcherOutput === 'available' ? [{ name: 'launcher-output.log', type: 'file' as const, summary: 'Bounded stdout and stderr captured by the launcher.' }] : []),
    ...(record.evidence.gameLog === 'available' ? [{ name: 'game.log', type: 'file' as const, summary: 'Game log associated with this launch.' }] : []),
    ...(record.evidence.debugLog === 'available' ? [{ name: 'debug.log', type: 'file' as const, summary: 'Debug log associated with this launch.' }] : []),
    ...(record.evidence.crashReport === 'available' ? [{ name: 'crash-report.txt', type: 'file' as const, summary: 'Crash report associated with this launch.' }] : []),
  ]
}

function assertRelativeVfsPath(path: string, instancePath?: string) {
  if (/^(?:[a-z]:[\\/]|[\\/])/i.test(path)) {
    const cwd = instancePath ? `. (the selected instance root at ${instancePath})` : '. (the selected instance root)'
    throw new Error(`Absolute paths are not supported by the instance VFS: ${path}. The VFS cwd is ${cwd}. Use a relative virtual path such as ".", "mods", or "config/example.toml".`)
  }
}

export function normalizeVfsListPath(path: string, instancePath?: string) {
  assertRelativeVfsPath(path, instancePath)
  if (path === '' || path === '.' || path === './') return ''
  return path.replace(/^\.\//, '').replace(/\/$/, '')
}

export function normalizeVfsPath(path: string, instancePath?: string) {
  assertRelativeVfsPath(path, instancePath)
  const normalized = path.replace(/^\.\//, '').replace(/\/$/, '')
  if (!normalized || normalized.includes('\\') || normalized.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid virtual path: ${path}`)
  }
  return normalized
}

export async function createVfsRevision(content: string) {
  const bytes = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function assertVfsRevision(content: string, expected: string, path: string) {
  const actual = await createVfsRevision(content)
  if (actual !== expected) throw new Error(`Revision conflict for ${path}; read the file again before writing`)
  return actual
}

export function applyVfsWriteChange(current: string, change: VfsWriteChange) {
  if (typeof change.content === 'string') return change.content
  if (!change.replacements.length) throw new Error('replacements must not be empty')

  let next = current
  for (const [replacementIndex, replacement] of change.replacements.entries()) {
    if (!replacement.match) throw new Error(`replacement ${replacementIndex + 1} match must not be empty`)
    const matchIndex = next.indexOf(replacement.match)
    if (matchIndex < 0) throw new Error(`replacement ${replacementIndex + 1} match was not found`)
    next = replacement.all === true
      ? next.split(replacement.match).join(replacement.replace)
      : next.slice(0, matchIndex) + replacement.replace + next.slice(matchIndex + replacement.match.length)
  }
  return next
}

export function normalizeVfsWriteContent(path: string, content: string) {
  if (path === 'optionsshaders.txt') return stringifyShaderOptions(parseShaderOptions(content))
  return content
}

export async function resolveExistingVfsWrite(
  path: string,
  current: string,
  baseRevision: string,
  change: VfsWriteChange,
) {
  const oldRevision = await createVfsRevision(current)
  if (oldRevision !== baseRevision) {
    if (typeof change.content === 'string' && normalizeVfsWriteContent(path, change.content) === current) {
      return { oldRevision, content: current, alreadyApplied: true }
    }
    await assertVfsRevision(current, baseRevision, path)
  }
  const content = normalizeVfsWriteContent(path, applyVfsWriteChange(current, change))
  return { oldRevision, content, alreadyApplied: false }
}

export function validateVfsText(path: string, content: string, maxBytes = 512 * 1024) {
  if (content.includes('\0')) throw new Error('Binary content is not supported')
  const bytes = new TextEncoder().encode(content).byteLength
  if (bytes > maxBytes) throw new Error(`Content exceeds the ${maxBytes} byte limit`)
  if (path.endsWith('.json')) validateJsonFile(path, content)
  if (path === 'optionsshaders.txt') validateProperties(content, path)
  if (path === 'config/iris.properties' || path === 'config/oculus.properties') validateShaderProperties(content, path)
  if (path === 'server/server.properties') validateServerProperties(content)
  if (path === 'server/eula.txt' && !/^eula=(?:true|false)\n?$/.test(content)) {
    throw new Error('EULA content must be exactly eula=true or eula=false')
  }
  return bytes
}

function validateJsonFile(path: string, content: string) {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!path.startsWith('server/')) return
  if (!Array.isArray(value)) throw new Error(`${path} must contain a JSON array`)

  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${path}[${index}] must be an object`)
    const record = entry as Record<string, unknown>
    if (path === 'server/ops.json') {
      assertUuid(record, path, index)
      assertString(record, 'name', path, index)
      if (!Number.isInteger(record.level) || Number(record.level) < 1 || Number(record.level) > 4) {
        throw new Error(`${path}[${index}].level must be an integer from 1 to 4`)
      }
      if (typeof record.bypassesPlayerLimit !== 'boolean') throw new Error(`${path}[${index}].bypassesPlayerLimit must be boolean`)
    } else if (path === 'server/whitelist.json') {
      assertUuid(record, path, index)
      assertString(record, 'name', path, index)
    } else if (path === 'server/banned-players.json') {
      assertUuid(record, path, index)
      assertString(record, 'name', path, index)
      validateBanEntry(record, path, index)
    } else if (path === 'server/banned-ips.json') {
      assertString(record, 'ip', path, index)
      if (!isIpAddress(record.ip as string)) throw new Error(`${path}[${index}].ip must be an IPv4 or IPv6 address`)
      validateBanEntry(record, path, index)
    }
  }
}

function assertUuid(record: Record<string, unknown>, path: string, index: number) {
  assertString(record, 'uuid', path, index)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.uuid as string)) {
    throw new Error(`${path}[${index}].uuid must be a UUID`)
  }
}

function isIpAddress(value: string) {
  const ipv4 = value.split('.')
  if (ipv4.length === 4 && ipv4.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return true
  return value.includes(':') && /^[0-9a-f:]+$/i.test(value) && value.split(':').length <= 8
}

function assertString(record: Record<string, unknown>, key: string, path: string, index: number) {
  if (typeof record[key] !== 'string' || !record[key]) throw new Error(`${path}[${index}].${key} must be a non-empty string`)
}

function validateBanEntry(record: Record<string, unknown>, path: string, index: number) {
  for (const key of ['created', 'source', 'expires', 'reason']) assertString(record, key, path, index)
}

function validateServerProperties(content: string) {
  const integerRanges: Record<string, [number, number]> = {
    'server-port': [1, 65535],
    'query.port': [1, 65535],
    'rcon.port': [1, 65535],
    'max-players': [1, 2147483647],
  }
  const booleanKeys = new Set([
    'allow-flight', 'allow-nether', 'broadcast-console-to-ops', 'broadcast-rcon-to-ops',
    'enable-command-block', 'enable-jmx-monitoring', 'enable-query', 'enable-rcon',
    'enable-status', 'enforce-secure-profile', 'enforce-whitelist', 'force-gamemode',
    'generate-structures', 'hardcore', 'hide-online-players', 'log-ips', 'online-mode',
    'prevent-proxy-connections', 'pvp', 'require-resource-pack', 'spawn-animals',
    'spawn-monsters', 'spawn-npcs', 'sync-chunk-writes', 'use-native-transport', 'white-list',
  ])
  const properties = validateProperties(content, 'server.properties')
  for (const [key, value] of properties) {
    if (booleanKeys.has(key) && value !== 'true' && value !== 'false') throw new Error(`${key} must be true or false`)
    const range = integerRanges[key]
    if (range) {
      const number = Number(value)
      if (!Number.isInteger(number) || number < range[0] || number > range[1]) {
        throw new Error(`${key} must be an integer from ${range[0]} to ${range[1]}`)
      }
    }
  }
}

function validateShaderProperties(content: string, path: string) {
  const properties = validateProperties(content, path)
  const shaderPack = properties.get('shaderPack')
  const enableShaders = properties.get('enableShaders')
  if (enableShaders !== undefined && enableShaders !== 'true' && enableShaders !== 'false') {
    throw new Error(`${path}: enableShaders must be true or false`)
  }
  if (shaderPack !== undefined || enableShaders !== undefined) {
    const expected = shaderPack ? 'true' : 'false'
    if (enableShaders !== expected) throw new Error(`${path}: enableShaders must be ${expected} for the selected shaderPack`)
  }
}

function validateProperties(content: string, path: string) {
  const result = new Map<string, string>()
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) throw new Error(`${path} line ${index + 1} must contain key=value`)
    const key = line.slice(0, separator).trim()
    if (!key) throw new Error(`${path} line ${index + 1} has an empty key`)
    result.set(key, line.slice(separator + 1).trim())
  }
  return result
}

export function summarizeVfsTextChange(before: string, after: string, limit = 8) {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const details: string[] = []
  const length = Math.max(beforeLines.length, afterLines.length)
  let changedLines = 0
  for (let index = 0; index < length; index++) {
    if (beforeLines[index] === afterLines[index]) continue
    changedLines++
    if (details.length < limit) {
      if (beforeLines[index] !== undefined) details.push(`- ${beforeLines[index].slice(0, 240)}`)
      if (afterLines[index] !== undefined) details.push(`+ ${afterLines[index].slice(0, 240)}`)
    }
  }
  return { changedLines, details, truncated: changedLines * 2 > details.length }
}