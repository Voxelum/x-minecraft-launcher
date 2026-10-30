import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as unzip from '@xmcl/unzip'
import { safeBackupPath, validateInstanceFolder } from './safePath'

vi.mock('@xmcl/runtime-api', () => ({ BackupServiceKey: 'BackupService' }))
vi.mock('~/app', () => ({ Inject: () => () => {}, LauncherAppKey: 'app', kGameDataPath: 'game' }))
vi.mock('~/service', () => ({ ExposeServiceKey: () => () => {}, AbstractService: class {} }))
vi.mock('~/instance/InstanceService', () => ({ InstanceService: class {} }))
vi.mock('~/theme/ThemeService', () => ({ ThemeService: class {} }))
vi.mock('~/collection/CollectionService', () => ({ CollectionService: class {} }))
vi.mock('~/settings', () => ({ kSettings: 'settings' }))
vi.mock('~/util/zip', () => ({ writeZipFile: vi.fn() }))
import { BackupService } from './BackupService'
import { ZipFile } from 'yazl'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

let root: string
beforeEach(async () => { root = await realpath(await mkdtemp(join(tmpdir(), 'xmcl-backup-safety-'))) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

test('rejects traversal, prefix siblings and linked ancestors without modifying files', async () => {
  await mkdir(join(root, 'backups'))
  await mkdir(join(root, 'backups-other'))
  await writeFile(join(root, 'backups-other', 'data.zip'), 'OLD')
  await symlink(join(root, 'backups-other'), join(root, 'backups', 'linked'))
  for (const name of ['../outside/data.zip', '..\\outside\\data.zip', 'linked/data.zip', '/absolute', 'C:\\bad']) {
    await expect(safeBackupPath(join(root, 'backups'), name)).rejects.toThrow()
  }
  for (const name of ['../outside', '..', 'a/b', 'a\\b']) expect(() => validateInstanceFolder(name)).toThrow()
  const service = Object.create(BackupService.prototype)
  service.operation = Promise.resolve()
  service.initialize = async () => {}
  service.loadAutoBackupConfig = async () => ({ destinationDir: join(root, 'backups') })
  await expect(service.deleteAutoBackup(join(root, 'backups-other', 'data.zip'))).rejects.toThrow()
  await expect(service.deleteAutoBackup(join(root, 'backups', 'linked', 'data.zip'))).rejects.toThrow()
  expect(await readFile(join(root, 'backups-other', 'data.zip'), 'utf8')).toBe('OLD')
})

function manifest() {
  return { version: 1, createdAt: Date.now(), appVersion: '1', includes: { settings: false, collections: false, themes: false, instances: [{ id: 'demo', folderName: 'demo', name: 'demo', includesSaves: false, includesConfigs: true, includesMods: false, includesResourcePacks: false, includesShaderPacks: false }] } }
}
async function archive(files: Record<string, string>) {
  const zip = new ZipFile()
  for (const [name, data] of Object.entries(files)) zip.addBuffer(Buffer.from(data), name)
  const file = join(root, 'backup.zip')
  const done = pipeline(zip.outputStream, createWriteStream(file))
  zip.end()
  await done
  return file
}

function service() {
  const s = Object.create(BackupService.prototype)
  s.operation = Promise.resolve()
  s.initialize = async () => {}
  s.getAppDataPath = (...parts: string[]) => join(root, 'app', ...parts)
  s.app = { registry: { get: async () => ({ enter: async () => ({ prepareInstances: async () => Buffer.from('{}'), publish: async () => {}, undoPublish: async () => {}, release: async () => {} }) }) } }
  s.getPath = (...parts: string[]) => join(root, ...parts)
  s.emit = () => {}
  s.log = () => {}
  s.warn = () => {}
  s.instanceService = { loadInstance: vi.fn() }
  return s
}

test('preflight failure leaves all existing files intact', async () => {
  const dir = join(root, 'instances', 'demo')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'first.txt'), 'OLD')
  await writeFile(join(dir, 'blocker'), 'not-directory')
  const backupPath = await archive({
    'manifest.json': JSON.stringify(manifest()),
    'instances/demo/instance.json': JSON.stringify({ name: 'demo' }),
    'instances/demo/first.txt': 'NEW',
    'instances/demo/blocker/second.txt': 'NEW',
  })
  await expect(service().restoreBackup({ backupPath, instances: ['demo'], instanceConflictStrategy: 'overwrite' })).rejects.toThrow()
  expect(await readFile(join(dir, 'first.txt'), 'utf8')).toBe('OLD')
})

test('staging stream failure leaves existing files intact', async () => {
  const dir = join(root, 'instances', 'demo')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'first.txt'), 'OLD')
  const zip = new ZipFile()
  zip.addBuffer(Buffer.from(JSON.stringify(manifest())), 'manifest.json')
  zip.addBuffer(Buffer.from(JSON.stringify({ name: 'demo' })), 'instances/demo/instance.json')
  zip.addBuffer(Buffer.from('NEW'), 'instances/demo/first.txt')
  zip.addBuffer(Buffer.from('SECOND'), 'instances/demo/second.txt')
  const backupPath = join(root, 'duplicate.zip')
  const done = pipeline(zip.outputStream, createWriteStream(backupPath))
  zip.end()
  await done
  const original = unzip.openEntryReadStream
  const spy = vi.spyOn(unzip, 'openEntryReadStream').mockImplementation((zip, entry, options) => {
    if (entry.fileName.endsWith('second.txt')) return Promise.reject(new Error('Injected read failure'))
    return original(zip, entry, options)
  })
  await expect(service().restoreBackup({ backupPath, instances: ['demo'], instanceConflictStrategy: 'overwrite' })).rejects.toThrow()
  expect(await readFile(join(dir, 'first.txt'), 'utf8')).toBe('OLD')
  spy.mockRestore()
})

test('restore refuses an existing linked file and keeps its outside target intact', async () => {
  const dir = join(root, 'instances', 'demo')
  await mkdir(dir, { recursive: true })
  const outside = join(root, 'outside.txt')
  await writeFile(outside, 'OLD')
  await symlink(outside, join(dir, 'config.txt'))
  const backupPath = await archive({
    'manifest.json': JSON.stringify(manifest()),
    'instances/demo/instance.json': JSON.stringify({ name: 'demo' }),
    'instances/demo/config.txt': 'NEW',
  })
  await expect(service().restoreBackup({ backupPath, instances: ['demo'], instanceConflictStrategy: 'overwrite' })).rejects.toThrow()
  expect(await readFile(outside, 'utf8')).toBe('OLD')
})
