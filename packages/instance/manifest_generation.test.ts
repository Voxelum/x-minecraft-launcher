import { describe, it, expect } from 'vitest'
import {
  shouldBeExcluded,
  createDefaultFileFilter,
  generateInstanceServerManifest,
} from './manifest_generation'
import { Stats } from 'fs-extra'
import { mkdtemp, writeFile, ensureDir, rm } from 'fs-extra'
import { join } from 'path'
import os from 'os'

const logger = {
  log: () => {},
  warn: () => {},
}

describe('manifest_generation', () => {
  it('should exclude correct paths', () => {
    const dirStat = { isDirectory: () => true } as unknown as Stats
    const fileStat = { isDirectory: () => false } as unknown as Stats

    expect(shouldBeExcluded('.backups/foo', fileStat)).toBe(true)
    expect(shouldBeExcluded('some.DS_Store', fileStat)).toBe(true)
    expect(shouldBeExcluded('instance.json', fileStat)).toBe(true)
    expect(shouldBeExcluded('server', dirStat)).toBe(true)
    expect(shouldBeExcluded('versions/1.0', fileStat)).toBe(true)
    expect(shouldBeExcluded('assets/something', fileStat)).toBe(true)
    expect(shouldBeExcluded('libraries/lib', fileStat)).toBe(true)
    expect(shouldBeExcluded('normal.txt', fileStat)).toBe(false)
  })

  it('createDefaultFileFilter behaves similarly', () => {
    const filter = createDefaultFileFilter()
    const dirStat = { isDirectory: () => true } as unknown as any
    const fileStat = { isDirectory: () => false } as unknown as any

    expect(filter('.backups/data', fileStat)).toBe(true)
    expect(filter('resourcepacks/foo.png', fileStat)).toBe(true)
    expect(filter('shaderpacks/bar.json', fileStat)).toBe(true)
    expect(filter('server', dirStat)).toBe(true)
    expect(filter('bin/exe.dll', fileStat)).toBe(true)
    expect(filter('versions/1.0/something', fileStat)).toBe(true)
    expect(filter('normal/file.txt', fileStat)).toBe(false)
  })

  it('generateInstanceServerManifest returns server files only', async () => {
    const tmp = await mkdtemp(join(os.tmpdir(), 'xmcl-test-'))
    try {
      const serverDir = join(tmp, 'server')
      await ensureDir(serverDir)
      await writeFile(join(serverDir, 'server.properties'), 'foobar')
      await writeFile(join(serverDir, 'level.dat'), 'data')
      // create an excluded folder
      await ensureDir(join(serverDir, 'versions'))
      await writeFile(join(serverDir, 'versions', 'v.txt'), 'v')

      const files = await generateInstanceServerManifest({ path: tmp }, logger as any)

      const paths = files.map((f) => f.path).sort()
      expect(paths).toContain('server.properties')
      expect(paths).toContain('level.dat')
      expect(paths).not.toContain('versions/v.txt')
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })
})
