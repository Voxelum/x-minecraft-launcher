import { createReadStream } from 'fs'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { missing } from '../util/fs'
import { ImageStorage } from './imageStore'

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
          response.body = createReadStream(image)
        }
      }
    }
  })
}
