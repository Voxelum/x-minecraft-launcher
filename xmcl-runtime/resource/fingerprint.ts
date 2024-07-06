import { readFile } from 'fs-extra'
import { v2 } from 'murmurhash'

function isWhitespaceCharacter(b: number): boolean {
  return b === 9 || b === 10 || b === 13 || b === 32
}
function normalizeBuffer(buf: Buffer): Buffer {
  let j = 0
  for (let i = 0; i < buf.length; ++i) {
    const b = buf[i]
    if (!isWhitespaceCharacter(b)) {
      buf[j] = b
      j++
    }
  }
  return buf.slice(0, j)
}

export async function fingerprint(filePath: string) {
  const buf = await readFile(filePath)
  const normalized = normalizeBuffer(buf)
  return v2(normalized, 1)
}
