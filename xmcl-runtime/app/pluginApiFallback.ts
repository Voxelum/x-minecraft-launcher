import { kFlights } from '~/infra'
import { kXmclSessionAuthorization, XmclAccountService } from '~/xmclAccount/XmclAccountService'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'
import { resolveXmclApiEndpoints } from './xmclApiBaseUrl'

function setHeader(headers: Record<string, any>, name: string, value?: string) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) delete headers[key]
  }
  if (value) headers[name] = value
}

export const pluginApiFallback: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request }) => {
    const flights = await app.registry.get(kFlights).catch((): Record<string, any> => ({}))
    const signalingOrigin = resolveXmclApiEndpoints(flights.xmclApiBaseUrl).signaling
    const isAuthenticatedSignalingPath =
      request.url.pathname === '/v1/rtc/official' ||
      request.url.pathname.startsWith('/v1/multiplayer/')
    if (request.url.origin === signalingOrigin && isAuthenticatedSignalingPath) {
      setHeader(request.headers, 'Authorization')
      setHeader(request.headers, 'DPoP')
      const authorization = await app.registry
        .get(XmclAccountService)
        .then((service) =>
          service[kXmclSessionAuthorization]({
            method: request.method,
            url: request.url,
          }),
        )
        .catch(() => undefined)
      if (authorization) {
        const tokenType = authorization.tokenType === 'DPoP' ? 'DPoP' : 'Bearer'
        setHeader(
          request.headers,
          'Authorization',
          `${tokenType} ${authorization.accessToken}`,
        )
        setHeader(request.headers, 'DPoP', authorization.dpopProof)
      }
    } else if (request.url.host === 'api.curseforge.com') {
      request.headers['x-api-key'] = process.env.CURSEFORGE_API_KEY || ''
    }
  }
  app.protocol.registerHandler('https', handler)
}
