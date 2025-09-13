import { createHash } from 'crypto'
import { fromBuffer } from 'file-type'
import { createReadStream, existsSync } from 'fs'
import { ensureDir, readFile, writeFile } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { checksum, linkOrCopyFile } from '~/util/fs'
import { missing } from '../util/fs'

export class ImageStorage {
  init: Promise<void>

  constructor(readonly root: string) {
    this.init = ensureDir(root)
  }

  async addImage(pathOrData: string | Uint8Array) {
    await this.init
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

export const pluginImageStorage: LauncherAppPlugin = (app) => {
  const root = join(app.appDataPath, 'resource-images')
  app.registry.register(ImageStorage, new ImageStorage(root))
  app.protocol.registerHandler('http', async ({ request, response }) => {
    if (request.url.host === 'launcher' && request.url.pathname.startsWith('/image')) {
      // Get the last part of the image
      const sha1 = request.url.pathname.substring('/image/'.length)
      if (sha1.length === 40) {
        const image = join(root, sha1)
        if (await missing(image)) {
          response.status = 404
        } else {
          response.status = 200
          const buf = await readFile(image)
          const fileType = await fromBuffer(buf)
          response.body = createReadStream(image)
          if (fileType?.mime) {
            if (fileType.ext === 'xml') {
              // svg
              response.headers['Content-Type'] = 'image/svg+xml'
            } else {
              response.headers['Content-Type'] = fileType.mime
            }
          }
        }
      }
    }
  })
}
