import type { BackupManifest } from '@xmcl/runtime-api'
import { openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { Transform, Writable } from 'stream'
import { pipeline } from 'stream/promises'
import { validateInstanceFolder } from './safePath'

type Entry = Awaited<ReturnType<typeof readAllEntries>>[number]
// Explicit resource limits apply to all entries, including unselected categories.
export const BACKUP_LIMITS = { entries: 100000, depth: 32, json: 16 * 1024 * 1024, entry: 64 * 1024 ** 3, total: 256 * 1024 ** 3, ratio: 1000 }
export function validateBackupEntries(entries: Entry[]) {
  if (entries.length > BACKUP_LIMITS.entries) throw new Error('Backup entry count limit exceeded')
  const names = new Map<string, boolean>()
  const spellings = new Map<string, string>()
  let total = 0
  for (const e of entries) {
    const path = e.fileName
    const parts = path.replace(/\/$/, '').split('/')
    if (!path || path.includes('\\') || parts.length > BACKUP_LIMITS.depth || parts.some(p => !p || p === '.' || p === '..' || /[<>:"|?*]/.test(p) || [...p].some(c => c.charCodeAt(0) < 32) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new Error(`Unsafe backup entry: ${path}`)
    if (((e.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error(`Linked backup entry: ${path}`)
    for (let depth = 1; depth <= parts.length; depth++) {
      const spelling = parts.slice(0, depth).join('/')
      const normalized = spelling.normalize('NFC').toLowerCase()
      const prior = spellings.get(normalized)
      if (prior !== undefined && prior !== spelling) throw new Error(`Case/Unicode ambiguous backup prefix: ${path}`)
      spellings.set(normalized, spelling)
    }
    if (/\.json$/i.test(path) && e.uncompressedSize > BACKUP_LIMITS.json) throw new Error(`Backup JSON size limit: ${path}`)
    const key = parts.join('/').normalize('NFC').toLowerCase()
    if (names.has(key)) throw new Error(`Duplicate backup entry: ${path}`)
    names.set(key, path.endsWith('/'))
    if (!Number.isSafeInteger(e.uncompressedSize) || e.uncompressedSize < 0 || e.uncompressedSize > BACKUP_LIMITS.entry || e.uncompressedSize > Math.max(1, e.compressedSize) * BACKUP_LIMITS.ratio) throw new Error(`Backup entry size/ratio limit: ${path}`)
    total += e.uncompressedSize
    if (total > BACKUP_LIMITS.total) throw new Error('Backup total size limit exceeded')
  }
  for (const name of names.keys()) {
    const parts = name.split('/')
    while (parts.length > 1) { parts.pop(); if (names.get(parts.join('/')) === false) throw new Error(`Backup file/directory collision: ${name}`) }
  }
}
export function validateBackupManifest(value: unknown): BackupManifest {
  const m = value as BackupManifest
  if (!m || m.version !== 1 || !Number.isFinite(m.createdAt) || typeof m.appVersion !== 'string' || !m.includes || !['settings', 'collections', 'themes'].every(k => typeof (m.includes as any)[k] === 'boolean') || !Array.isArray(m.includes.instances)) throw new Error('Invalid or unsupported backup manifest')
  const names = new Set<string>()
  const ids = new Set<string>()
  for (const i of m.includes.instances) {
    if (!i || typeof i.name !== 'string' || typeof i.id !== 'string' || !i.id || typeof i.folderName !== 'string') throw new Error('Invalid backup instance')
    validateInstanceFolder(i.folderName)
    const key = i.folderName.normalize('NFC').toLowerCase()
    if (names.has(key) || ids.has(i.id) || !['includesSaves', 'includesConfigs', 'includesMods', 'includesResourcePacks', 'includesShaderPacks'].every(k => typeof (i as any)[k] === 'boolean')) throw new Error('Duplicate or invalid backup instance')
    names.add(key); ids.add(i.id)
  }
  return m
}
export function backupByteLimiter(entry: Entry, budget: { bytes: number }, max = BACKUP_LIMITS.entry) {
  let bytes = 0
  return new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length; budget.bytes += chunk.length
    if (bytes > max || bytes > entry.uncompressedSize || budget.bytes > BACKUP_LIMITS.total) callback(new Error(`Backup decompression limit: ${entry.fileName}`))
    else callback(null, chunk)
  }, flush(callback) { callback(bytes !== entry.uncompressedSize ? new Error(`Backup entry size mismatch: ${entry.fileName}`) : undefined) } })
}
export async function readBackupJSON(zip: Parameters<typeof openEntryReadStream>[0], entry: Entry, budget: { bytes: number }, signal?: AbortSignal) {
  if (entry.uncompressedSize > BACKUP_LIMITS.json) throw new Error(`Backup JSON size limit: ${entry.fileName}`)
  const chunks: Buffer[] = []
  await pipeline(await openEntryReadStream(zip, entry), backupByteLimiter(entry, budget, BACKUP_LIMITS.json), new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback() } }), { signal })
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/** Check the central-directory count before readAllEntries can allocate it. */
export function readBoundedBackupEntries(zip: Parameters<typeof readAllEntries>[0]) {
  if (!Number.isSafeInteger(zip.entryCount) || zip.entryCount < 1 || zip.entryCount > BACKUP_LIMITS.entries) throw new Error('Backup entry count limit exceeded')
  return readAllEntries(zip)
}
