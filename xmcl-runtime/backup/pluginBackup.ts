import { LauncherAppPlugin } from '~/app'
import { BackupService } from './BackupService'

export const pluginBackup: LauncherAppPlugin = async (app) => {
  app.registry.getOrCreate(BackupService).then(async (service) => {
    await service.initialize()
  }).catch((e) => {
    app.getLogger('BackupService').warn(`Failed to initialize BackupService: ${e}`)
  })
}
