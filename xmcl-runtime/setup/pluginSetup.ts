import Drive from 'node-disk-info/dist/classes/drive'
import { join, parse } from 'path'
import { setTimeout } from 'timers/promises'
import { isValidPathName } from '~/util/validate'
import { LauncherAppPlugin } from '../app'
import { createLazyWorker } from '../worker'
import { SetupWorker } from './setupWorker'
import createSetupWorker from './setupWorkerEntry?worker'

export const pluginSetup: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('Setup')
  const [worker, dispose] = createLazyWorker<SetupWorker>(createSetupWorker, { methods: ['getDiskInfo'] }, logger)
  app.registryDisposer(dispose)
  logger.log('Setup worker created')

  const getDiskInfo = async () => {
    try {
      const infos = await worker.getDiskInfo()
      for (const i of infos) {
        Object.setPrototypeOf(i, Drive.prototype)
      }
      return infos
    } catch (e) {
      throw Object.assign(new Error(), e)
    }
  }

  app.controller.handle('preset', async () => {
    const defaultPath = join(app.host.getPath('home'), '.minecraftx')
    const getPath = (driveSymbol: string) => {
      const parsedHome = parse(defaultPath)
      if (isValidPathName(defaultPath) && parsedHome.root.toLocaleLowerCase().startsWith(driveSymbol.toLocaleLowerCase())) {
        return defaultPath
      }
      return join(driveSymbol, '.minecraftx')
    }
    const getAllDrived = async () => {
      try {
        const startTime = Date.now()
        const drives = await Promise.race([
          getDiskInfo(),
          setTimeout(4000).then(() => []),
        ])
        logger.log(`Get disk info in ${Date.now() - startTime}ms`)
        return drives.map((d) => ({
          filesystem: d.filesystem,
          blocks: d.blocks,
          used: d.used,
          available: d.available,
          capacity: d.capacity,
          mounted: d.mounted,
          selectedPath: getPath(d.mounted),
        }))
      } catch (e) {
        logger.warn('Failed to get drives')
        logger.error(e as any)
        return []
      }
    }
    const drives = await getAllDrived()
    return {
      locale: app.host.getLocale(),
      minecraftPath: app.minecraftDataPath,
      defaultPath,
      drives,
    }
  })
}
