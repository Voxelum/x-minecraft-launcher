// import { xxhashFileFromBuf, xxhashFileFromStream } from '../util/hash'

import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { readFile } from 'fs/promises'
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
export async function hashAndFiletypeResource(path: string, size: number) {
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
