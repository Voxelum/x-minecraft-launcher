import { CurseforgeV1Client } from '@xmcl/curseforge'
import { Client } from 'undici'
import { LauncherAppPlugin } from '~/app'
import { kNetworkInterface } from '~/network'

export const pluginCurseforgeClient: LauncherAppPlugin = async (app) => {
  const networkInterface = await app.registry.get(kNetworkInterface)
  const dispatcher = networkInterface.registerAPIFactoryInterceptor((origin, options) => {
    if (origin.host === 'api.curseforge.com') {
      return new Client(origin, {
        ...options,
        pipelining: 6,
        bodyTimeout: 7000,
        headersTimeout: 7000,
      })
    }
  })
  const client = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY || '', { dispatcher })
  app.registry.register(CurseforgeV1Client, client)
}
