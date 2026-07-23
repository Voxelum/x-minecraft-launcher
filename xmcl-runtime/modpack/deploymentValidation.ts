import type { Entry } from '@xmcl/yauzl'

export type ModpackDeploymentSourceFormat = 'mrpack' | 'curseforge_zip'

export interface ModpackDeploymentSource {
  path: string
  filename: string
  provider?: 'modrinth' | 'curseforge'
  projectId?: string | number
  fileId?: string | number
}

export interface ModpackDeploymentValidationReport {
  importId: string
  sourceFormat: ModpackDeploymentSourceFormat
  status: 'valid' | 'invalid'
  configFiles: string[]
  dataFiles: string[]
  mods: Array<{
    provider: 'modrinth' | 'curseforge'
    projectId: string
    fileId: string
    filename: string
  }>
  rejectedFiles: Array<{ path: string; reason: string }>
}

export interface ModpackDeploymentArchiveLimits {
  maxEntries: number
  maxUncompressedBytes: number
  maxCompressionRatio: number
}

export interface ValidateModpackDeploymentOptions {
  importId: string
  sourceFormat: ModpackDeploymentSourceFormat
  entries: readonly Entry[]
  sources: readonly ModpackDeploymentSource[]
  resolvePayloadPath(entry: Entry): string | undefined
  limits?: Partial<ModpackDeploymentArchiveLimits>
}

const defaultLimits: ModpackDeploymentArchiveLimits = {
  maxEntries: 10_000,
  maxUncompressedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 100,
}

const executableExtensions = new Set([
  '.bat',
  '.class',
  '.cmd',
  '.com',
  '.dll',
  '.dylib',
  '.exe',
  '.jar',
  '.js',
  '.msi',
  '.ps1',
  '.py',
  '.rb',
  '.sh',
  '.so',
  '.vbs',
  '.wsf',
])

function normalizeArchivePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function getUnsafePathReason(path: string): string | undefined {
  if (!path) return 'empty path'
  if (path.startsWith('/') || /^[a-zA-Z]:\//.test(path)) return 'absolute path'
  if (path.split('/').some(part => part === '..')) return 'path traversal'
  return undefined
}

function isSymbolicLink(entry: Entry): boolean {
  const platform = entry.versionMadeBy >>> 8
  const mode = entry.externalFileAttributes >>> 16
  return platform === 3 && (mode & 0o170000) === 0o120000
}

function isExecutable(path: string): boolean {
  const dot = path.lastIndexOf('.')
  return dot !== -1 && executableExtensions.has(path.slice(dot).toLowerCase())
}

function isValidSourceId(value: string | number | undefined, provider: 'modrinth' | 'curseforge'): boolean {
  if (provider === 'curseforge') {
    return typeof value === 'number'
      ? Number.isSafeInteger(value) && value > 0
      : typeof value === 'string' && /^[1-9]\d*$/.test(value)
  }
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value)
}

export function validateModpackDeploymentArchive(
  options: ValidateModpackDeploymentOptions,
): ModpackDeploymentValidationReport {
  const limits = { ...defaultLimits, ...options.limits }
  const configFiles: string[] = []
  const dataFiles: string[] = []
  const mods: ModpackDeploymentValidationReport['mods'] = []
  const rejectedFiles: ModpackDeploymentValidationReport['rejectedFiles'] = []
  const seenPaths = new Set<string>()
  const manifestPath = options.sourceFormat === 'mrpack' ? 'modrinth.index.json' : 'manifest.json'
  let manifestCount = 0
  let totalUncompressedBytes = 0

  if (options.entries.length > limits.maxEntries) {
    rejectedFiles.push({
      path: '<archive>',
      reason: `entry count ${options.entries.length} exceeds limit ${limits.maxEntries}`,
    })
  }

  for (const entry of options.entries) {
    const path = normalizeArchivePath(entry.fileName)
    const pathKey = path.toLowerCase()
    const unsafePathReason = getUnsafePathReason(path)

    if (unsafePathReason) {
      rejectedFiles.push({ path, reason: unsafePathReason })
      continue
    }
    if (seenPaths.has(pathKey)) {
      rejectedFiles.push({ path, reason: 'duplicate path' })
      continue
    }
    seenPaths.add(pathKey)

    if (isSymbolicLink(entry)) {
      rejectedFiles.push({ path, reason: 'symbolic link' })
      continue
    }

    totalUncompressedBytes += entry.uncompressedSize
    const compressionRatio = entry.uncompressedSize === 0
      ? 0
      : entry.compressedSize === 0
        ? Number.POSITIVE_INFINITY
        : entry.uncompressedSize / entry.compressedSize
    if (compressionRatio > limits.maxCompressionRatio) {
      rejectedFiles.push({ path, reason: `compression ratio exceeds limit ${limits.maxCompressionRatio}` })
      continue
    }

    if (path === manifestPath) {
      manifestCount += 1
      continue
    }
    if (path.endsWith('/')) continue

    const payloadPath = options.resolvePayloadPath(entry)
    if (!payloadPath) {
      rejectedFiles.push({ path, reason: 'file is outside manifest, config, and data allowlist' })
      continue
    }

    const normalizedPayloadPath = normalizeArchivePath(payloadPath)
    const unsafePayloadReason = getUnsafePathReason(normalizedPayloadPath)
    if (unsafePayloadReason) {
      rejectedFiles.push({ path, reason: unsafePayloadReason })
    } else if (isExecutable(normalizedPayloadPath)) {
      rejectedFiles.push({ path, reason: 'embedded executable or script' })
    } else if (normalizedPayloadPath.startsWith('config/')) {
      configFiles.push(normalizedPayloadPath)
    } else if (normalizedPayloadPath.startsWith('data/')) {
      dataFiles.push(normalizedPayloadPath)
    } else {
      rejectedFiles.push({ path, reason: 'payload is outside config and data allowlist' })
    }
  }

  if (manifestCount !== 1) {
    rejectedFiles.push({ path: manifestPath, reason: `expected exactly one manifest, found ${manifestCount}` })
  }
  if (totalUncompressedBytes > limits.maxUncompressedBytes) {
    rejectedFiles.push({
      path: '<archive>',
      reason: `uncompressed size ${totalUncompressedBytes} exceeds limit ${limits.maxUncompressedBytes}`,
    })
  }

  for (const source of options.sources) {
    const provider = source.provider
    if (
      !provider
      || !isValidSourceId(source.projectId, provider)
      || !isValidSourceId(source.fileId, provider)
      || !source.filename
      || /[\\/]/.test(source.filename)
      || !source.filename.toLowerCase().endsWith('.jar')
    ) {
      rejectedFiles.push({ path: source.path, reason: 'unresolved or invalid provider source' })
      continue
    }
    mods.push({
      provider,
      projectId: String(source.projectId),
      fileId: String(source.fileId),
      filename: source.filename,
    })
  }

  return {
    importId: options.importId,
    sourceFormat: options.sourceFormat,
    status: rejectedFiles.length === 0 ? 'valid' : 'invalid',
    configFiles: configFiles.sort(),
    dataFiles: dataFiles.sort(),
    mods: mods.sort((a, b) => a.filename.localeCompare(b.filename)),
    rejectedFiles,
  }
}