import { fromBuffer } from 'file-type'
import { createReadStream } from 'fs'
import { readFile } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { missing } from '~/util/fs'
import { ImageStorage } from '../image_store'

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
