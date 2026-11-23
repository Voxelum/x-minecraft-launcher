import { open, readAllEntries, readEntryBuffered } from '@xmcl/unzip'
import { createWriteStream } from 'fs'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ZipFile } from 'yazl'
import {
  listShaderPackLangEntries,
  readShaderPackLangBuffer,
  resolveShaderLangTargetPath,
  toMcLangCode,
  writeShaderPackLangBuffer,
} from './shaderPackZip'

let root = ''

async function createPack(files: Record<string, string>, directories: string[] = []) {
  const zip = new ZipFile()
  // 真实光影包通常带显式目录条目，写回时必须原样保留
  for (const directory of directories) zip.addEmptyDirectory(directory)
  for (const [name, content] of Object.entries(files)) {
    zip.addBuffer(Buffer.from(content, 'utf-8'), name)
  }
  zip.end()
  const packPath = join(root, 'pack.zip')
  await pipeline(zip.outputStream, createWriteStream(packPath))
  return packPath
}

async function readPackEntries(packPath: string) {
  const zip = await open(packPath)
  try {
    const entries = await readAllEntries(zip)
    const result: Record<string, string> = {}
    for (const entry of entries) {
      if (entry.fileName.endsWith('/')) continue
      result[entry.fileName] = (await readEntryBuffered(zip, entry)).toString('utf-8')
    }
    return result
  } finally {
    zip.close()
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'xmcl-shader-lang-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('shaderPackZip', () => {
  it('normalizes locale codes and resolves the target path', () => {
    expect(toMcLangCode('zh-CN')).toBe('zh_cn')
    expect(toMcLangCode('zh')).toBe('zh_cn')
    expect(toMcLangCode('en_IN')).toBe('en_us')
    expect(resolveShaderLangTargetPath('shaders/lang/en_US.lang', 'zh_cn', [])).toBe('shaders/lang/zh_CN.lang')
    expect(resolveShaderLangTargetPath('lang/en_us.lang', 'zh_cn', [])).toBe('lang/zh_cn.lang')
    // 已有大小写不同但等价的路径时复用，避免产生两个语言文件
    expect(resolveShaderLangTargetPath('lang/en_us.lang', 'zh_cn', ['lang/zh_CN.lang'])).toBe('lang/zh_CN.lang')
  })

  it('lists only lang files at the supported depth', async () => {
    const packPath = await createPack({
      'shaders/lang/en_US.lang': 'a=1\n',
      'lang/zh_CN.lang': 'a=一\n',
      'shaders/world0/lang/en_US.lang': 'a=deep\n',
      'shaders/shaders.properties': 'screen=SHADERS\n',
    })

    const files = await listShaderPackLangEntries(packPath)
    expect(files.map(file => file.fileName).sort()).toEqual(['lang/zh_CN.lang', 'shaders/lang/en_US.lang'])
    expect(files.find(file => file.fileName === 'shaders/lang/en_US.lang')?.locale).toBe('en_US')
  })

  it('reads a language entry case-insensitively', async () => {
    const packPath = await createPack({ 'shaders/lang/en_US.lang': 'a=1\n' })
    const buffer = await readShaderPackLangBuffer(packPath, 'shaders/lang/en_us.lang')
    expect(buffer.toString('utf-8')).toBe('a=1\n')
  })

  it('adds a target language entry without losing other files', async () => {
    const packPath = await createPack({
      'shaders/lang/en_US.lang': 'a=1\n',
      'shaders/shaders.properties': 'screen=SHADERS\n',
      'shaders/program/water.fsh': 'void main() {}\n',
    })

    const result = await writeShaderPackLangBuffer(packPath, 'shaders/lang/zh_CN.lang', Buffer.from('a=一\n', 'utf-8'))
    expect(result.replaced).toBe(false)

    const entries = await readPackEntries(packPath)
    expect(entries['shaders/lang/zh_CN.lang']).toBe('a=一\n')
    expect(entries['shaders/lang/en_US.lang']).toBe('a=1\n')
    expect(entries['shaders/shaders.properties']).toBe('screen=SHADERS\n')
    expect(entries['shaders/program/water.fsh']).toBe('void main() {}\n')
  })

  it('replaces an existing target entry instead of duplicating it', async () => {
    const packPath = await createPack({
      'shaders/lang/en_US.lang': 'a=1\n',
      'shaders/lang/zh_CN.lang': 'a=旧\n',
    })

    const result = await writeShaderPackLangBuffer(packPath, 'shaders/lang/zh_CN.lang', Buffer.from('a=新\n', 'utf-8'))
    expect(result.replaced).toBe(true)

    const entries = await readPackEntries(packPath)
    expect(Object.keys(entries).filter(name => name === 'shaders/lang/zh_CN.lang')).toHaveLength(1)
    expect(entries['shaders/lang/zh_CN.lang']).toBe('a=新\n')
  })

  it('keeps explicit directory entries when rewriting the pack', async () => {
    const packPath = await createPack(
      { 'shaders/lang/en_US.lang': 'a=1\n' },
      ['shaders/', 'shaders/lang/'],
    )

    // 曾经这里会抛 options.compress not allowed（目录条目不能传 compress）
    const result = await writeShaderPackLangBuffer(packPath, 'shaders/lang/zh_CN.lang', Buffer.from('a=一\n', 'utf-8'))
    expect(result.replaced).toBe(false)

    const entries = await readPackEntries(packPath)
    expect(entries['shaders/lang/zh_CN.lang']).toBe('a=一\n')
    expect(entries['shaders/lang/en_US.lang']).toBe('a=1\n')

    // 目录条目本身也要保留
    const zip = await open(packPath)
    const names = (await readAllEntries(zip)).map(entry => entry.fileName)
    zip.close()
    expect(names).toContain('shaders/lang/')
  })

  it('rejects non zip paths', async () => {
    const textPath = join(root, 'pack.txt')
    await writeFile(textPath, 'not a zip')
    await expect(listShaderPackLangEntries(textPath)).rejects.toThrow(/zip/)
  })
})
