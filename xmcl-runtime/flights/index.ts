import { readFile, writeFile } from 'fs-extra'
import { join } from 'path'
import { setTimeout } from 'timers/promises'
import { InjectionKey, LauncherAppPlugin } from '~/app'
import { kClientToken } from '~/clientToken'

export const kFlights: InjectionKey<Record<string, any>> = Symbol('Flights')

const BUILTIN_FLIGHTS = {
}

export const pluginFlights: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('Flights')
  const fetchFlights = async (output: Record<string, any>, cachedPath: string) => {
    try {
      const clientSession = await app.registry.get(kClientToken)
      const build = app.build
      const queryString = `version=${app.version}&build=${build}&locale=${app.host.getLocale()}&clientToken=${clientSession}`
      const resp = await app.fetch(`https://api.xmcl.app/flights?${queryString}`, {
      }).catch(() => app.fetch(`https://xmcl-core-api.azurewebsites.net/api/flights?${queryString}`))
      if (resp.status !== 200) {
        logger.error(new Error(`Failed to fetch flights: ${resp.status}`))
        return
      }
      const result = await resp.json()
      for (const [k, v] of Object.entries(result)) {
        output[k] = v
      }
      logger.log('Fetched flights', JSON.stringify(output))
      // Write to cache
      await writeFile(cachedPath, JSON.stringify(output))
    } catch (e) {
      const err = e as any
      if (err.code === 'ENOTFOUND' && err.syscall === 'getaddrinfo' && err.message === 'net::ERR_INTERNET_DISCONNECTED') {
        logger.warn('Failed to fetch flights: Network error. Please check your network connection.')
      } else {
        logger.error(e as Error)
      }
    }
  }
  const readCachedFlights = async (output: Record<string, any>, cachedPath: string) => {
    try {
      const cached = JSON.parse(await readFile(cachedPath, 'utf-8'))
      for (const [k, v] of Object.entries(cached)) {
        output[k] = v
      }
      return false
    } catch {
      return true
    }
  }
  const readFlights = async (output: Record<string, any>, cachedPath: string) => {
    if (await readCachedFlights(output, cachedPath)) {
      await Promise.race([fetchFlights(output, cachedPath), setTimeout(2000)])
    } else {
      fetchFlights(output, cachedPath).catch(() => { })
    }
  }
  try {
    const filtered = { ...BUILTIN_FLIGHTS } as Record<string, string>
    const cachedPath = join(app.appDataPath, 'flights.json')
    const promise = readFlights(filtered, cachedPath).then(() => {
      logger.log('Flights loaded', JSON.stringify(filtered))
    })

    app.protocol.registerHandler('http', async ({ request, response }) => {
      if (request.url.host === 'launcher' && request.url.pathname === '/flights') {
        await promise
        response.status = 200
        const jsContent = `window.flights = ${JSON.stringify(filtered)}`
        response.headers = {
          'content-type': 'application/javascript',
        }
        response.body = jsContent
      }
    })

    app.registry.register(kFlights, filtered)
  } catch {
    app.registry.register(kFlights, { ...BUILTIN_FLIGHTS })
  }
}
