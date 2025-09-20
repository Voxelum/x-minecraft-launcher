import { isSystemError } from '@xmcl/utils'
import { readlink } from 'fs-extra'
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
