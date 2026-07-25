import { createHash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { lstat, mkdir, readdir, rm, stat } from 'fs/promises'
import { basename, join, relative, resolve, sep } from 'path'
import { pipeline } from 'stream/promises'
import { ZipFile } from 'yazl'

export const MAX_WORLD_SEED_ARCHIVE_BYTES = 512 * 1024 * 1024
export const MAX_WORLD_SEED_LOGICAL_BYTES = 2 * 1024 * 1024 * 1024
export const MAX_WORLD_SEED_ENTRIES = 4096
const MAX_WORLD_SEED_PATH_LENGTH = 1024
const zipMtime = new Date('1980-01-01T00:00:00.000Z')

export interface LocalWorldSeedFile {
  path: string
  sha256: string
  sizeBytes: number
}

export interface LocalWorldSeedArchive {
  archivePath: string
  archiveSha256: string
  archiveSizeBytes: number
  worldName: string
  logicalSizeBytes: number
  files: LocalWorldSeedFile[]
}

export interface LocalWorldSeedCandidate {
  name: string
  path: string
  logicalSizeBytes: number
}

interface SourceFile extends LocalWorldSeedFile {
  sourcePath: string
}

export async function listLocalWorldSeedCandidates(instancePath: string): Promise<LocalWorldSeedCandidate[]> {
  const saves = join(instancePath, 'saves')
  const root = await lstat(saves).catch(() => undefined)
  if (!root || !root.isDirectory() || root.isSymbolicLink()) return []
  const candidates: LocalWorldSeedCandidate[] = []
  for (const entry of await readdir(saves, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !validWorldName(entry.name)) continue
    const path = join(saves, entry.name)
    try {
      const files = await scanWorld(path)
      if (files.some(file => file.path === 'world/level.dat')) {
        candidates.push({
          name: entry.name,
          path,
          logicalSizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
        })
      }
    } catch {
      // A malformed or linked save is not eligible for migration.
    }
  }
  return candidates.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Produces only deterministic world data. The source tree is read twice: first
 * to hash and bound it, then as ZIP streams, so no world file is modified.
 */
export async function exportLocalWorldSeed(input: {
  instancePath: string
  saveName: string
  destination: string
  signal?: AbortSignal
}): Promise<LocalWorldSeedArchive> {
  if (input.signal?.aborted) throw new Error('Operation aborted')
  if (!validWorldName(input.saveName) || basename(input.saveName) !== input.saveName) {
    throw new Error('Invalid local world name')
  }
  const savesRoot = resolve(input.instancePath, 'saves')
  const worldRoot = resolve(savesRoot, input.saveName)
  if (!worldRoot.startsWith(`${savesRoot}${sep}`)) throw new Error('Invalid local world path')
  const files = await scanWorld(worldRoot, input.signal)
  if (!files.some(file => file.path === 'world/level.dat')) throw new Error('Local world has no level.dat')
  const logicalSizeBytes = files.reduce((total, file) => total + file.sizeBytes, 0)
  const manifest = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    worldName: input.saveName,
    source: 'local_instance',
    files: files.map(({ path, sha256, sizeBytes }) => ({ path, sha256, sizeBytes })),
  }), 'utf8')
  await mkdir(resolve(input.destination, '..'), { recursive: true })
  await rm(input.destination, { force: true })
  const zip = new ZipFile()
  const output = createWriteStream(input.destination, { flags: 'wx' })
  const abort = () => output.destroy(new Error('Operation aborted'))
  input.signal?.addEventListener('abort', abort, { once: true })
  try {
    zip.addBuffer(manifest, 'world.json', { mtime: zipMtime, mode: 0o100644, compress: true })
    for (const file of files) {
      if (input.signal?.aborted) throw new Error('Operation aborted')
      const source = createReadStream(file.sourcePath)
      zip.addReadStream(source, file.path, { mtime: zipMtime, mode: 0o100644, compress: true })
    }
    const writing = pipeline(zip.outputStream, output)
    zip.end()
    await writing
    const info = await stat(input.destination)
    if (!info.isFile() || info.size < 1 || info.size > MAX_WORLD_SEED_ARCHIVE_BYTES) {
      throw new Error('World seed archive exceeds size limit')
    }
    return {
      archivePath: input.destination,
      archiveSha256: await hashFile(input.destination, input.signal),
      archiveSizeBytes: info.size,
      worldName: input.saveName,
      logicalSizeBytes,
      files: files.map(({ sourcePath: _, ...file }) => file),
    }
  } catch (error) {
    await rm(input.destination, { force: true }).catch(() => undefined)
    throw error
  } finally {
    input.signal?.removeEventListener('abort', abort)
  }
}

async function scanWorld(worldRoot: string, signal?: AbortSignal): Promise<SourceFile[]> {
  const root = await lstat(worldRoot)
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('World root must be a real directory')
  const files: SourceFile[] = []
  let logicalSize = 0
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (signal?.aborted) throw new Error('Operation aborted')
      const sourcePath = join(directory, entry.name)
      const info = await lstat(sourcePath)
      if (info.isSymbolicLink()) throw new Error('World seed cannot include links')
      if (info.isDirectory()) {
        await visit(sourcePath)
        continue
      }
      if (!info.isFile()) throw new Error('World seed cannot include special files')
      const path = `world/${relative(worldRoot, sourcePath).split(sep).join('/')}`
      if (rejectedWorldPath(path)) throw new Error(`World seed rejected ${path}`)
      logicalSize += info.size
      if (files.length >= MAX_WORLD_SEED_ENTRIES || logicalSize > MAX_WORLD_SEED_LOGICAL_BYTES) {
        throw new Error('World seed exceeds logical limits')
      }
      files.push({ sourcePath, path, sizeBytes: info.size, sha256: await hashFile(sourcePath, signal) })
    }
  }
  await visit(worldRoot)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function rejectedWorldPath(path: string) {
  return !path.startsWith('world/') || path.length > MAX_WORLD_SEED_PATH_LENGTH ||
    path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..') ||
    /(?:^|\/)(?:server\.properties|eula\.txt|usercache\.json|ops\.json|whitelist\.json|banned-(?:ips|players)\.json|auth(?:entication)?|credentials?)(?:$|[/.])/i.test(path) ||
    /\.(?:sh|bat|cmd|ps1)$/i.test(path)
}

function validWorldName(value: string) {
  return Boolean(value && value.length <= 255 && !/[\\/:*?"<>|\x00-\x1f]/.test(value))
}

async function hashFile(path: string, signal?: AbortSignal) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    if (signal?.aborted) throw new Error('Operation aborted')
    hash.update(chunk)
  }
  return hash.digest('hex')
}
