import { openEntryReadStream } from '@xmcl/unzip'
import { mkdtemp, ensureDir, pathExists, readFile, remove, writeFile } from 'fs-extra'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { Readable } from 'stream'
import { createHash } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ZipManager } from '~/infra'
import { unzipInstanceFiles } from './unzipInstanceFiles'

vi.mock('@xmcl/unzip', () => ({ openEntryReadStream: vi.fn() }))

describe('unzipInstanceFiles ready files', () => {
  const roots: string[] = []
  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(roots.splice(0).map(path => remove(path)))
  })

  async function fixture(crc32 = 891568578) {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-ready-zip-'))
    roots.push(root)
    const destination = join(root, 'workspace', 'config', 'test.txt')
    const manager = {
      open: vi.fn(async () => ({
        file: {},
        entries: { 'config/test.txt': { fileName: 'config/test.txt', uncompressedSize: 3, crc32 } },
      })),
    }
    const queue = [{
      file: { path: 'config/test.txt', hashes: { crc32: String(crc32) } },
      zipPath: join(root, 'pack.zip'),
      entryName: 'config/test.txt',
      destination,
    }]
    vi.mocked(openEntryReadStream).mockImplementation(async () => Readable.from([Buffer.from('abc')]))
    return { root, destination, manager: manager as unknown as ZipManager, queue }
  }

  it('replaces a same-size partial extraction instead of trusting its size', async () => {
    const { destination, manager, queue } = await fixture()
    await ensureDir(dirname(destination))
    await writeFile(destination, 'bad')
    const finished = new Set<string>()
    await unzipInstanceFiles(manager, queue, finished, new AbortController().signal)
    expect(await readFile(destination, 'utf8')).toBe('abc')
    expect([...finished]).toEqual(['config/test.txt'])
  })

  it('does not publish an entry with a bad checksum', async () => {
    const { manager, queue } = await fixture(123)
    const finished = new Set<string>()
    await expect(unzipInstanceFiles(manager, queue, finished, new AbortController().signal))
      .rejects.toMatchObject({ name: 'ChecksumNotMatchError', expect: '123', actual: '891568578' })
    expect(finished.size).toBe(0)
  })

  it('rejects a stronger manifest hash mismatch even when the archive CRC matches', async () => {
    const { manager, queue } = await fixture()
    const finished = new Set<string>()
    Object.assign(queue[0].file.hashes, { sha512: createHash('sha512').update('bad').digest('hex') })
    await expect(unzipInstanceFiles(manager, queue, finished, new AbortController().signal))
      .rejects.toMatchObject({ name: 'ChecksumNotMatchError', algorithm: 'sha512' })
    expect(finished.size).toBe(0)
  })
  it('reports a missing entry rather than treating extraction as complete', async () => {
    const { manager, queue } = await fixture()
    queue[0].entryName = 'missing.txt'
    const finished = new Set<string>()
    await expect(unzipInstanceFiles(manager, queue, finished, new AbortController().signal))
      .rejects.toThrow('Missing ZIP entry')
    expect(finished.size).toBe(0)
  })

  it('does not create staging directories for already cancelled work', async () => {
    const { root, manager, queue } = await fixture()
    const controller = new AbortController()
    controller.abort()
    await expect(unzipInstanceFiles(manager, queue, new Set(), controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(await pathExists(join(root, 'workspace'))).toBe(false)
  })
})
