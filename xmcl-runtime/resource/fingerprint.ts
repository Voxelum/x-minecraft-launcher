import { readFile } from 'fs-extra'
import { v2 } from 'murmurhash'

function isWhitespaceCharacter(b: number): boolean {
  return b === 9 || b === 10 || b === 13 || b === 32
}
function normalizeBuffer(buf: Buffer): Buffer {
  const newArray = []
  for (const b of buf) {
    if (!isWhitespaceCharacter(b)) {
      newArray.push(b)
    }
  }
  return Buffer.from(newArray)
}

export async function fingerprint(filePath: string) {
  const buf = await readFile(filePath)
  const normalized = normalizeBuffer(buf)
  return v2(normalized, 1)
}
