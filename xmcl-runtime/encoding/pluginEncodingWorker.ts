import { LauncherAppPlugin } from '~/app'
import { createLazyWorker } from '../worker'
import { EncodingWorker, kEncodingWorker } from './encodingWorker'
import createEncodingWorker from './encodingWorkerEntry?worker'

export const pluginEncodingWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('EncodingWorker')

  const encodingWorker: EncodingWorker = createLazyWorker(createEncodingWorker, { methods: ['decode', 'guessEncodingByBuffer'] }, logger)
  app.registry.register(kEncodingWorker, encodingWorker)
}
