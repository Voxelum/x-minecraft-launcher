import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createNodeInstallRuntime, executeInstallManifest, type InstallMaterializeOperation } from './installManifest'

vi.mock('fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('fs/promises')>()
  return { ...fs, rename: vi.fn(fs.rename), cp: vi.fn(fs.cp), rm: vi.fn(fs.rm) }
})

const realFs = await vi.importActual<typeof import('fs/promises')>('fs/promises')
const exdev = Object.assign(new Error('cross-device link not permitted'), { code: 'EXDEV' })

describe('materialization across virtualized volumes', () => {
  let root: string
  let target: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xmcl-materialize-exdev-'))
    target = join(root, 'MultiJarLauncher.class')
    vi.mocked(rename).mockReset().mockRejectedValue(exdev)
    vi.mocked(cp).mockReset().mockImplementation(realFs.cp)
    vi.mocked(rm).mockReset().mockImplementation(realFs.rm)
  })

  afterEach(async () => {
    await realFs.rm(root, { recursive: true, force: true })
  })

  function install(operations: InstallMaterializeOperation[], size = 3) {
    return executeInstallManifest({
      schemaVersion: 1,
      tasks: [{
        id: 'batch-launcher',
        type: 'materialize',
        operations,
        outputs: [{ path: target, size }],
      }],
    }, createNodeInstallRuntime())
  }

  test('keeps rename as the normal path', async () => {
    vi.mocked(rename).mockImplementation(realFs.rename)
    await install([{ type: 'write', path: target, content: 'new' }])

    expect(rename).toHaveBeenCalledOnce()
    expect(cp).not.toHaveBeenCalled()
    expect(await readFile(target, 'utf8')).toBe('new')
    expect(await readdir(root)).toEqual(['MultiJarLauncher.class'])
  })

  test.each([false, true])('copies a staged file and removes all temporary paths (existing=%s)', async (existing) => {
    if (existing) await writeFile(target, 'old')
    await install([{ type: 'write', path: target, content: 'new' }])

    expect(cp).toHaveBeenCalledTimes(existing ? 2 : 1)
    expect(await readFile(target, 'utf8')).toBe('new')
    expect(await readdir(root)).toEqual(['MultiJarLauncher.class'])
  })

  test('restores the old target if copied output fails validation', async () => {
    await writeFile(target, 'original')
    await expect(install([{ type: 'write', path: target, content: 'bad' }], 10)).rejects.toThrow('invalid output')

    expect(await readFile(target, 'utf8')).toBe('original')
    expect(await readdir(root)).toEqual(['MultiJarLauncher.class'])
  })

  test('backs up and restores directory contents without merging old files', async () => {
    await mkdir(target)
    await writeFile(join(target, 'original'), 'old')
    const runtime = createNodeInstallRuntime()
    const transaction = await runtime.materialize([{ type: 'remove', path: target }])
    await expect(realFs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' })
    await transaction.rollback()

    expect(await readFile(join(target, 'original'), 'utf8')).toBe('old')
    expect(await readdir(root)).toEqual(['MultiJarLauncher.class'])
  })

  test.each(['backup', 'install'])('cleans an incomplete %s copy without losing the original', async (phase) => {
    await writeFile(target, 'original')
    const copyError = Object.assign(new Error('disk full'), { code: 'ENOSPC' })
    vi.mocked(cp).mockImplementation(async (source, destination, options) => {
      if (phase === 'backup' ? String(destination).includes('.backup-') : String(source).includes('.install-')) {
        await writeFile(destination, 'partial')
        throw copyError
      }
      await realFs.cp(source, destination, options)
    })

    await expect(install([{ type: 'write', path: target, content: 'new' }])).rejects.toBe(copyError)

    expect(await readFile(target, 'utf8')).toBe('original')
    expect(await readdir(root)).toEqual(['MultiJarLauncher.class'])
  })

  test('removes partial output when there was no previous target', async () => {
    vi.mocked(cp).mockImplementation(async (_source, destination) => {
      await writeFile(destination, 'partial')
      throw Object.assign(new Error('disk full'), { code: 'ENOSPC' })
    })

    await expect(install([{ type: 'write', path: target, content: 'new' }])).rejects.toMatchObject({ code: 'ENOSPC' })
    expect(await readdir(root)).toEqual([])
  })

  test('records the complete backup before attempting to remove its source', async () => {
    await writeFile(target, 'original')
    const removeError = Object.assign(new Error('file busy'), { code: 'EBUSY' })
    vi.mocked(rm).mockRejectedValueOnce(removeError)

    await expect(install([{ type: 'write', path: target, content: 'new' }])).rejects.toBe(removeError)

    expect(await readFile(target, 'utf8')).toBe('original')
    expect(await readdir(root)).toEqual(['MultiJarLauncher.class'])
  })

  test('rolls back if removing the staged source after copying fails', async () => {
    await writeFile(target, 'original')
    const removeError = Object.assign(new Error('file busy'), { code: 'EBUSY' })
    vi.mocked(rm).mockImplementationOnce(realFs.rm).mockRejectedValueOnce(removeError)

    await expect(install([{ type: 'write', path: target, content: 'new' }])).rejects.toBe(removeError)

    expect(await readFile(target, 'utf8')).toBe('original')
    expect(await readdir(root)).toEqual(['MultiJarLauncher.class'])
  })

  test('does not copy on unrelated rename errors', async () => {
    await writeFile(target, 'original')
    const error = Object.assign(new Error('access denied'), { code: 'EACCES' })
    vi.mocked(rename).mockRejectedValue(error)

    await expect(install([{ type: 'write', path: target, content: 'new' }])).rejects.toBe(error)

    expect(cp).not.toHaveBeenCalled()
    expect(await readFile(target, 'utf8')).toBe('original')
    expect(await readdir(root)).toEqual(['MultiJarLauncher.class'])
  })

  test('reports rollback failure and retains the recoverable backup', async () => {
    await writeFile(target, 'original')
    vi.mocked(cp).mockImplementation(async (source, destination, options) => {
      if (String(source).includes('.backup-')) throw new Error('cannot restore backup')
      await realFs.cp(source, destination, options)
    })

    await expect(install([{ type: 'write', path: target, content: 'bad' }], 10)).rejects.toThrow('Failed to roll back materialization')

    const files = await readdir(root)
    expect(files).toHaveLength(1)
    expect(files[0]).toContain('.backup-')
    expect(await readFile(join(root, files[0]), 'utf8')).toBe('original')
  })
})
