import { createReadStream } from 'fs'
import { LauncherAppPlugin } from '@xmcl/runtime/app'
import logoDark from '../icons/dark@256x256.png'
import logoLight from '../icons/light@256x256.png'

const builtin: Record<string, string> = {
  logoLight,
  logoDark,
}

/**
 * The plugin to handle builtin icons
 */
export const pluginIconProtocol: LauncherAppPlugin = (app) => {
  app.protocol.registerHandler('http', async ({ request, response }) => {
    if (request.url.host === 'launcher' && request.url.pathname.startsWith('/icons')) {
      // Builtin image
      const name = request.url.pathname.substring('/icons/'.length)
      const path = builtin[name]
      if (path) {
        response.status = 200
        response.headers['content-type'] = path.endsWith('png')
          ? 'image/png'
          : path.endsWith('.gif')
            ? 'image/gif'
            : path.endsWith('.webp')
              ? 'image/webp'
              : path.endsWith('svg')
                ? 'image/svg+xml'
                : ''
        response.body = createReadStream(path)
      }
    }
  })
}
