import { expect, it } from 'vitest'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAppInstaller } from './appinstaller-builder'

it('cannot emit an inherited update feed before Vardrynn release hosting is configured', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vardrynn-appinstaller-'))
  try {
    await expect(buildAppInstaller('0.73.1', join(directory, 'vardrynn.appinstaller'), 'CN=Vardrynn'))
      .rejects.toThrow('not configured')
    expect(await readdir(directory)).toEqual([])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
