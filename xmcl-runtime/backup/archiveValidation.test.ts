import { expect, test } from 'vitest'
import { BACKUP_LIMITS, backupByteLimiter, validateBackupEntries, validateBackupManifest } from './archiveValidation'
import { Readable, Writable } from 'stream'
import { pipeline } from 'stream/promises'
const entry = (fileName: string, extra = {}) => ({ fileName, uncompressedSize: 1, compressedSize: 1, externalFileAttributes: 0, ...extra }) as any
for (const name of ['../x', '/root', 'a\\b', 'C:x', 'foo:ads', 'a/../b', 'a//b', 'NUL.txt', 'x/COM1', 'a.', 'a ', 'a/\0b']) test(`reject unsafe archive name ${JSON.stringify(name)}`, () => {
  expect(() => validateBackupEntries([entry(name)])).toThrow()
})
for (const names of [['A', 'a'], ['a', 'a/'], ['a', 'a/b'], ['a/b', 'A'], ['é', 'e\u0301'], ['A/x', 'a/y'], ['é/x', 'e\u0301/y']]) test(`reject collision ${names}`, () => {
  expect(() => validateBackupEntries(names.map(n => entry(n)))).toThrow()
})
test('reject symlink, entry count, depth, declared sizes and ratio', () => {
  for (const entries of [[entry('link', { externalFileAttributes: 0xa000 << 16 })], [entry('a', { uncompressedSize: BACKUP_LIMITS.entry + 1 })], [entry('a', { uncompressedSize: 1001 })], [entry(Array(34).fill('a').join('/'))]]) expect(() => validateBackupEntries(entries)).toThrow()
})
test('allows normal directories, independent names and binary files', () => {
  expect(() => validateBackupEntries([entry('instances/'), entry('instances/a/instance.json'), entry('instances/a/saves/world/level.dat')])).not.toThrow()
})
test('actual stream limit and exact byte count enforced', async () => {
  const sink = () => new Writable({ write(_c, _e, cb) { cb() } })
  await expect(pipeline(Readable.from([Buffer.alloc(10)]), backupByteLimiter(entry('a'), { bytes: 0 }), sink())).rejects.toThrow('limit')
  await expect(pipeline(Readable.from([Buffer.alloc(1)]), backupByteLimiter(entry('a', { uncompressedSize: 2 }), { bytes: 0 }), sink())).rejects.toThrow('size mismatch')
  await expect(pipeline(Readable.from([Buffer.alloc(1)]), backupByteLimiter(entry('a'), { bytes: BACKUP_LIMITS.total }), sink())).rejects.toThrow('limit')
})
test('manifest version, category types and unique instances are strict', () => {
  const m = { version: 1, createdAt: Date.now(), appVersion: '1', includes: { settings: false, collections: false, themes: false, instances: [] as any[] } }
  expect(validateBackupManifest(m)).toBe(m)
  for (const bad of [{ ...m, version: 2 }, { ...m, includes: {} }, null]) expect(() => validateBackupManifest(bad)).toThrow()
  const i = { id: 'a', name: 'a', folderName: 'a', includesSaves: true, includesConfigs: false, includesMods: false, includesResourcePacks: false, includesShaderPacks: false }
  m.includes.instances = [i, { ...i, folderName: 'A' }]
  expect(() => validateBackupManifest(m)).toThrow()
})
