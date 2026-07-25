import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from 'fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'path'
import { inflateRawSync } from 'zlib'

export const XMCL_SERVER_BUNDLE_SCHEMA_VERSION = 1
export const XMCL_SERVER_BUNDLE_EXTENSION = '.xmcl-server-bundle'
export const DEFAULT_SERVER_BUNDLE_LIMITS = {
  maxArchiveBytes: 512 * 1024 * 1024,
  maxEntries: 4096,
  maxFileBytes: 64 * 1024 * 1024,
  maxLogicalBytes: 2 * 1024 * 1024 * 1024,
} as const

export type SharedServerLoaderKind = 'forge' | 'fabric' | 'neoforge' | 'quilt'

export interface SharedRuntimeCatalog {
  sha256: string
  requirements: readonly { component: string; major: number }[]
}

export interface LocalServerBundleMetadata {
  instanceName: string
  minecraftVersion: string
  loader: { kind: SharedServerLoaderKind; version: string }
  javaRequirement: { component: string; major: number }
  runtimeCatalog: SharedRuntimeCatalog
}

export interface ServerBundleFile {
  path: string
  sha256: string
  sizeBytes: number
}

export interface XmclServerBundleManifest {
  schemaVersion: 1
  instanceName: string
  minecraftVersion: string
  loader: { kind: SharedServerLoaderKind; version: string }
  javaRequirement: { component: string; major: number }
  runtimeCatalog: { sha256: string }
  files: ServerBundleFile[]
}

export type ServerBundleWarningCode =
  | 'client_only_mod'
  | 'unknown_mod_compatibility'
  | 'local_only_path'
  | 'unsafe_symlink'
  | 'unsupported_compatibility'

export interface ServerBundleWarning {
  code: ServerBundleWarningCode
  path?: string
  message: string
}

export interface ServerBundleExclusion {
  path: string
  reason:
    | 'client_only'
    | 'world_requires_explicit_migration'
    | 'unsafe_symlink'
    | 'unsafe_file_type'
    | 'generated_script'
    | 'private_data'
    | 'not_server_relevant'
}

export interface ServerBundlePreflight {
  compatible: boolean
  warnings: ServerBundleWarning[]
  excluded: ServerBundleExclusion[]
  review: {
    minecraftVersion: string
    loader: { kind: SharedServerLoaderKind; version: string }
    javaRequirement: { component: string; major: number }
    modCount: number
    modBytes: number
    configDataBytes: number
    excludedClientOnlyFiles: number
    worldWillBeMigrated: false
  }
}

export interface ExportLocalServerBundleOptions {
  instancePath: string
  outputPath: string
  metadata: LocalServerBundleMetadata
  /**
   * Resource packs are omitted unless their server relevance has been reviewed
   * by the caller. This does not opt in a local world migration.
   */
  includeServerRelevantResourcePacks?: boolean
  /**
   * Required when the preflight reports client-only or unknown-side mods.
   */
  acknowledgeWarnings?: boolean
  limits?: Partial<typeof DEFAULT_SERVER_BUNDLE_LIMITS>
  onProgress?: (progress: { phase: 'hashing' | 'archiving'; completedBytes: number; totalBytes: number }) => void
}

export interface ExportedLocalServerBundle {
  outputPath: string
  archiveSha256: string
  archiveSizeBytes: number
  manifest: XmclServerBundleManifest
  preflight: ServerBundlePreflight
}

interface SourceFile {
  sourcePath: string
  bundlePath: string
  category:
    | 'mod'
    | 'config'
    | 'kubejs'
    | 'script'
    | 'datapack'
    | 'global-pack'
    | 'openloader'
    | 'paxi'
    | 'data'
    | 'resourcepack'
}

interface DescribedFile extends SourceFile, ServerBundleFile {
  crc32: number
}

interface MemoryFile extends ServerBundleFile {
  bytes: Buffer
  crc32: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const rootFiles = new Set([
  'server.properties',
  'pack.toml',
  'pack.mcmeta',
  'server-icon.png',
])
const allowedDirectories = new Set([
  'mods',
  'config',
  'defaultconfigs',
  'kubejs',
  'scripts',
  'datapacks',
  'global_packs',
  'openloader',
  'paxi',
])
const clientOnlyDirectories = new Set([
  'logs',
  'crash-reports',
  'screenshots',
  'assets',
  'libraries',
  'versions',
  'shaderpacks',
  'saves',
  'resourcepacks',
  '.minecraft',
])
const generatedScript = /(?:^|\/)(?:server\.(?:sh|bat|cmd)|start\.(?:sh|bat|cmd))$/i
const privateName = /(?:^|\/)(?:auth|accounts?|launcher[_ -]?profiles|usercache|credentials?)(?:\/|$)/i

export async function preflightLocalServerBundle(
  options: Omit<ExportLocalServerBundleOptions, 'outputPath' | 'acknowledgeWarnings' | 'onProgress'>,
): Promise<ServerBundlePreflight> {
  const limits = { ...DEFAULT_SERVER_BUNDLE_LIMITS, ...options.limits }
  validateMetadata(options.metadata)
  const excluded: ServerBundleExclusion[] = []
  const sources = await collectInstanceSources(
    options.instancePath,
    Boolean(options.includeServerRelevantResourcePacks),
    excluded,
  )
  const allSources = sources
  ensureUniquePaths(allSources)
  if (allSources.length > limits.maxEntries - 4) {
    throw new ServerBundleError('too_many_entries')
  }

  let logicalBytes = 0
  let modCount = 0
  let modBytes = 0
  let configDataBytes = 0
  const warnings: ServerBundleWarning[] = []
  for (const source of allSources) {
    const stat = await lstat(source.sourcePath)
    if (!stat.isFile()) continue
    if (stat.size > limits.maxFileBytes) throw new ServerBundleError('file_too_large', source.bundlePath)
    logicalBytes += stat.size
    if (logicalBytes > limits.maxLogicalBytes) throw new ServerBundleError('logical_size_exceeded')
    if (source.category === 'mod') {
      modCount += 1
      modBytes += stat.size
      const compatibility = await inspectModCompatibility(source.sourcePath)
      if (compatibility === 'client') {
        warnings.push({
          code: 'client_only_mod',
          path: source.bundlePath,
          message: 'The mod declares client-only compatibility and will still be included for review.',
        })
      } else if (compatibility === 'unknown') {
        warnings.push({
          code: 'unknown_mod_compatibility',
          path: source.bundlePath,
          message: 'The mod has no reliable server-compatibility declaration.',
        })
      }
    } else if (source.category !== 'resourcepack') {
      configDataBytes += stat.size
    }
  }
  if (!catalogContains(options.metadata.runtimeCatalog, options.metadata.javaRequirement)) {
    warnings.push({
      code: 'unsupported_compatibility',
      message: 'The resolved Java component and major are not present in the reviewed runtime catalog.',
    })
  }
  for (const item of excluded) {
    if (item.reason === 'unsafe_symlink') {
      warnings.push({
        code: 'unsafe_symlink',
        path: item.path,
        message: 'A symbolic link or junction was excluded from the server bundle.',
      })
    } else if (item.reason === 'not_server_relevant') {
      warnings.push({
        code: 'local_only_path',
        path: item.path,
        message: 'A local-only file was excluded from the server bundle.',
      })
    }
  }
  return {
    compatible: !warnings.some((warning) => warning.code === 'unsupported_compatibility'),
    warnings,
    excluded,
    review: {
      minecraftVersion: options.metadata.minecraftVersion,
      loader: options.metadata.loader,
      javaRequirement: options.metadata.javaRequirement,
      modCount,
      modBytes,
      configDataBytes,
      excludedClientOnlyFiles: excluded.filter((item) => item.reason === 'client_only').length,
      worldWillBeMigrated: false,
    },
  }
}

/**
 * Exports a deterministic, stored ZIP archive. It deliberately does not export
 * a Java executable, Docker setting, JVM argument, or legacy server launcher.
 */
export async function exportLocalServerBundle(
  options: ExportLocalServerBundleOptions,
): Promise<ExportedLocalServerBundle> {
  const limits = { ...DEFAULT_SERVER_BUNDLE_LIMITS, ...options.limits }
  const preflight = await preflightLocalServerBundle(options)
  if (!preflight.compatible) throw new ServerBundleError('unsupported_compatibility')
  if (preflight.warnings.length > 0 && !options.acknowledgeWarnings) {
    throw new ServerBundleError('warnings_not_acknowledged')
  }

  const sources = await collectInstanceSources(
    options.instancePath,
    Boolean(options.includeServerRelevantResourcePacks),
    [],
  )
  const payloadSources = sources
  ensureUniquePaths(payloadSources)
  payloadSources.sort(sortPath)
  const totalBytes = (await Promise.all(payloadSources.map(async (source) => (await lstat(source.sourcePath)).size)))
    .reduce((total, size) => total + size, 0)
  let hashedBytes = 0
  const files: DescribedFile[] = []
  for (const source of payloadSources) {
    const described = await describeSourceFile(source, limits, (bytes) => {
      hashedBytes += bytes
      options.onProgress?.({ phase: 'hashing', completedBytes: hashedBytes, totalBytes })
    })
    files.push(described)
  }

  const loaderFile = memoryFile('resolved/loader.json', canonicalJson({
    schemaVersion: 1,
    minecraftVersion: options.metadata.minecraftVersion,
    loader: options.metadata.loader,
    javaRequirement: options.metadata.javaRequirement,
    runtimeCatalog: { sha256: options.metadata.runtimeCatalog.sha256 },
  }))
  const versionFile = memoryFile('resolved/version.json', canonicalJson({
    schemaVersion: 1,
    minecraftVersion: options.metadata.minecraftVersion,
    javaVersion: {
      component: options.metadata.javaRequirement.component,
      majorVersion: options.metadata.javaRequirement.major,
    },
  }))
  const artifactsFile = memoryFile('resolved/artifacts.json', canonicalJson({
    schemaVersion: 1,
    artifacts: files.map((file) => ({
      intent: file.category,
      path: file.path,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
    })),
  }))
  const modsFile = memoryFile('resolved/mods.json', canonicalJson(
    files.filter((file) => file.category === 'mod').map((file) => ({
      path: file.path,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
    })),
  ))
  const payloadFiles: Array<DescribedFile | MemoryFile> = [
    ...files,
    loaderFile,
    versionFile,
    artifactsFile,
    modsFile,
  ].sort(sortPath)
  const manifest: XmclServerBundleManifest = {
    schemaVersion: 1,
    instanceName: options.metadata.instanceName,
    minecraftVersion: options.metadata.minecraftVersion,
    loader: { ...options.metadata.loader },
    javaRequirement: { ...options.metadata.javaRequirement },
    runtimeCatalog: { sha256: options.metadata.runtimeCatalog.sha256 },
    files: payloadFiles.map(({ path, sha256, sizeBytes }) => ({ path, sha256, sizeBytes })),
  }
  const manifestFile = memoryFile('bundle.json', canonicalJson(manifest))
  const archiveEntries: Array<DescribedFile | MemoryFile> = [
    manifestFile,
    ...payloadFiles,
  ]
  const outputPath = options.outputPath.endsWith(XMCL_SERVER_BUNDLE_EXTENSION)
    ? options.outputPath
    : `${options.outputPath}${XMCL_SERVER_BUNDLE_EXTENSION}`
  const temporaryPath = `${outputPath}.partial`
  await mkdir(dirname(outputPath), { recursive: true })
  await unlink(temporaryPath).catch(() => undefined)
  try {
    const writer = await DeterministicZipWriter.open(temporaryPath, limits.maxArchiveBytes)
    let archivedBytes = 0
    for (const entry of archiveEntries) {
      await writer.add(entry, (bytes) => {
        archivedBytes += bytes
        options.onProgress?.({ phase: 'archiving', completedBytes: archivedBytes, totalBytes })
      })
    }
    await writer.end()
    const archive = await describePath(
      temporaryPath,
      limits,
      () => {},
      limits.maxArchiveBytes,
    )
    await rename(temporaryPath, outputPath)
    return {
      outputPath,
      archiveSha256: archive.sha256,
      archiveSizeBytes: archive.sizeBytes,
      manifest,
      preflight,
    }
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

export function deriveLocalServerBundleMetadata(input: {
  instanceName: string
  minecraftVersion: string
  javaVersion?: { component?: string; majorVersion?: number }
  libraries?: Array<{
    groupId?: string
    artifactId?: string
    version?: string
    name?: string
  }>
  runtimeCatalog: SharedRuntimeCatalog
}): LocalServerBundleMetadata {
  const java = input.javaVersion
  const major = java?.majorVersion
  if (!java?.component || !Number.isSafeInteger(major)) {
    throw new ServerBundleError('missing_resolved_java')
  }
  const loader = deriveLoader(input.libraries ?? [], input.minecraftVersion)
  const metadata: LocalServerBundleMetadata = {
    instanceName: input.instanceName,
    minecraftVersion: input.minecraftVersion,
    loader,
    javaRequirement: { component: java.component, major: major as number },
    runtimeCatalog: input.runtimeCatalog,
  }
  validateMetadata(metadata)
  return metadata
}

export class ServerBundleError extends Error {
  constructor(
    readonly code:
      | 'too_many_entries'
      | 'file_too_large'
      | 'logical_size_exceeded'
      | 'archive_too_large'
      | 'unsupported_compatibility'
      | 'warnings_not_acknowledged'
      | 'missing_resolved_java'
      | 'missing_resolved_loader'
      | 'unsafe_path',
    readonly path?: string,
  ) {
    super(path ? `${code}: ${path}` : code)
    this.name = 'ServerBundleError'
  }
}

async function collectInstanceSources(
  instancePath: string,
  includeResourcePacks: boolean,
  excluded: ServerBundleExclusion[],
): Promise<SourceFile[]> {
  const root = resolve(instancePath)
  const sources: SourceFile[] = []
  const candidates = await readdir(root, { withFileTypes: true }).catch(() => [])
  for (const entry of candidates) {
    const lower = entry.name.toLocaleLowerCase('en-US')
    const absolute = join(root, entry.name)
    const stat = await lstat(absolute)
    if (stat.isSymbolicLink()) {
      excluded.push({ path: entry.name, reason: 'unsafe_symlink' })
      continue
    }
    if (lower === 'world' || lower === 'world_nether' || lower === 'world_the_end') {
      excluded.push({ path: entry.name, reason: 'world_requires_explicit_migration' })
      continue
    }
    if (clientOnlyDirectories.has(lower)) {
      excluded.push({
        path: entry.name,
        reason: lower === 'saves' || lower.startsWith('world')
          ? 'world_requires_explicit_migration'
          : 'client_only',
      })
      if (lower === 'resourcepacks' && includeResourcePacks) {
        await collectDirectory(root, absolute, `instance/${lower}`, 'resourcepack', sources, excluded)
      }
      continue
    }
    if (stat.isDirectory() && allowedDirectories.has(lower)) {
      await collectDirectory(root, absolute, `instance/${lower}`, categoryFor(lower), sources, excluded)
      continue
    }
    if (stat.isFile() && rootFiles.has(lower)) {
      if (generatedScript.test(entry.name) || privateName.test(entry.name)) {
        excluded.push({ path: entry.name, reason: generatedScript.test(entry.name) ? 'generated_script' : 'private_data' })
      } else {
        sources.push({ sourcePath: absolute, bundlePath: `instance/${lower}`, category: 'data' })
      }
      continue
    }
    excluded.push({ path: entry.name, reason: 'not_server_relevant' })
  }
  return sources.sort(sortPath)
}

async function collectDirectory(
  instanceRoot: string,
  directory: string,
  bundleDirectory: string,
  category: SourceFile['category'],
  sources: SourceFile[],
  excluded: ServerBundleExclusion[],
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = join(directory, entry.name)
    const bundlePath = `${bundleDirectory}/${entry.name}`
    const relativePath = relative(instanceRoot, absolute).split(sep).join('/')
    if (!safeRelativePath(relativePath) || generatedScript.test(relativePath)) {
      excluded.push({ path: relativePath, reason: generatedScript.test(relativePath) ? 'generated_script' : 'not_server_relevant' })
      continue
    }
    if (privateName.test(relativePath)) {
      excluded.push({ path: relativePath, reason: 'private_data' })
      continue
    }
    const stat = await lstat(absolute)
    if (stat.isSymbolicLink()) {
      excluded.push({ path: relativePath, reason: 'unsafe_symlink' })
      continue
    }
    if (stat.isDirectory()) {
      await collectDirectory(instanceRoot, absolute, bundlePath, category, sources, excluded)
      continue
    }
    if (!stat.isFile()) {
      excluded.push({ path: relativePath, reason: 'unsafe_file_type' })
      continue
    }
    sources.push({ sourcePath: absolute, bundlePath, category })
  }
}

function categoryFor(directory: string): SourceFile['category'] {
  if (directory === 'mods') return 'mod'
  if (directory === 'config' || directory === 'defaultconfigs') return 'config'
  if (directory === 'kubejs') return 'kubejs'
  if (directory === 'scripts') return 'script'
  if (directory === 'datapacks') return 'datapack'
  if (directory === 'global_packs') return 'global-pack'
  if (directory === 'openloader') return 'openloader'
  if (directory === 'paxi') return 'paxi'
  return 'data'
}

function validateMetadata(metadata: LocalServerBundleMetadata) {
  if (
    !metadata.instanceName.trim() ||
    !/^1\.\d+\.\d+$/.test(metadata.minecraftVersion) ||
    !['forge', 'fabric', 'neoforge', 'quilt'].includes(metadata.loader.kind) ||
    !validLoaderVersion(metadata.loader.version) ||
    !metadata.javaRequirement.component ||
    !Number.isSafeInteger(metadata.javaRequirement.major) ||
    !validSha256(metadata.runtimeCatalog.sha256)
  ) {
    throw new ServerBundleError('unsupported_compatibility')
  }
}

function catalogContains(catalog: SharedRuntimeCatalog, java: { component: string; major: number }) {
  return catalog.requirements.some((entry) => entry.component === java.component && entry.major === java.major)
}

function deriveLoader(
  libraries: readonly {
    groupId?: string
    artifactId?: string
    version?: string
    name?: string
  }[],
  minecraftVersion: string,
): { kind: SharedServerLoaderKind; version: string } {
  for (const library of libraries) {
    const name = library.name ?? `${library.groupId ?? ''}:${library.artifactId ?? ''}:${library.version ?? ''}`
    const normalized = name.toLocaleLowerCase('en-US')
    const version = library.version ?? name.split(':').at(-1) ?? ''
    if (normalized.includes('net.neoforged:neoforge')) return { kind: 'neoforge', version }
    if (normalized.includes('net.fabricmc:fabric-loader')) return { kind: 'fabric', version }
    if (normalized.includes('org.quiltmc:quilt-loader')) return { kind: 'quilt', version }
    if (normalized.includes('net.minecraftforge:forge')) {
      const prefix = `${minecraftVersion}-`
      return { kind: 'forge', version: version.startsWith(prefix) ? version.slice(prefix.length) : version }
    }
  }
  throw new ServerBundleError('missing_resolved_loader')
}

async function describeSourceFile(
  source: SourceFile,
  limits: typeof DEFAULT_SERVER_BUNDLE_LIMITS,
  onChunk: (size: number) => void,
): Promise<DescribedFile> {
  const described = await describePath(source.sourcePath, limits, onChunk)
  return { ...source, ...described, path: source.bundlePath }
}

async function describePath(
  path: string,
  limits: typeof DEFAULT_SERVER_BUNDLE_LIMITS,
  onChunk: (size: number) => void = () => {},
  maxSizeBytes = limits.maxFileBytes,
): Promise<{ sha256: string; sizeBytes: number; crc32: number }> {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new ServerBundleError('unsafe_path', path)
  if (stat.size > maxSizeBytes) throw new ServerBundleError('file_too_large', path)
  const hash = createHash('sha256')
  let crc = 0xffffffff
  let sizeBytes = 0
  for await (const chunk of createReadStream(path)) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    hash.update(bytes)
    crc = crc32(bytes, crc)
    sizeBytes += bytes.length
    onChunk(bytes.length)
  }
  return { sha256: hash.digest('hex'), sizeBytes, crc32: (crc ^ 0xffffffff) >>> 0 }
}

function memoryFile(path: string, content: string): MemoryFile {
  const bytes = Buffer.from(encoder.encode(content))
  return {
    path,
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.byteLength,
    crc32: (crc32(bytes, 0xffffffff) ^ 0xffffffff) >>> 0,
  }
}

class DeterministicZipWriter {
  private offset = 0
  private readonly entries: Array<{ path: string; crc32: number; sizeBytes: number; offset: number }> = []

  private constructor(
    private readonly file: Awaited<ReturnType<typeof open>>,
    private readonly maxArchiveBytes: number,
  ) {}

  static async open(path: string, maxArchiveBytes: number) {
    return new DeterministicZipWriter(await open(path, 'w'), maxArchiveBytes)
  }

  async add(entry: DescribedFile | MemoryFile, onChunk: (size: number) => void) {
    if (!safeBundlePath(entry.path)) throw new ServerBundleError('unsafe_path', entry.path)
    const name = Buffer.from(entry.path, 'utf-8')
    const start = this.offset
    await this.write(zipLocalHeader(name, entry.crc32, entry.sizeBytes))
    if ('bytes' in entry) {
      await this.write(entry.bytes)
      onChunk(entry.bytes.length)
    } else {
      const hash = createHash('sha256')
      let sizeBytes = 0
      let crc = 0xffffffff
      for await (const chunk of createReadStream(entry.sourcePath)) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        hash.update(bytes)
        sizeBytes += bytes.byteLength
        crc = crc32(bytes, crc)
        await this.write(bytes)
        onChunk(bytes.length)
      }
      if (
        sizeBytes !== entry.sizeBytes ||
        hash.digest('hex') !== entry.sha256 ||
        ((crc ^ 0xffffffff) >>> 0) !== entry.crc32
      ) {
        throw new ServerBundleError('unsafe_path', entry.sourcePath)
      }
    }
    this.entries.push({ path: entry.path, crc32: entry.crc32, sizeBytes: entry.sizeBytes, offset: start })
  }

  async end() {
    const centralOffset = this.offset
    for (const entry of this.entries) {
      await this.write(zipCentralDirectory(Buffer.from(entry.path, 'utf-8'), entry.crc32, entry.sizeBytes, entry.offset))
    }
    const centralSize = this.offset - centralOffset
    if (this.entries.length > 0xffff || centralSize > 0xffffffff || centralOffset > 0xffffffff) {
      throw new ServerBundleError('archive_too_large')
    }
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(0, 4)
    end.writeUInt16LE(0, 6)
    end.writeUInt16LE(this.entries.length, 8)
    end.writeUInt16LE(this.entries.length, 10)
    end.writeUInt32LE(centralSize, 12)
    end.writeUInt32LE(centralOffset, 16)
    end.writeUInt16LE(0, 20)
    await this.write(end)
    await this.file.close()
  }

  private async write(bytes: Uint8Array) {
    if (this.offset + bytes.byteLength > this.maxArchiveBytes) throw new ServerBundleError('archive_too_large')
    let written = 0
    while (written < bytes.byteLength) {
      const result = await this.file.write(bytes, written, bytes.byteLength - written, this.offset + written)
      written += result.bytesWritten
    }
    this.offset += bytes.byteLength
  }
}

function zipLocalHeader(name: Buffer, crc: number, size: number) {
  const header = Buffer.alloc(30 + name.length)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0x800, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(0x21, 12)
  header.writeUInt32LE(crc, 14)
  header.writeUInt32LE(size, 18)
  header.writeUInt32LE(size, 22)
  header.writeUInt16LE(name.length, 26)
  header.writeUInt16LE(0, 28)
  name.copy(header, 30)
  return header
}

function zipCentralDirectory(name: Buffer, crc: number, size: number, offset: number) {
  const header = Buffer.alloc(46 + name.length)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(0x0314, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0x800, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(0, 12)
  header.writeUInt16LE(0x21, 14)
  header.writeUInt32LE(crc, 16)
  header.writeUInt32LE(size, 20)
  header.writeUInt32LE(size, 24)
  header.writeUInt16LE(name.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(offset, 42)
  name.copy(header, 46)
  return header
}

function safeRelativePath(path: string) {
  return path.length > 0 &&
    !path.includes('\0') &&
    !path.startsWith('/') &&
    !path.startsWith('\\') &&
    !/^[a-zA-Z]:/.test(path) &&
    path.split(/[\\/]/).every((part) => part && part !== '.' && part !== '..')
}

function safeBundlePath(path: string) {
  return safeRelativePath(path) && !path.includes('\\') && path === path.normalize('NFC')
}

function validSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value)
}

function validLoaderVersion(value: string) {
  return value.length > 0 && value.length <= 128 && /^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(value)
}

function sortPath(left: { path?: string; bundlePath?: string }, right: { path?: string; bundlePath?: string }) {
  const leftPath = left.path ?? left.bundlePath ?? ''
  const rightPath = right.path ?? right.bundlePath ?? ''
  return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0
}

function ensureUniquePaths(sources: readonly SourceFile[]) {
  const seen = new Set<string>()
  for (const source of sources) {
    const key = source.bundlePath.normalize('NFKC').toLocaleLowerCase('en-US')
    if (seen.has(key)) throw new ServerBundleError('unsafe_path', source.bundlePath)
    seen.add(key)
  }
}

let crcTable: Uint32Array | undefined
function crc32(bytes: Uint8Array, initial: number) {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, value) => {
    let crc = value
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1)
    return crc >>> 0
  })
  let crc = initial
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return crc >>> 0
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicalize(child)]))
  }
  return value
}

async function inspectModCompatibility(path: string): Promise<'client' | 'unknown' | 'server'> {
  if (extname(path).toLocaleLowerCase('en-US') !== '.jar') return 'unknown'
  const bytes = await readJarMetadata(path).catch(() => undefined)
  if (!bytes) return 'unknown'
  try {
    const value = JSON.parse(decoder.decode(bytes)) as Record<string, unknown>
    const environment = typeof value.environment === 'string'
      ? value.environment
      : (value.quilt_loader as Record<string, unknown> | undefined)?.metadata &&
        typeof ((value.quilt_loader as Record<string, unknown>).metadata as Record<string, unknown>).environment === 'string'
        ? ((value.quilt_loader as Record<string, unknown>).metadata as Record<string, unknown>).environment
        : undefined
    if (environment === 'client') return 'client'
    if (environment === 'server' || environment === '*') return 'server'
  } catch {
    return 'unknown'
  }
  return 'unknown'
}

async function readJarMetadata(path: string): Promise<Uint8Array | undefined> {
  const bytes = await readFile(path)
  if (bytes.length < 22) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const start = Math.max(0, bytes.length - 65_557)
  let end = -1
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset
      break
    }
  }
  if (end < 0) return undefined
  const count = view.getUint16(end + 10, true)
  let cursor = view.getUint32(end + 16, true)
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) return undefined
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))
    if (name === 'fabric.mod.json' || name === 'quilt.mod.json') {
      if (uncompressedSize > 1024 * 1024 || localOffset + 30 > bytes.length) return undefined
      const localNameLength = view.getUint16(localOffset + 26, true)
      const localExtraLength = view.getUint16(localOffset + 28, true)
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength
      const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize)
      return method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : undefined
    }
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return undefined
}
