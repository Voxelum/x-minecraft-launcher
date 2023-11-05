import { request } from 'undici'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { kFlights } from '../entities/flights'
import { kClientToken } from '../entities/clientToken'

export const pluginFlights: LauncherAppPlugin = async (app) => {
  try {
    const clientSession = await app.registry.get(kClientToken)
    const resp = await request(`https://api.xmcl.app/flights?version=${app.version}&locale=${app.host.getLocale()}&clientToken=${clientSession}`, {
    })
    if (resp.statusCode !== 200) {
      throw new Error()
    }
    const result = await resp.body.json()
    const filtered = {} as Record<string, string>
    for (const [k, v] of Object.entries(result)) {
      if (typeof v === 'string') {
        filtered[k] = v
      }
    }
    app.registry.register(kFlights, filtered)
  } catch {
    app.registry.register(kFlights, {})
  }
}
