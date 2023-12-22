import { checkUpdate, createLazyWorker } from '@xmcl/runtime/worker'
import { LauncherAppPlugin } from '~/app'
import { SetupWorker, kSetupWorker } from './setupWorker'
import createSetupWorker, { path as setupWorkerPath } from './setupWorkerEntry?worker'
import Drive from 'node-disk-info/dist/classes/drive'

export const pluginSetupWorker: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('SetupWorker')

  const worker: SetupWorker = createLazyWorker(createSetupWorker, ['getDiskInfo'], logger)
  app.registry.register(kSetupWorker, {
    getDiskInfo: async () => {
      const infos = await worker.getDiskInfo()
      for (const i of infos) {
        Object.setPrototypeOf(i, Drive.prototype)
      }
      return infos
    },
  })

  app.waitEngineReady().then(() => {
    checkUpdate(setupWorkerPath, logger)
  })
}
