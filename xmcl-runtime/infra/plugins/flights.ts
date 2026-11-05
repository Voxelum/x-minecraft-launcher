import { VARDRYNN_API_ORIGIN_FLIGHT } from '@xmcl/runtime-api'
import { LauncherAppPlugin } from '~/app'
import { resolveVardrynnApiOrigin } from '~/app/vardrynnApiOrigin'
import { kFlights } from '../flights'

// No remote flags or persisted XMCL flags are trusted in Vardrynn.
const BUILTIN_FLIGHTS: Record<string, string | boolean> = {}

export const pluginFlights: LauncherAppPlugin = (app) => {
  const flights = { ...BUILTIN_FLIGHTS }
  const origin = resolveVardrynnApiOrigin(process.env.VARDRYNN_API_BASE_URL, {
    allowLoopback: process.env.NODE_ENV !== 'production',
    onInvalid: () =>
      app.getLogger('VardrynnApi').warn('Ignoring invalid VARDRYNN_API_BASE_URL; services stay off.'),
  })
  if (origin) flights[VARDRYNN_API_ORIGIN_FLIGHT] = origin
  app.protocol.registerHandler('http', ({ request, response }) => {
    if (request.url.host === 'launcher' && request.url.pathname === '/flights') {
      response.status = 200
      response.headers = { 'content-type': 'application/javascript' }
      response.body = `window.flights = ${JSON.stringify(flights)}`
      response.handled = true
    }
  })
  app.registry.register(kFlights, flights)
}
