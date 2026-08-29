import { LauncherAppPlugin } from '~/app'
import { UserService } from './UserService'

export const pluginUserServiceBootstrap: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('UserServiceBootstrap')
  void app.registry.getOrCreate(UserService)
    .then(service => service.initialize())
    .catch((e) => {
      logger.warn('Unable to initialize user service during startup.')
      if (e instanceof Error) logger.error(e)
    })
}
