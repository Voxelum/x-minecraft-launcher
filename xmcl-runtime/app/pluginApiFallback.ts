import { UserService } from '~/user'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'

export const pluginApiFallback: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request, response }) => {
    if (request.url.host === 'api.xmcl.app') {
      const shouldDecorateHeaders = request.url.pathname === '/translation' || request.url.pathname === '/rtc/official'
      // const gfw = await app.registry.get(kGFW)
      // if (gfw.inside && shouldDecorateHeaders) {
      //   request.url.host = 'api-xmcl.0xc.cn'
      // }

      if (shouldDecorateHeaders) {
        const accessToken = await app.registry.get(UserService)
          .then(u => u.getOfficialUserProfile())
          .then((p) => p?.accessToken)
          .catch(() => undefined)
        if (accessToken) {
          request.headers['Authorization'] = `Bearer ${accessToken}`
        }
        if (request.url.pathname.startsWith('/translation')) {
          request.headers['x-api-key'] = process.env.CURSEFORGE_API_KEY || ''
        }
      }
    } else if (request.url.host === 'api.curseforge.com') {
      request.headers['x-api-key'] = process.env.CURSEFORGE_API_KEY || ''
    }
  }
  app.protocol.registerHandler('https', handler)
}
