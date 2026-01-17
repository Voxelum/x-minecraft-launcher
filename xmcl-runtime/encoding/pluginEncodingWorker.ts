import { LauncherAppPlugin } from '~/app'
import { createLazyWorker } from '@xmcl/worker'
import { EncodingWorker, kEncodingWorker } from './encodingWorker'
import createEncodingWorker from './encodingWorkerEntry?worker'
import { Exception } from '@xmcl/runtime-api'

export const pluginEncodingWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('EncodingWorker')

  const [encodingWorker, dispose] = createLazyWorker<EncodingWorker>(
    createEncodingWorker,
    { methods: ['decode', 'guessEncodingByBuffer'] },
    logger,
    Exception,
  )
  app.registry.register(kEncodingWorker, encodingWorker)
  app.registryDisposer(dispose)
}
