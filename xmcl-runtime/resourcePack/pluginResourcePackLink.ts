import { ResourceDomain } from '@xmcl/runtime-api'
import { ensureDir, readdir } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin, kGameDataPath } from '~/app'
import { InstanceOptionsService } from '~/instance'
import { LaunchService } from '~/launch'
import { linkWithTimeoutOrCopy, missing } from '../util/fs'
import { InstanceResourcePackService } from './InstanceResourcePacksService'

export const pluginResourcePackLink: LauncherAppPlugin = async (app) => {
  const launchService = await app.registry.get(LaunchService)
  const resourcePackService = await app.registry.get(InstanceResourcePackService)
  const options = await app.registry.get(InstanceOptionsService)
  const getPath = await app.registry.get(kGameDataPath)

  launchService.registerMiddleware({
    name: 'resources-link',
    async onBeforeLaunch(input, output) {
      const path = output.gamePath
      const linked = await resourcePackService.link(path)
      if (linked) return

      const folder = join(path, ResourceDomain.ResourcePacks)
      await ensureDir(folder)
      const files = await readdir(folder).catch(() => [] as string[])

      // if not linked, we need to link the resource pack to the instance
      const promises: Promise<any>[] = []
      const gameOptions = await options.getGameOptions(path)
      const packs = gameOptions.resourcePacks || []
      for (let fileName of packs) {
        if (fileName === 'vanilla') {
          continue
        }
        if (fileName.indexOf('/') !== -1) {
          if (fileName.startsWith('file/')) {
            fileName = fileName.slice(5)
          } else {
            // Skip for external resource pack. This might be a mod
            continue
          }
        }
        if (fileName.indexOf(':') !== -1) {
          // Skip for external resource pack. This might be a mod
          continue
        }
        if (files.includes(fileName)) {
          // Skip for existed file
          continue
        }
        const src = getPath(ResourceDomain.ResourcePacks, fileName)
        const dest = join(path, ResourceDomain.ResourcePacks, fileName)
        if (await missing(dest) && !(await missing(src))) {
          promises.push(linkWithTimeoutOrCopy(src, dest).catch((e) => {
            if (e.name === 'Error') {
              Object.assign(e, { name: 'LinkResourcePackError' })
            }
            resourcePackService.error(e)
          }))
        }
      }
      await Promise.all(promises)
    },
  })
}
