import { createLazyWorker } from '@xmcl/worker'
import { Exception } from '@xmcl/runtime-api'
import { LauncherAppPlugin } from '~/app'
import { SaveWorker, kSaveWorker } from './saveWorker'
import createSaveWorker from './saveWorkerEntry?worker'

export const pluginSaveWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('SaveWorker')

  const [saveWorker, dispose] = createLazyWorker<SaveWorker>(
    createSaveWorker,
    { methods: ['renderSaveRegion'] },
    logger,
    Exception,
    { name: 'SaveWorker' },
  )
  app.registry.register(kSaveWorker, saveWorker)
  app.registryDisposer(dispose)
}
