import { join } from 'path'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { kGameDataPath } from '../entities/gameDataPath'

export const pluginGameDataPath: LauncherAppPlugin = (app) => {
  let _path = ''
  app.getGameDataPath().then((path) => {
    _path = path
    app.registry.register(kGameDataPath, (...args) => {
      return join(_path, ...args)
    })
  })
  app.on('root-migrated', (newRoot) => {
    _path = newRoot
  })
}
