// import { xxhashFileFromBuf, xxhashFileFromStream } from '../util/hash'

import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { readFile, readdir, stat } from 'fs-extra'
import { join } from 'path'
import { pipeline } from 'stream/promises'

const THREASHOLD = 65536 * 20 // 20 chunk ~ 1.310 MB
export async function hashResource(path: string, size: number) {
  if (size > THREASHOLD) {
    const hash = createHash('sha1').setEncoding('hex')
    await pipeline(createReadStream(path), hash)
    return hash.read()
  }
  const hash = createHash('sha1').update(await readFile(path)).digest('hex')
  return hash
}
export async function hashAndFiletypeResource(path: string, size: number, dir?: boolean) {
  if (dir) {
    const hash = createHash('sha1')

    const mtimes = [] as number[]
    async function visit(cur: string) {
      const files = await readdir(cur)
      for (const file of files) {
        if (file === '.DS_Store') continue
        const fstat = await stat(join(cur, file))
        mtimes.push(fstat.mtimeMs)
        hash.update(file)
        if (fstat.isDirectory()) {
          await visit(join(cur, file))
        }
      }
    }

    mtimes.push((await stat(path)).mtimeMs)
    await visit(path)
    hash.update(new Uint32Array(mtimes))

    return [hash.digest('hex'), 'directory'] as [string, string]
  }
  const fileType = await import('file-type')
  if (size > THREASHOLD) {
    const hash = createHash('sha1').setEncoding('hex')
    const readable = await fileType.stream(createReadStream(path))
    await pipeline(readable, hash)
    return [hash.read() as string, readable.fileType?.ext ?? ''] as [string, string]
  }
  const buf = await readFile(path)
  const hash = createHash('sha1').update(buf).digest('hex')
  return [hash, (await fileType.fromBuffer(buf))?.ext ?? ''] as [string, string]
}
