import { createReadStream } from 'fs'
import { LauncherAppPlugin } from '../app/LauncherApp'

import craftingTable from '../../assets/craftingtable.png'
import minecraft from '../../assets/minecraft.png'
import quilt from '../../assets/quilt.svg'
import optifine from '../../assets/optifine.gif'
import forge from '../../assets/forge.png'
import fabric from '../../assets/fabric.png'

const builtin: Record<string, string> = {
  craftingTable,
  minecraft,
  quilt,
  optifine,
  forge,
  fabric,
}

/**
 * The plugin to handle
 *
 * 1. builtin image
 * 2. `data:` base64 image
 * 3. common `image:` with absolute file path
 */
export const pluginCommonProtocol: LauncherAppPlugin = (app) => {
  app.protocol.registerHandler('image', async ({ request, response }) => {
    if (request.url.host === 'builtin') {
      // Builtin image
      const name = request.url.pathname.substring(1)
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
    } else if (!request.url.host) {
      // Absolute image path
      const pathname = decodeURIComponent(request.url.pathname.substring(1))
      const { fromFile } = await import('file-type')
      await fromFile(pathname).then((type) => {
        if (type && type.mime.startsWith('image/')) {
          response.status = 200
          response.headers = { 'content-type': type.mime }
          response.body = createReadStream(pathname)
        } else {
          response.status = 404
        }
      }).catch(() => {
        response.status = 404
      })
    }
  })
  app.protocol.registerHandler('video', async ({ request, response }) => {
    // Absolute video path
    const pathname = decodeURIComponent(request.url.pathname.substring(1))
    const { fromFile } = await import('file-type')
    await fromFile(pathname).then((type) => {
      if (type && type.mime.startsWith('video/')) {
        response.status = 200
        response.body = createReadStream(pathname)
      } else {
        response.status = 404
      }
    }).catch((e) => {
      response.status = 404
    })
  })
  app.protocol.registerHandler('data', ({ request, response }) => {
    // Data uri
    if (request.url.pathname.startsWith('image/png;base64,')) {
      response.status = 200
      response.body = Buffer.from(request.url.pathname.substring('image/png;base64,'.length), 'base64')
    }
  })
}
