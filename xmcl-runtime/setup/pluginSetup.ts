import Drive from 'node-disk-info/dist/classes/drive'
import { join, parse } from 'path'
import { setTimeout } from 'timers/promises'
import { LauncherAppPlugin } from '../app'
import { createLazyWorker } from '../worker'
import { SetupWorker } from './setupWorker'
import createSetupWorker from './setupWorkerEntry?worker'

export const pluginSetup: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('Setup')
  const worker: SetupWorker = createLazyWorker(createSetupWorker, { methods: ['getDiskInfo'] }, logger)
  logger.log('Setup worker created')

  const getDiskInfo = async () => {
    const infos = await worker.getDiskInfo()
    for (const i of infos) {
      Object.setPrototypeOf(i, Drive.prototype)
    }
    return infos
  }

  app.controller.handle('preset', async () => {
    const defaultPath = join(app.host.getPath('home'), '.xmcl')
    const getPath = (driveSymbol: string) => {
      const parsedHome = parse(defaultPath)
      if (parsedHome.root.toLocaleLowerCase().startsWith(driveSymbol.toLocaleLowerCase())) {
        return defaultPath
      }
      return join(driveSymbol, '.xmcl')
    }
    const getAllDrived = async () => {
      try {
        const startTime = Date.now()
        const drives = await Promise.race([
          getDiskInfo(),
          setTimeout(4000).then(() => []),
        ])
        logger.log(`Get disk info in ${Date.now() - startTime}ms`)
        return drives.map(d => ({
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
