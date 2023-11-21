import { LauncherAppPlugin } from '../lib/app/LauncherApp'
import { checkUpdate, createLazyWorker } from '../worker'
import { EncodingWorker, kEncodingWorker } from './encodingWorker'
import createEncodingWorker, { path as encodingWorkerPath } from './encodingWorkerEntry?worker'

export const pluginWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('EncodingWorker')

  const encodingWorker: EncodingWorker = createLazyWorker(createEncodingWorker, ['decode', 'guessEncodingByBuffer'], logger)
  app.registry.register(kEncodingWorker, encodingWorker)

  app.waitEngineReady().then(() => {
    checkUpdate(encodingWorkerPath, logger)
  })
}
