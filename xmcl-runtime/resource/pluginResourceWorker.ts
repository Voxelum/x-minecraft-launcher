import { LauncherAppPlugin } from '~/app'
import { createLazyWorker } from '../worker'
import createResourceWorker from './resourceWorkerEntry?worker'
import { ResourceWorker, kResourceWorker } from './worker'

export const pluginResourceWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('ResourceWorker')

  const resourceWorker: ResourceWorker = createLazyWorker(createResourceWorker, ['checksum', 'copyPassively', 'hash', 'hashAndFileType', 'parse'], logger)
  app.registry.register(kResourceWorker, resourceWorker)
}
