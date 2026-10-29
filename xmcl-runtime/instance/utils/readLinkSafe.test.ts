import { mkdtemp, mkdir, symlink, rm, readlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { isLinkTo, normalizeLinkTarget, readlinkSafe } from './readLinkSafe'

const roots: string[] = []
async function isolated() {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-link-target-'))
  roots.push(root)
  await mkdir(join(root, 'instance'))
  await mkdir(join(root, 'shared'))
  return root
}
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

describe('real isolated symlink target comparison', () => {
  it('resolves a relative target from the link parent rather than process cwd', async () => {
    const root = await isolated()
    const link = join(root, 'instance', 'libraries')
    const target = join(root, 'shared')
    await symlink('../shared', link, 'dir')
    // Reproduces the previous cwd-based comparison without changing cwd.
    expect(normalizeLinkTarget(await readlink(link))).not.toBe(normalizeLinkTarget(target))
    expect(await isLinkTo(link, target)).toBe(true)
    expect(await readlink(link)).toBe('../shared')
    expect(await isLinkTo(link, join(root, 'other'))).toBe(false)
  })
  it('keeps absolute targets and trailing separators working', async () => {
    const root = await isolated()
    const target = join(root, 'shared')
    const link = join(root, 'instance', 'versions')
    await symlink(target, link, 'dir')
    expect(await isLinkTo(link, target + '/')).toBe(true)
    expect(normalizeLinkTarget('\\\\?\\' + target)).toBe(normalizeLinkTarget(target))
  })
  it('compares dangling relative links without dereferencing their targets', async () => {
    const root = await isolated()
    const link = join(root, 'instance', 'missing')
    await symlink('../not-created', link, 'dir')
    expect(await isLinkTo(link, join(root, 'not-created'))).toBe(true)
  })
  it('preserves missing/non-link behavior', async () => {
    const root = await isolated()
    const file = join(root, 'plain')
    await writeFile(file, 'not a link')
    expect(await readlinkSafe(join(root, 'absent'))).toBeUndefined()
    expect(await readlinkSafe(file)).toBeUndefined()
    expect(await isLinkTo(file, root)).toBe(false)
    expect(await isLinkTo(join(root, 'absent'), root)).toBe(false)
  })
})
