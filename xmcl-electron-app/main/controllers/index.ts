import { gameLaunch } from './gameLaunch'
import { setupWindow } from './setupWindow'
import { taskProgressPlugin } from './taskProgress'
import { trayPlugin } from './tray'
import { windowController } from './windowController'
import { i18n } from './i18n'
import { themePlugin } from './theme'

export const plugins = [gameLaunch, setupWindow, taskProgressPlugin, trayPlugin, windowController, i18n, themePlugin]
