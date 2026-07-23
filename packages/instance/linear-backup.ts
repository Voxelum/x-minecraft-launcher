import { createHash } from 'crypto'
import { gunzipSync, gzipSync } from 'zlib'

export const LINEAR_BACKUP_FORMAT_VERSION = 1
const LINEAR_BACKUP_MAGIC = 'xmcl-linear'
export type BackupFormat = 'linear' | 'layered_linear'

export interface LinearBackupObject {
  format: 'linear'
  formatVersion: typeof LINEAR_BACKUP_FORMAT_VERSION
  sizeBytes: number
  sha256: string
}

export interface LinearBackupObjectInput {
  formatVersion?: number
  sizeBytes: number
  sha256: string
}

/**
 * A file from a player-world snapshot. Entries are deliberately relative: a
 * Linear object is an opaque compressed object, not an Anvil directory upload.
 */
export interface LinearBackupEntry {
  path: string
  content: Uint8Array
}

export interface PreparedLinearBackup {
  object: LinearBackupObject
  content: Uint8Array
}

interface LinearBackupEnvelope {
  magic: typeof LINEAR_BACKUP_MAGIC
  formatVersion: typeof LINEAR_BACKUP_FORMAT_VERSION
  files: Array<{ path: string; content: string }>
}

export function validateLinearBackupObjectInput(input: LinearBackupObjectInput): void {
  const formatVersion = input.formatVersion ?? LINEAR_BACKUP_FORMAT_VERSION
  if (formatVersion !== LINEAR_BACKUP_FORMAT_VERSION) {
    throw new RangeError(`Unsupported Linear backup format version: ${formatVersion}`)
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new RangeError('Linear backup sizeBytes must be a positive safe integer')
  }
  if (!/^[a-f\d]{64}$/i.test(input.sha256)) {
    throw new TypeError('Linear backup sha256 must be a 64-character hexadecimal digest')
  }
}

function validateEntryPath(path: string) {
  if (!path || path.startsWith('/') || path.startsWith('\\') || path.includes('\\') || path.includes(':') ||
    path.split('/').some(part => part.length === 0 || part === '.' || part === '..')) {
    throw new TypeError(`Linear backup entry path is unsafe: ${path}`)
  }
}

/**
 * Serializes a world snapshot into the M6-local Linear v1 proposal. The
 * resulting gzip payload is the sole uploadable object; callers never upload
 * the source world directory, a region file, or a ZIP archive.
 */
export function createLinearBackup(entries: readonly LinearBackupEntry[]): PreparedLinearBackup {
  const paths = new Set<string>()
  const files = entries.map((entry) => {
    validateEntryPath(entry.path)
    if (paths.has(entry.path)) {
      throw new TypeError(`Linear backup contains duplicate entry: ${entry.path}`)
    }
    paths.add(entry.path)
    return {
      path: entry.path,
      content: Buffer.from(entry.content).toString('base64'),
    }
  }).sort((left, right) => left.path.localeCompare(right.path))
  const envelope: LinearBackupEnvelope = {
    magic: LINEAR_BACKUP_MAGIC,
    formatVersion: LINEAR_BACKUP_FORMAT_VERSION,
    files,
  }
  const content = gzipSync(Buffer.from(JSON.stringify(envelope)))
  return {
    object: createLinearBackupObject({
      sizeBytes: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
    }),
    content,
  }
}

/**
 * Decodes a Linear object only after it has been downloaded. This allows the
 * restore implementation to reconstruct a Minecraft world without treating
 * the backup object as a ZIP or exposing original region files to storage.
 */
export function readLinearBackup(content: Uint8Array): LinearBackupEntry[] {
  let envelope: LinearBackupEnvelope
  try {
    envelope = JSON.parse(gunzipSync(content).toString('utf8')) as LinearBackupEnvelope
  } catch {
    throw new TypeError('Invalid Linear backup payload')
  }
  if (envelope.magic !== LINEAR_BACKUP_MAGIC || envelope.formatVersion !== LINEAR_BACKUP_FORMAT_VERSION ||
    !Array.isArray(envelope.files)) {
    throw new TypeError('Unsupported Linear backup payload')
  }
  const paths = new Set<string>()
  return envelope.files.map((file) => {
    validateEntryPath(file.path)
    if (paths.has(file.path)) {
      throw new TypeError(`Linear backup contains duplicate entry: ${file.path}`)
    }
    paths.add(file.path)
    if (typeof file.content !== 'string') {
      throw new TypeError(`Linear backup entry has invalid content: ${file.path}`)
    }
    return { path: file.path, content: new Uint8Array(Buffer.from(file.content, 'base64')) }
  })
}

export function createLinearBackupObject(input: LinearBackupObjectInput): LinearBackupObject {
  validateLinearBackupObjectInput(input)
  return {
    format: 'linear',
    formatVersion: LINEAR_BACKUP_FORMAT_VERSION,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256.toLowerCase(),
  }
}