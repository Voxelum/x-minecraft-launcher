import { gameLaunch } from './gameLaunch'
import { i18n } from './i18n'
import { notificationSetupPlugin } from './notification'
import { optifine } from './optifine'
import { taskProgressPlugin } from './taskProgress'
import { themePlugin } from './theme'
import { trayPlugin } from './tray'
import { windowController } from './windowController'

export const plugins = [optifine, notificationSetupPlugin, i18n, gameLaunch, taskProgressPlugin, trayPlugin, windowController, themePlugin]
