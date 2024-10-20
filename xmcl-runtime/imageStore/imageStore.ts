import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { ensureFile, writeFile } from 'fs-extra'
import { join } from 'path'
import { checksum, linkOrCopyFile } from '~/util/fs'

export class ImageStorage {
  constructor(readonly root: string) {
  }

  async addImage(pathOrData: string | Uint8Array) {
    if (typeof pathOrData === 'string' && pathOrData.startsWith('image://')) {
      pathOrData = pathOrData.substring('image://'.length)
    }
    const sha1 = typeof pathOrData === 'string' ? await checksum(pathOrData, 'sha1') : createHash('sha1').update(pathOrData).digest('hex')
    const imagePath = join(this.root, sha1)
    if (!existsSync(imagePath)) {
      if (typeof pathOrData === 'string') {
        await linkOrCopyFile(pathOrData, imagePath)
      } else {
        await writeFile(imagePath, pathOrData)
      }
    }
    return `http://launcher/image/${sha1}`
  }
}
