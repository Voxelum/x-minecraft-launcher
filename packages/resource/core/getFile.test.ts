import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ResourceDomain } from '../ResourceDomain'
import { getFiles } from './getFile'

describe('getFiles', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  })

  it('finds blueprint files in nested folders while exposing their basenames', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xmcl-resource-'))
    temporaryDirectories.push(directory)
    await mkdir(join(directory, 'folder'))
    await writeFile(join(directory, 'a.nbt'), '')
    await writeFile(join(directory, 'folder', 'b.nbt'), '')
    await writeFile(join(directory, 'folder', 'c.nbt'), '')

    const files = await getFiles(directory, ResourceDomain.Blueprints)

    expect(files.map((file) => file.fileName).sort()).toEqual(['a.nbt', 'b.nbt', 'c.nbt'])
    expect(files.map((file) => relative(directory, file.path).replace(/\\/g, '/')).sort()).toEqual([
      'a.nbt',
      'folder/b.nbt',
      'folder/c.nbt',
    ])
  })
})
