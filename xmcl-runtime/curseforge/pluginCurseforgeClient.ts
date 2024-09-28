import { CurseforgeV1Client } from '@xmcl/curseforge'
import { LauncherAppPlugin } from '~/app'

export const pluginCurseforgeClient: LauncherAppPlugin = async (app) => {
  const client = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY || '', { fetch: (...args) => app.fetch(...args) })
  app.registry.register(CurseforgeV1Client, client)
}
