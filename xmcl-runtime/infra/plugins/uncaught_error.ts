import { LauncherAppPlugin } from '~/app'
import { decorateError } from '../errors/error_decorate'

export const pluginUncaughtError: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('App')
  process.on('uncaughtException', (err) => {
    logger.warn('Uncaught Exception')
    if (err instanceof Error) {
      decorateError(err)
      logger.error(err)
    }
  })
  process.on('unhandledRejection', (reason) => {
    logger.warn('Uncaught Rejection')
    if (reason instanceof Error) {
      decorateError(reason)
      logger.error(reason)
    }
  })
}
