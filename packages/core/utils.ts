/**
 * @ignore
 */

import { createHash } from 'crypto'
import { constants, createReadStream } from 'fs'
import { access } from 'fs/promises'
import { pipeline } from 'stream/promises'

/** @internal */
export function exists(file: string) {
  return access(file, constants.F_OK).then(
    () => true,
    () => false,
  )
}
/**
 * Validate the sha1 value of the file
 * @internal
 */
export async function validateSha1(target: string, hash?: string, strict = false) {
  if (
    await access(target).then(
      () => false,
      () => true,
    )
  ) {
    return false
  }
  if (!hash) {
    return !strict
  }
  const sha1 = await checksum(target, 'sha1')
  return sha1 === hash
}
/**
 * Return the sha1 of a file
 * @internal
 */
export async function checksum(target: string, algorithm: string) {
  const hash = createHash(algorithm).setEncoding('hex')
  try {
    await pipeline(createReadStream(target), hash)
  } catch (e) {
    if ((e as any).code === 'ENOENT') {
      return undefined
    }
  }
  return hash.read()
}
/**
 * @internal
 */
export function isNotNull<T>(v: T | undefined): v is T {
  return v !== undefined
}
