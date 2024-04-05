import { join } from 'path'
import { LauncherAppPlugin } from './LauncherAppPlugin'
import { kGameDataPath, kTempDataPath } from './gameDataPath'
import { ensureDir } from 'fs-extra'

export const pluginGameDataPath: LauncherAppPlugin = (app) => {
  let _path = ''
  app.getGameDataPath().then(async (path) => {
    _path = path

    app.registry.register(kGameDataPath, (...args) => {
      return join(_path, ...args)
    })

    const temporaryPath = join(path, 'temp')
    await ensureDir(temporaryPath)

    app.registry.register(kTempDataPath, (...args) => {
      return join(temporaryPath, ...args)
    })
  })
  app.on('root-migrated', (newRoot) => {
    _path = newRoot
  })
}
