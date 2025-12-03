import { createReadStream, existsSync } from 'fs'
import { basename, join, resolve } from 'path'
import { LauncherAppPlugin } from '~/app'

/**
 * The plugin to handle
 *
 * 1. `data:` base64 image
 * 2. common `media:` with absolute file path
 */
export const pluginMediaProtocol: LauncherAppPlugin = (app) => {
  const normalizePath = (path: string) => {
    if (app.platform.os === 'windows') {
      return decodeURIComponent(path.startsWith('/') ? path.substring(1) : path)
    }
    return decodeURIComponent(path.startsWith('//') ? path.substring(1) : path)
  }

  app.protocol.registerHandler('http', async ({ request, response }) => {
    if (request.url.host === 'launcher' && request.url.pathname.startsWith('/media')) {
      // Absolute image path
      const pathname = normalizePath(request.url.searchParams.get('path')!)
      const { fromFile } = await import('file-type')
      await fromFile(pathname).then((type) => {
        if (type && (type.mime.startsWith('image/') || type.mime.startsWith('video/') || type.mime.startsWith('audio/'))) {
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
    // http://launcher/theme-media/${assetName}
    if (request.url.host === 'launcher' && request.url.pathname.startsWith('/theme-media')) {
      const pathname = join(app.appDataPath, 'themes', normalizePath(request.url.pathname.substring('/theme-media'.length)))
      const { fromFile } = await import('file-type')
      await fromFile(pathname).then((type) => {
        if (type && (type.mime.startsWith('image/') || type.mime.startsWith('video/') || type.mime.startsWith('audio/') || type.mime.startsWith('font/'))) {
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
    // http://launcher/instance-theme-media/${instancePath}/${assetName}
    if (request.url.host === 'launcher' && request.url.pathname.startsWith('/instance-theme-media')) {
      const instancePath = request.url.searchParams.get('instancePath')
      if (instancePath) {
        const rawFileName = normalizePath(request.url.pathname.substring('/instance-theme-media'.length))
        // Prevent path traversal by using only the basename
        const fileName = basename(rawFileName)
        if (!fileName || fileName === '.' || fileName === '..') {
          response.status = 400
          return
        }
        const themeFolder = resolve(instancePath, 'theme')
        const pathname = resolve(themeFolder, fileName)
        // Validate the resolved path is under the theme folder
        if (!pathname.startsWith(themeFolder)) {
          response.status = 403
          return
        }
        if (!existsSync(pathname)) {
          response.status = 404
          return
        }
        const { fromFile } = await import('file-type')
        await fromFile(pathname).then((type) => {
          if (type && (type.mime.startsWith('image/') || type.mime.startsWith('video/') || type.mime.startsWith('audio/') || type.mime.startsWith('font/'))) {
            response.status = 200
            response.headers = { 'content-type': type.mime }
            response.body = createReadStream(pathname)
          } else {
            response.status = 404
          }
        }).catch(() => {
          response.status = 404
        })
      } else {
        response.status = 400
      }
    }
  })
  app.protocol.registerHandler('data', ({ request, response }) => {
    // Data uri
    if (request.url.pathname.startsWith('image/png;base64,')) {
      response.status = 200
      response.body = Buffer.from(request.url.pathname.substring('image/png;base64,'.length), 'base64')
    }
  })
}
