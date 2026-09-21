import { BaseService, type LauncherApp, type LauncherAppPlugin } from '@xmcl/runtime/app'
import { kSettings } from '@xmcl/runtime/settings'
import { download, getDownloadBaseOptions } from '@xmcl/file-transfer'
import { onDownloadSingle } from '@xmcl/installer'
import { app, session, windowsExecutable } from 'deskgap'
import { join } from 'node:path'
import { DeskGapUpdater, LocalDevelopmentUpdater } from './updater'

export function createDeskGapUpdater(launcher: LauncherApp) {
  if (process.env.NODE_ENV !== 'production') return new LocalDevelopmentUpdater(launcher.version)
  const network = session.fromName('xmcl-network')
  return new DeskGapUpdater({
    version: launcher.version,
    repository: 'Voxelum/x-minecraft-launcher',
    directory: join(app.getPath('localData'), 'xmcl-deskgap', 'updates'),
    fetch: (input, init) => network.fetch(input instanceof Request ? input.url : input, init),
    executable: windowsExecutable,
    download: (url, destination, options) => download({
      ...getDownloadBaseOptions(),
      url, destination, signal: options?.abortSignal,
      tracker: onDownloadSingle(options?.tracker, 'download-update.full', { url }),
    }),
    getSettings: () => launcher.registry.get(kSettings),
    async restart(relaunch) {
      if (relaunch) launcher.relaunch()
      await launcher.quit()
    },
  })
}

export const pluginDeskGapUpdate: LauncherAppPlugin = async (launcher) => {
  if (!(launcher.updater instanceof DeskGapUpdater)) return
  const settings = await launcher.registry.get(kSettings)
  const logger = launcher.getLogger('DeskGapUpdater')
  const download = () => {
    if (!settings.autoDownload || settings.updateStatus !== 'pending' || launcher.disposed) return
    void launcher.registry.get(BaseService).then(service => service.downloadUpdate()).catch(error => {
      logger.warn('Automatic DeskGap update download failed; retry from Settings.')
      logger.warn(error)
    })
  }
  settings.subscribe('updateStatusSet', download).subscribe('autoDownloadSet', download)
  launcher.registryDisposer(() => {
    settings.unsubscribe('updateStatusSet', download).unsubscribe('autoDownloadSet', download)
  })
}
