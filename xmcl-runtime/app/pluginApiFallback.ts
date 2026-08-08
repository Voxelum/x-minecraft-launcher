import { kFlights } from '~/infra'
import { kXmclSessionAuthorization, XmclAccountService } from '~/xmclAccount/XmclAccountService'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'
import { resolveXmclApiEndpoints } from './xmclApiBaseUrl'

export const pluginApiFallback: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request }) => {
    const flights = await app.registry.get(kFlights).catch((): Record<string, any> => ({}))
    const signalingOrigin = resolveXmclApiEndpoints(flights.xmclApiBaseUrl).signaling
    const isAuthenticatedSignalingPath =
      request.url.pathname === '/v1/rtc/official' ||
      request.url.pathname.startsWith('/v1/multiplayer/')
    if (request.url.origin === signalingOrigin && isAuthenticatedSignalingPath) {
      const accessToken = await app.registry
        .get(XmclAccountService)
        .then((service) => service[kXmclSessionAuthorization]())
        .then((authorization) => authorization?.accessToken)
        .catch(() => undefined)
      if (accessToken) {
        request.headers.Authorization = `Bearer ${accessToken}`
      }
    } else if (request.url.host === 'api.curseforge.com') {
      request.headers['x-api-key'] = process.env.CURSEFORGE_API_KEY || ''
    }
  }
  app.protocol.registerHandler('https', handler)
}
