import { LauncherAppPlugin } from '~/app'
import { decorateError, shouldLog } from '../errors/error_decorate'

export const pluginUncaughtError: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('App')
  process.on('uncaughtException', (err) => {
    logger.warn('Uncaught Exception')
    decorateError(err)
    if (shouldLog(err)) {
      logger.error(err)
    }
  })
  process.on('unhandledRejection', (reason) => {
    logger.warn('Uncaught Rejection')
    decorateError(reason)
    if (shouldLog(reason)) {
      logger.error(reason)
    }
  })
}
