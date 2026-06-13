import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// fs-extra uses getters, so the spread operator drops most of its
// exports. Hand back a Proxy that forwards every property except the
// three we override per-test.
const overrides: { readdir?: Function; copyFile?: Function; link?: Function } = {}

vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs-extra')>()
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === 'readdir' && overrides.readdir) return overrides.readdir
      if (prop === 'copyFile' && overrides.copyFile) return overrides.copyFile
      if (prop === 'link' && overrides.link) return overrides.link
      return Reflect.get(target, prop, receiver)
    },
  })
})

import { copyPassively, linkPassively } from './fs'

const mkSysErr = (code: string, msg: string) => {
  const e: any = new Error(`${code}: ${msg}`)
  e.code = code
  e.errno = -1
  return e
}

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'xmcl-fs-pass-'))
  overrides.readdir = undefined
  overrides.copyFile = undefined
  overrides.link = undefined
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('copyPassively', () => {
  test('copies a regular directory tree end-to-end', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(join(src, 'sub'), { recursive: true })
    writeFileSync(join(src, 'a.txt'), 'A')
    writeFileSync(join(src, 'sub', 'b.txt'), 'B')

    await copyPassively(src, dest)

    expect(readFileSync(join(dest, 'a.txt'), 'utf8')).toBe('A')
    expect(readFileSync(join(dest, 'sub', 'b.txt'), 'utf8')).toBe('B')
  })

  test('skips missing src silently (no throw)', async () => {
    const src = join(root, 'does-not-exist')
    const dest = join(root, 'dest')
    await expect(copyPassively(src, dest)).resolves.toBeUndefined()
    expect(existsSync(dest)).toBe(false)
  })

  test('does not overwrite existing destination files', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(src, { recursive: true })
    mkdirSync(dest, { recursive: true })
    writeFileSync(join(src, 'a.txt'), 'NEW')
    writeFileSync(join(dest, 'a.txt'), 'OLD')

    await copyPassively(src, dest)

    expect(readFileSync(join(dest, 'a.txt'), 'utf8')).toBe('OLD')
  })

  test('swallows UNKNOWN from readdir on a broken junction subdir without throwing', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(join(src, 'good'), { recursive: true })
    mkdirSync(join(src, 'broken-junction'), { recursive: true })
    writeFileSync(join(src, 'good', 'g.txt'), 'g')

    const real = await vi.importActual<typeof import('fs-extra')>('fs-extra')
    overrides.readdir = async (p: any) => {
      if (typeof p === 'string' && p.endsWith('broken-junction')) {
        throw mkSysErr('UNKNOWN', `unknown error, scandir '${p}'`)
      }
      return (real as any).readdir(p)
    }

    await expect(copyPassively(src, dest)).resolves.toBeUndefined()
    expect(readFileSync(join(dest, 'good', 'g.txt'), 'utf8')).toBe('g')
  })

  test.each(['UNKNOWN', 'EBUSY', 'EACCES', 'EPERM', 'EIO'])(
    'swallows %s from readdir without storming', async (code) => {
      const src = join(root, 'src')
      const dest = join(root, 'dest')
      mkdirSync(join(src, 'bad'), { recursive: true })

      const real = await vi.importActual<typeof import('fs-extra')>('fs-extra')
      overrides.readdir = async (p: any) => {
        if (typeof p === 'string' && p.endsWith('bad')) {
          throw mkSysErr(code, `simulated for ${p}`)
        }
        return (real as any).readdir(p)
      }

      await expect(copyPassively(src, dest)).resolves.toBeUndefined()
    })

  test('continues sibling work when one child copyFile fails with ENOENT (mid-walk delete)', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'a.txt'), 'A')
    writeFileSync(join(src, 'b.txt'), 'B')

    const real = await vi.importActual<typeof import('fs-extra')>('fs-extra')
    overrides.copyFile = async (s: any, d: any) => {
      if (typeof s === 'string' && s.endsWith('a.txt')) {
        throw mkSysErr('ENOENT', `no such file or directory, copyfile '${s}'`)
      }
      return (real as any).copyFile(s, d)
    }

    await expect(copyPassively(src, dest)).resolves.toBeUndefined()
    expect(readFileSync(join(dest, 'b.txt'), 'utf8')).toBe('B')
    expect(existsSync(join(dest, 'a.txt'))).toBe(false)
  })

  test('still surfaces non-allow-listed errors (e.g. ENOSPC) from a child', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'a.txt'), 'A')

    overrides.copyFile = async () => {
      throw mkSysErr('ENOSPC', 'no space left on device')
    }

    await expect(copyPassively(src, dest)).rejects.toMatchObject({ code: 'ENOSPC' })
  })
})

describe('linkPassively', () => {
  test('links a regular directory tree end-to-end', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(join(src, 'sub'), { recursive: true })
    writeFileSync(join(src, 'sub', 'b.txt'), 'B')

    await linkPassively(src, dest)
    expect(readFileSync(join(dest, 'sub', 'b.txt'), 'utf8')).toBe('B')
  })

  test('swallows UNKNOWN from readdir without throwing', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(join(src, 'bad'), { recursive: true })

    const real = await vi.importActual<typeof import('fs-extra')>('fs-extra')
    overrides.readdir = async (p: any) => {
      if (typeof p === 'string' && p.endsWith('bad')) {
        throw mkSysErr('UNKNOWN', `unknown error '${p}'`)
      }
      return (real as any).readdir(p)
    }

    await expect(linkPassively(src, dest)).resolves.toBeUndefined()
  })

  test('swallows EBUSY from a child link without throwing', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'a.txt'), 'A')
    writeFileSync(join(src, 'b.txt'), 'B')

    const real = await vi.importActual<typeof import('fs-extra')>('fs-extra')
    overrides.link = async (s: any, d: any) => {
      if (typeof s === 'string' && s.endsWith('a.txt')) {
        throw mkSysErr('EBUSY', `resource busy '${s}'`)
      }
      return (real as any).link(s, d)
    }

    await expect(linkPassively(src, dest)).resolves.toBeUndefined()
    expect(existsSync(join(dest, 'b.txt'))).toBe(true)
  })

  test('still surfaces non-allow-listed errors from a child', async () => {
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'a.txt'), 'A')

    overrides.link = async () => {
      throw mkSysErr('ENOSPC', 'no space left on device')
    }

    await expect(linkPassively(src, dest)).rejects.toMatchObject({ code: 'ENOSPC' })
  })
})
