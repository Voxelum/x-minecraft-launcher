import { open, readAllEntries, readEntry } from '@xmcl/unzip'
import { createHash } from 'node:crypto'
import { posix } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { ZipFile } from 'yazl'
import { addPackwizMetadata, addPackwizOverride, getPackwizSide, validatePackwizPaths } from './packwizExport'

async function entries(zip: ZipFile) {
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    zip.outputStream.on('data', chunk => chunks.push(chunk))
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on('error', reject)
  })
  zip.end()
  const archive = await open(await done)
  return Promise.all((await readAllEntries(archive)).map(async entry => ({
    path: entry.fileName,
    buffer: await readEntry(archive, entry),
  })))
}

describe('Packwiz export contents', () => {
  it.each(['client', 'server', 'both'] as const)('uses metadata-relative filenames and preserves %s side', async side => {
    const zip = new ZipFile()
    const index = addPackwizMetadata(zip, 'mods/example.jar', {
      name: 'Example', filename: 'mods/example.jar', side: getPackwizSide({ path: 'mods/example.jar', env: side === 'server' ? { client: 'unsupported' } : side === 'client' ? { server: 'unsupported' } : undefined }),
      download: { url: 'https://example.com/example.jar', 'hash-format': 'sha256', hash: 'abc' },
    })
    const [entry] = await entries(zip)
    const meta = parse(entry.buffer.toString())
    expect(meta.filename).toBe('example.jar')
    expect(meta.side).toBe(side)
    expect(posix.join(posix.dirname(entry.path), meta.filename as string)).toBe('mods/example.jar')
    expect(index).toEqual({ file: entry.path, metafile: true, hash: createHash('sha256').update(entry.buffer).digest('hex') })
  })

  it('keeps ordinary overrides byte-for-byte with correct index hashes', async () => {
    const zip = new ZipFile()
    const content = Buffer.from('config=true\n')
    const index = addPackwizOverride(zip, { path: 'config/common.cfg' }, content)
    const [entry] = await entries(zip)
    expect(entry.path).toBe('config/common.cfg')
    expect(entry.buffer).toEqual(content)
    expect(index.hash).toBe(createHash('sha256').update(content).digest('hex'))
  })

  it.each([{ client: 'unsupported' }, { server: 'unsupported' }] as const)('rejects raw overrides whose side cannot be represented: %j', env => {
    expect(() => addPackwizOverride(new ZipFile(), { path: 'config/side.cfg', env }, Buffer.from('side'))).toThrow('cannot preserve side')
  })

  it('rejects same-path client/server destinations, reserved manifests, and metadata collisions', () => {
    for (const paths of [['config/shared.cfg', 'config/shared.cfg'], ['pack.toml'], ['index.toml'], ['mods/a.jar', 'mods/a.jar.pw.toml'], ['mods/a.jar.pw.toml', 'mods/a.jar']]) {
      expect(() => validatePackwizPaths(paths.map(path => ({ path })))).toThrow('conflicting destination')
    }
    expect(() => validatePackwizPaths([{ path: 'config/client.cfg' }, { path: 'mods/a.jar' }])).not.toThrow()
  })
})
