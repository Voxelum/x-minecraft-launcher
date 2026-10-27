import { mkdtemp, readFile, rm } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { ZipFile } from 'yazl'
import { writeZipFile } from '../util/zip'
import { listShaderPackZipLangs, readShaderPackZipEntry, writeShaderPackZipEntry } from './shaderPackZip'

const tempDirs: string[] = []

async function createZip() {
  const dir = await mkdtemp(join(tmpdir(), 'xmcl-shaderpack-zip-'))
  tempDirs.push(dir)
  const file = join(dir, 'shader.zip')
  const zip = new ZipFile()
  zip.addBuffer(Buffer.from('shader main'), 'shaders/shader.fsh')
  zip.addBuffer(Buffer.from('en=English\n'), 'shaders/lang/en_US.lang')
  zip.addBuffer(Buffer.from('keep me'), 'assets/keep.txt')
  await writeZipFile(zip, file)
  return file
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('shaderPackZip', () => {
  it('lists and reads language entries', async () => {
    const file = await createZip()
    expect(await listShaderPackZipLangs(file)).toEqual([
      { path: 'shaders/lang/en_US.lang', locale: 'en_US', bytes: 11 },
    ])
    expect((await readShaderPackZipEntry(file, 'shaders/lang/en_US.lang')).toString()).toBe('en=English\n')
  })

  it('adds a target language without losing other entries', async () => {
    const file = await createZip()
    await writeShaderPackZipEntry({
      filePath: file,
      entryPath: 'shaders/lang/zh_CN.lang',
      content: Buffer.from('en=中文\n'),
    })

    expect((await readShaderPackZipEntry(file, 'shaders/lang/zh_CN.lang')).toString()).toBe('en=中文\n')
    expect((await readShaderPackZipEntry(file, 'assets/keep.txt')).toString()).toBe('keep me')
    expect((await readShaderPackZipEntry(file, 'shaders/shader.fsh')).toString()).toBe('shader main')
  })

  it('replaces an existing target entry and keeps the archive readable', async () => {
    const file = await createZip()
    await writeShaderPackZipEntry({
      filePath: file,
      entryPath: 'shaders/lang/en_US.lang',
      content: Buffer.from('en=Updated\n'),
    })

    expect((await readShaderPackZipEntry(file, 'shaders/lang/en_US.lang')).toString()).toBe('en=Updated\n')
    expect((await readFile(file)).subarray(0, 2).toString()).toBe('PK')
  })

  it('keeps the original archive when replacement fails', async () => {
    const file = await createZip()
    await expect(writeShaderPackZipEntry({
      filePath: file,
      entryPath: 'shaders/lang/zh_CN.lang',
      content: Buffer.from('en=中文\n'),
      onBeforeReplace: async () => { throw new Error('locked') },
    })).rejects.toThrow('locked')

    expect((await readShaderPackZipEntry(file, 'shaders/lang/en_US.lang')).toString()).toBe('en=English\n')
    expect((await listShaderPackZipLangs(file)).map(item => item.path)).toEqual(['shaders/lang/en_US.lang'])
  })
})
