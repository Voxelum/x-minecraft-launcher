import { kXmclSessionAuthorization, XmclAccountService } from '~/xmclAccount/XmclAccountService'
import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'

export const pluginApiFallback: LauncherAppPlugin = (app) => {
  const handler: Handler = async ({ request }) => {
    const isSignalingApi = request.url.host === 'signaling.xmcl.app'
    if (isSignalingApi && request.url.pathname === '/v1/rtc/official') {
      const accessToken = await app.registry.get(XmclAccountService)
        .then((service) => service[kXmclSessionAuthorization]())
        .then((authorization) => authorization?.accessToken)
        .catch(() => undefined)
      if (accessToken) {
        request.headers['Authorization'] = `Bearer ${accessToken}`
      }
    } else if (request.url.host === 'api.curseforge.com') {
      request.headers['x-api-key'] = process.env.CURSEFORGE_API_KEY || ''
    }
  }
  app.protocol.registerHandler('https', handler)
}
