import { LauncherAppPlugin } from '~/app'
import { kFlights } from '../flights'

// No remote flags or persisted XMCL flags are trusted in Vardrynn.
const BUILTIN_FLIGHTS: Record<string, string | boolean> = {}

export const pluginFlights: LauncherAppPlugin = (app) => {
  const flights = { ...BUILTIN_FLIGHTS }
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
