import { execFile } from 'child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { promisify } from 'util'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const exec = promisify(execFile)
const atomicModule = pathToFileURL(createRequire(import.meta.url).resolve('atomically')).href

// A fresh process lets stubborn-fs capture the fault-injected Node functions
// without mocking atomically itself or modifying Vitest's filesystem.
const script = `
import fs from 'node:fs'
const options = JSON.parse(process.argv[1])
const events = []
const failure = code => Object.assign(new Error(code), { code })
const rename = fs.rename
const renameSync = fs.renameSync
fs.rename = (source, destination, callback) => {
  events.push('rename')
  if (options.code) callback(failure(options.code))
  else rename(source, destination, callback)
}
fs.renameSync = (source, destination) => {
  events.push('rename')
  if (options.code) throw failure(options.code)
  return renameSync(source, destination)
}
const copy = fs.promises.copyFile
const copySync = fs.copyFileSync
fs.promises.copyFile = async (...args) => {
  events.push('copy')
  if (options.copyError) throw failure(options.copyError)
  await copy(...args)
}
fs.copyFileSync = (...args) => {
  events.push('copy')
  if (options.copyError) throw failure(options.copyError)
  return copySync(...args)
}
const fsync = fs.fsync
const fsyncSync = fs.fsyncSync
fs.fsync = (fd, callback) => {
  events.push('fsync')
  fsync(fd, callback)
}
fs.fsyncSync = fd => {
  events.push('fsync')
  return fsyncSync(fd)
}
const unlink = fs.promises.unlink
const unlinkSync = fs.unlinkSync
fs.promises.unlink = async path => {
  events.push('unlink')
  await unlink(path)
}
fs.unlinkSync = path => {
  events.push('unlink')
  return unlinkSync(path)
}
const atomic = await import(options.module)
try {
  const writeOptions = { timeout: 1, fsync: options.fsync }
  if (options.sync) {
    atomic.writeFileSync(options.target, 'new', writeOptions)
  } else {
    await Promise.all((options.contents || ['new']).map(content =>
      atomic.writeFile(options.target, content, writeOptions)))
  }
  console.log(JSON.stringify({ events }))
} catch (error) {
  console.log(JSON.stringify({ code: error.code, events }))
}
`

describe('atomically EXDEV dependency patch', () => {
  let root: string
  let target: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xmcl-atomic-exdev-'))
    target = join(root, 'index.json')
  })

  afterEach(() => rm(root, { recursive: true, force: true }))

  async function run(options: {
    sync?: boolean
    code?: string
    copyError?: string
    fsync?: boolean
    contents?: string[]
  }): Promise<{ code?: string; events: string[] }> {
    const { stdout } = await exec(process.execPath, [
      '--input-type=module',
      '-e',
      script,
      JSON.stringify({ module: atomicModule, target, ...options }),
    ])
    return JSON.parse(stdout)
  }

  describe.each([false, true])('sync=%s', (sync) => {
    test('uses rename without copying when it succeeds', async () => {
      const result = await run({ sync })

      expect(result.code).toBeUndefined()
      expect(result.events).toEqual(['fsync', 'rename'])
      expect(await readFile(target, 'utf8')).toBe('new')
      expect(await readdir(root)).toEqual(['index.json'])
    })

    test.each([false, true])('copies and syncs the destination on EXDEV (existing=%s)', async (existing) => {
      if (existing) await writeFile(target, 'original')
      const result = await run({ sync, code: 'EXDEV' })

      expect(result.code).toBeUndefined()
      expect(result.events).toEqual(['fsync', 'rename', 'copy', 'fsync', 'unlink'])
      expect(await readFile(target, 'utf8')).toBe('new')
      expect(await readdir(root)).toEqual(['index.json'])
    })

    test('honors disabled fsync in the copy fallback', async () => {
      const result = await run({ sync, code: 'EXDEV', fsync: false })

      expect(result.code).toBeUndefined()
      expect(result.events).toEqual(['rename', 'copy', 'unlink'])
      expect(await readFile(target, 'utf8')).toBe('new')
    })

    test('propagates unrelated rename errors without copying', async () => {
      await writeFile(target, 'original')
      const result = await run({ sync, code: 'EINVAL' })

      expect(result.code).toBe('EINVAL')
      expect(result.events).not.toContain('copy')
      expect(await readFile(target, 'utf8')).toBe('original')
      expect(await readdir(root)).toEqual(['index.json'])
    })

    test('propagates copy failures and cleans the temporary file', async () => {
      await writeFile(target, 'original')
      const result = await run({ sync, code: 'EXDEV', copyError: 'ENOSPC' })

      expect(result.code).toBe('ENOSPC')
      expect(result.events).toContain('copy')
      expect(await readFile(target, 'utf8')).toBe('original')
      expect(await readdir(root)).toEqual(['index.json'])
    })
  })

  test('keeps concurrent writes serialized through the complete fallback', async () => {
    const result = await run({ code: 'EXDEV', contents: ['first', 'second'] })

    expect(result.code).toBeUndefined()
    expect(result.events).toEqual([
      'fsync', 'rename', 'copy', 'fsync', 'unlink',
      'fsync', 'rename', 'copy', 'fsync', 'unlink',
    ])
    expect(await readFile(target, 'utf8')).toBe('second')
    expect(await readdir(root)).toEqual(['index.json'])
  })
})
