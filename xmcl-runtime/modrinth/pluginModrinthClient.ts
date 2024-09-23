import { ModrinthV2Client } from '@xmcl/modrinth'
import { LauncherAppPlugin } from '~/app'

export const pluinModrinthClient: LauncherAppPlugin = async (app) => {
  app.registry.register(ModrinthV2Client, new ModrinthV2Client({
    fetch: (...args) => app.fetch(...args),
  }))
}
