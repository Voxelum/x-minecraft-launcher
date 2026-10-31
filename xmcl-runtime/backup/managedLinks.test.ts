import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, relative } from 'path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { readManagedRestoreLink } from './managedLinks'
let root: string
beforeEach(async () => { root = await realpath(await mkdtemp(join(tmpdir(), 'xmcl-managed-links-'))); await mkdir(join(root, 'instance')); await mkdir(join(root, 'libraries')) })
afterEach(async () => { await rm(root, { force: true, recursive: true }) })
test('canonical absolute launcher cache link is accepted without target reads', async () => {
  const instance = join(root, 'instance')
  const libraries = join(root, 'libraries')
  await symlink(libraries, join(instance, 'libraries'), process.platform === 'win32' ? 'junction' : 'dir')
  expect(await readManagedRestoreLink(instance, join(instance, 'libraries'), { libraries })).toBeTruthy()
})
test.skipIf(process.platform === 'win32')('relative and dot-segment spellings are rejected even when lexically equal', async () => {
  const instance = join(root, 'instance')
  const libraries = join(root, 'libraries')
  for (const text of [relative(instance, libraries), `${root}/./libraries`, `${root}/instance/../libraries`]) {
    await symlink(text, join(instance, 'libraries'), 'dir')
    await expect(readManagedRestoreLink(instance, join(instance, 'libraries'), { libraries })).rejects.toThrow('outside')
    await rm(join(instance, 'libraries'))
  }
})
test.skipIf(process.platform === 'win32')('symlink intermediate before dot-dot cannot impersonate approved cache root', async () => {
  const instance = join(root, 'instance')
  const libraries = join(root, 'libraries')
  await mkdir(join(root, 'outside', 'deep'), { recursive: true }); await mkdir(join(root, 'outside', 'libraries'))
  await writeFile(join(root, 'outside', 'libraries', 'bytes'), 'UNTOUCHED')
  await symlink(join(root, 'outside', 'deep'), join(root, 'bridge'), 'dir')
  await symlink(`${root}/bridge/../libraries`, join(instance, 'libraries'), 'dir')
  await expect(readManagedRestoreLink(instance, join(instance, 'libraries'), { libraries })).rejects.toThrow('outside')
})
