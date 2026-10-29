import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as fsExtra from 'fs-extra'
import { safeScreenshotPath } from './safeScreenshot'

vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs-extra') & { default: typeof import('fs-extra') }>()
  return { ...actual.default, ...actual, writeFile: vi.fn(actual.writeFile) }
})
vi.mock('@xmcl/runtime-api', () => ({ InstanceScreenshotServiceKey: 'screenshots' }))
vi.mock('~/app', () => ({ Inject: () => () => {}, LauncherAppKey: 'app' }))
vi.mock('~/service', () => ({ ExposeServiceKey: () => () => {}, AbstractService: class {} }))
vi.mock('./InstanceService', () => ({ InstanceService: class {} }))
import { InstanceScreenshotService } from './InstanceScreenshotService'

let root: string
let instance: string
function url(path: string) {
  const u = new URL('http://launcher/media')
  u.searchParams.set('path', path)
  return u.toString()
}
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'xmcl-screenshot-safety-')))
  instance = join(root, 'instance')
  await mkdir(join(instance, 'screenshots'), { recursive: true })
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
function service(known = true) {
  const s = Object.create(InstanceScreenshotService.prototype)
  s.error = vi.fn()
  s.warn = vi.fn()
  s.app = { registry: { get: async () => ({ state: { all: known ? { [instance]: {} } : {} } }) } }
  return s
}
const dataUrl = 'data:image/png;base64,UkVQTEFDRUQ='

test('edit rejects foreign paths, symlink files and directories without changing original bytes', async () => {
  const outside = join(root, 'outside.png')
  await writeFile(outside, 'OLD')
  await symlink(outside, join(instance, 'screenshots', 'link.png'))
  for (const originalUrl of [url(outside), url(join(instance, 'screenshots', 'link.png'))]) {
    await expect(service().saveEditedScreenshot({ instancePath: instance, dataUrl, originalUrl })).rejects.toThrow()
  }
  await mkdir(join(root, 'foreign'))
  await symlink(join(root, 'foreign'), join(instance, 'screenshots', 'linked-dir'))
  await expect(safeScreenshotPath(instance, url(join(instance, 'screenshots', 'linked-dir', 'x.png')))).rejects.toThrow()
  expect(await readFile(outside, 'utf8')).toBe('OLD')
})

test('requires a registered instance and accepts a normal screenshot or a distinct copy', async () => {
  const path = join(instance, 'screenshots', 'normal.png')
  await writeFile(path, 'OLD')
  await expect(service(false).saveEditedScreenshot({ instancePath: instance, dataUrl, originalUrl: url(path) })).rejects.toThrow()
  const copy = await service().saveEditedScreenshot({ instancePath: instance, dataUrl, originalUrl: url(path), saveAsCopy: true })
  expect(copy.path).not.toBe(path)
  expect(await readFile(path, 'utf8')).toBe('OLD')
  await service().saveEditedScreenshot({ instancePath: instance, dataUrl, originalUrl: url(path) })
  expect(await readFile(path, 'utf8')).toBe('REPLACED')
})

test('new edits reject a symlinked screenshots root', async () => {
  const other = join(root, 'other')
  await mkdir(other)
  const linkedInstance = join(root, 'linked-instance')
  await mkdir(linkedInstance)
  await symlink(other, join(linkedInstance, 'screenshots'))
  const s = service()
  s.app.registry.get = async () => ({ state: { all: { [linkedInstance]: {} } } })
  await expect(s.saveEditedScreenshot({ instancePath: linkedInstance, dataUrl })).rejects.toThrow()
})

test('failed staged write preserves the original screenshot', async () => {
  const path = join(instance, 'screenshots', 'normal.png')
  await writeFile(path, 'OLD')
  const spy = vi.spyOn(fsExtra, 'writeFile').mockRejectedValueOnce(new Error('Injected disk error'))
  try {
    await expect(service().saveEditedScreenshot({ instancePath: instance, dataUrl, originalUrl: url(path) })).rejects.toThrow('Injected disk error')
    expect(await readFile(path, 'utf8')).toBe('OLD')
  } finally { spy.mockRestore() }
})

test('batch exports never overwrite collisions or follow a destination symlink', async () => {
  const source = join(instance, 'screenshots', 'image.png')
  const destination = join(root, 'image.png')
  const linked = join(root, 'link.png')
  await writeFile(source, 'IMAGE')
  await writeFile(destination, 'IMPORTANT')
  await symlink(destination, linked)
  const s = service()
  expect(await s.saveScreenshotAs(url(source), destination)).toBe(false)
  expect(await s.saveScreenshotAs(url(source), linked)).toBe(false)
  expect(await s.saveScreenshotAs(url(source), linked, true)).toBe(false)
  expect(await readFile(destination, 'utf8')).toBe('IMPORTANT')
  expect(await s.saveScreenshotAs(url(source), destination, true)).toBe(true)
  expect(await readFile(destination, 'utf8')).toBe('IMAGE')
})

test('deletion rejects foreign files and import rejects a linked screenshot directory', async () => {
  const outside = join(root, 'outside.png')
  await writeFile(outside, 'IMPORTANT')
  expect(await service().deleteScreenshot(url(outside))).toBe(false)
  expect(await readFile(outside, 'utf8')).toBe('IMPORTANT')
  const image = join(instance, 'screenshots', 'image.png')
  await writeFile(image, 'IMAGE')
  expect(await service().deleteScreenshot(url(image))).toBe(true)
  const otherInstance = join(root, 'other-instance')
  await mkdir(otherInstance)
  await symlink(join(instance, 'screenshots'), join(otherInstance, 'screenshots'))
  const s = service()
  s.app.registry.get = async () => ({ state: { all: { [otherInstance]: {} } } })
  await expect(s.importScreenshots(otherInstance, [outside])).rejects.toThrow()
})
