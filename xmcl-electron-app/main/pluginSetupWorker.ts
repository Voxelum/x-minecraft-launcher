import { createLazyWorker } from '@xmcl/runtime/worker'
import Drive from 'node-disk-info/dist/classes/drive'
import { LauncherAppPlugin } from '~/app'
import { SetupWorker, kSetupWorker } from './setupWorker'
import createSetupWorker from './setupWorkerEntry?worker'

export const pluginSetupWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('SetupWorker')
  const worker: SetupWorker = createLazyWorker(createSetupWorker, ['getDiskInfo'], logger)
  logger.log('Setup worker created')
  app.registry.register(kSetupWorker, {
    getDiskInfo: async () => {
      const infos = await worker.getDiskInfo()
      for (const i of infos) {
        Object.setPrototypeOf(i, Drive.prototype)
      }
      return infos
    },
  })
}
