import { createReadStream, existsSync } from 'fs'
import { join } from 'path'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { ImageStorage } from '../util/imageStore'

export const pluginImageStorage: LauncherAppPlugin = (app) => {
  const root = join(app.appDataPath, 'resource-images')
  app.registry.register(ImageStorage, new ImageStorage(root))
  app.protocol.registerHandler('image', ({ request, response }) => {
    if (request.url.host.length === 40) {
      const image = join(root, request.url.host)
      if (existsSync(image)) {
        response.status = 200
        response.body = createReadStream(join(root, request.url.host))
      } else {
        response.status = 404
      }
    }
  })
}
