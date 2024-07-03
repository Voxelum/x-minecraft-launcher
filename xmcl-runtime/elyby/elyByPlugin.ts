import { LauncherAppPlugin } from '~/app'
import { LaunchService } from '~/launch'
import { ElyByService } from './ElyByService'

export const elyByPlugin: LauncherAppPlugin = (app) => {
  app.registry.get(LaunchService).then(serv => {
    serv.registerMiddleware({
      name: 'elyby',
      onBeforeLaunch: async (input, payload, output) => {
        if (payload.side === 'server') return
        const user = input.user
        if (user.authority.indexOf('authserver.ely.by') !== -1 && !input.disableElyByAuthlib) {
          const ver = payload.version
          const libIndex = ver.libraries.findIndex(lib => lib.groupId === 'com.mojang' && lib.artifactId === 'authlib')

          if (libIndex !== -1) {
            const mcVersion = ver.minecraftVersion
            const serv = await app.registry.getOrCreate(ElyByService)
            const lib = await serv.installAuthlib(mcVersion)
            if (lib) {
              ver.libraries[libIndex] = lib
            }
          }
        }
      },
    })
  })
}
