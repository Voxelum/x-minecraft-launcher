import { getInstanceFileChecksum, type InstanceFile, type InstanceFileChecksum } from '@xmcl/instance'
import { Crc32 } from '@aws-crypto/crc32'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'

export function assertInstanceFileChecksum(expected: InstanceFileChecksum, destination: string, actual: string) {
  if (actual !== expected.value) {
    throw Object.assign(new Error(`Checksum mismatch for ${destination}: expected ${expected.algorithm}=${expected.value}, got ${actual}`), {
      name: 'ChecksumNotMatchError',
      file: destination,
      expect: expected.value,
      actual,
      algorithm: expected.algorithm,
    })
  }
}

export async function verifyInstanceFile(file: InstanceFile, destination: string) {
  const expected = getInstanceFileChecksum(file)
  if (!expected) return
  if (expected.algorithm === 'crc32') {
    const checksum = new Crc32()
    for await (const chunk of createReadStream(destination)) checksum.update(chunk)
    assertInstanceFileChecksum(expected, destination, String(checksum.digest()))
  } else {
    const hash = createHash(expected.algorithm)
    await pipeline(createReadStream(destination), hash)
    assertInstanceFileChecksum(expected, destination, hash.digest('hex'))
  }
}
