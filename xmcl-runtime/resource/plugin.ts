import { LauncherAppPlugin } from '../lib/app/LauncherApp'
import { checkUpdate, createLazyWorker } from '../worker'
import createResourceWorker, { path as resourceWorkerPath } from './resourceWorkerEntry?worker'
import { ResourceWorker, kResourceWorker } from './worker'

export const pluginWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('ResourceWorker')

  const resourceWorker: ResourceWorker = createLazyWorker(createResourceWorker, ['checksum', 'copyPassively', 'hash', 'hashAndFileType', 'parse'], logger)
  app.registry.register(kResourceWorker, resourceWorker)

  app.waitEngineReady().then(() => {
    checkUpdate(resourceWorkerPath, logger)
  })
}
