import { ResourceDomain } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { kGameDataPath } from '../entities/gameDataPath'
import { InstanceOptionsService } from '../services/InstanceOptionsService'
import { InstanceResourcePackService } from '../services/InstanceResourcePacksService'
import { LaunchService } from '../services/LaunchService'
import { linkWithTimeoutOrCopy } from '../util/fs'

export const pluginResourcePackLink: LauncherAppPlugin = async (app) => {
  const launchService = await app.registry.get(LaunchService)
  const resourcePackService = await app.registry.get(InstanceResourcePackService)
  const options = await app.registry.get(InstanceOptionsService)
  const getPath = await app.registry.get(kGameDataPath)

  launchService.registerMiddleware({
    async onBeforeLaunch(input, output) {
      const path = output.gamePath
      const linked = await resourcePackService.link(path)
      if (linked) return

      const files = await readdir(join(path, ResourceDomain.ResourcePacks))

      // if not linked, we need to link the resource pack to the instance
      const promises: Promise<any>[] = []
      const gameOptions = await options.getGameOptions(path)
      const packs = gameOptions.resourcePacks || []
      for (let fileName of packs) {
        if (fileName === 'vanilla') {
          continue
        }
        fileName = fileName.startsWith('file/') ? fileName.slice(5) : fileName
        if (files.includes(fileName)) {
          // Skip for existed file
          continue
        }
        const src = getPath(ResourceDomain.ResourcePacks, fileName)
        const dest = join(path, ResourceDomain.ResourcePacks, fileName)
        if (!existsSync(dest)) {
          promises.push(linkWithTimeoutOrCopy(src, dest).catch((e) => resourcePackService.error(e)))
        }
      }
      await Promise.all(promises)
    },
  })
}
