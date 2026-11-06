import { kFlights } from '~/infra'
import { kXmclSessionAuthorization, XmclAccountService } from '~/xmclAccount/XmclAccountService'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler, Response as LauncherResponse } from './LauncherProtocolHandler'
import { getVardrynnApiOrigin, toCurseforgeProxyUrl } from './vardrynnApiOrigin'

function setHeader(headers: Record<string, any>, name: string, value?: string) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) delete headers[key]
  }
  if (value) headers[name] = value
}

function rejectAuthentication(
  response: LauncherResponse,
  code: string,
  status = 401,
) {
  response.status = status
  response.headers = { 'content-type': 'application/json' }
  response.body = JSON.stringify({ error: code, message: code })
  response.handled = true
}

export const pluginApiFallback: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request, response }) => {
    const flights = await app.registry.get(kFlights).catch((): Record<string, any> => ({}))
    const signalingOrigin = getVardrynnApiOrigin(flights)
    const isAuthenticatedSignalingPath =
      request.url.pathname === '/v1/rtc/official' ||
      request.url.pathname.startsWith('/v1/multiplayer/')
    if (request.url.origin === signalingOrigin && isAuthenticatedSignalingPath) {
      setHeader(request.headers, 'Authorization')
      setHeader(request.headers, 'DPoP')
      let authorization
      try {
        authorization = await app.registry.get(XmclAccountService).then((service) =>
          service[kXmclSessionAuthorization]({
            method: request.method,
            url: request.url,
          }),
        )
      } catch (error) {
        const code = error instanceof Error ? error.message : 'xmcl_account_authorization_failed'
        rejectAuthentication(
          response,
          code,
          code === 'xmcl_account_server_time_unavailable' ? 503 : 401,
        )
        return
      }
      if (!authorization) {
        rejectAuthentication(response, 'xmcl_account_session_missing')
        return
      }
      const tokenType = authorization.tokenType === 'DPoP' ? 'DPoP' : 'Bearer'
      setHeader(request.headers, 'Authorization', `${tokenType} ${authorization.accessToken}`)
      setHeader(request.headers, 'DPoP', authorization.dpopProof)
    } else if (request.url.host === 'api.curseforge.com') {
      // Renderer CurseForge calls go to the Vardrynn proxy, which adds the API key.
      if (!signalingOrigin) {
        rejectAuthentication(response, 'vardrynn_service_unconfigured', 503)
        return
      }
      setHeader(request.headers, 'x-api-key')
      request.url = toCurseforgeProxyUrl(signalingOrigin, request.url)
    }
  }
  app.protocol.registerHandler('https', handler)
}
