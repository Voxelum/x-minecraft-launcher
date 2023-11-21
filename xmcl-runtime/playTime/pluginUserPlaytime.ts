import { LauncherAppPlugin } from '~/app'
import { InstanceService } from '~/instance'
import { LaunchService } from '~/launch'
import { LaunchService as ILaunchService } from '@xmcl/runtime-api'

export const pluginUserPlaytime: LauncherAppPlugin = async (app) => {
  const launchService: ILaunchService = await app.registry.get(LaunchService)
  const instanceService = await app.registry.get(InstanceService)

  launchService.on('minecraft-start', (options) => {
    instanceService.editInstance({
      instancePath: options.gameDirectory,
      lastPlayedDate: Date.now(),
    })
  })

  launchService.on('minecraft-exit', (options) => {
    if (options.gameDirectory) {
      const instance = instanceService.state.all[options.gameDirectory]
      if (instance) {
        instanceService.editInstance({
          instancePath: options.gameDirectory,
          playtime: instance.playtime + options.duration,
        })
      }
    }
  })
}
