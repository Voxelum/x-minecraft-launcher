import { kGFW } from '~/infra'
import { UserService } from '~/user'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'

// Routes that the Azure Functions backup (xmcl-core-api, EastAsia) serves
// at parity with the Deno Deploy primary. Used to geo-route inside-GFW
// users to the closer-and-more-reachable Azure edge for these endpoints,
// while keeping WebSocket / RTC / translation / news on Deno where they
// either don't exist on Azure yet or wouldn't fit the Y1 Consumption
// pricing (long-lived connections).
const AZURE_BACKUP_HOST = 'xmcl-core-api.azurewebsites.net'
const AZURE_BACKUP_ROUTES = new Set([
  '/latest',
  '/flights',
  '/notifications',
  '/appx',
  '/appinstaller',
])

export const pluginApiFallback: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request, response }) => {
    if (request.url.host === 'api.xmcl.app') {
      const shouldDecorateHeaders = request.url.pathname === '/translation' || request.url.pathname === '/rtc/official'

      // Inside GFW, swap the closest reachable host for the routes the
      // Azure backup serves. Azure Functions are at /api/<name> by
      // convention, so prepend /api to the pathname.
      if (AZURE_BACKUP_ROUTES.has(request.url.pathname)) {
        const gfw = await app.registry.get(kGFW)
        if (gfw.inside) {
          request.url.host = AZURE_BACKUP_HOST
          request.url.pathname = '/api' + request.url.pathname
        }
      }

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
