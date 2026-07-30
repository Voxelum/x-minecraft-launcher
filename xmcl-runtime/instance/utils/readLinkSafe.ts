import { isSystemError } from '@xmcl/utils'
import { readlink } from 'fs-extra'
import { resolve } from 'path'
import { ENOENT_ERROR } from '../../util/fs'

export function readlinkSafe(path: string) {
  return readlink(path).catch(e => {
    if (isSystemError(e) && (e.code === ENOENT_ERROR || e.code === 'EINVAL' || e.code === 'EISDIR')) {
      return undefined
    }
    if (!e.stack) {
      e.stack = new Error().stack
    }
    throw e
  })
}

/**
 * Normalize a link target for comparison.
 *
 * On Windows a junction (created by `linkDirectory` when symlink is denied)
 * reports its target through `readlink` with a `\\?\` prefix and/or a trailing
 * separator, so a raw string compare against the intended target never matches.
 */
export function normalizeLinkTarget(target: string) {
  return resolve(target.replace(/^\\\\\?\\/, ''))
}

/**
 * Whether `linkPath` is a symlink/junction whose target resolves to `target`.
 */
export async function isLinkTo(linkPath: string, target: string) {
  const actual = await readlinkSafe(linkPath).catch(() => '')
  if (!actual) return false
  return normalizeLinkTarget(actual) === normalizeLinkTarget(target)
}
