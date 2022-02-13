import { gameLaunch } from './gameLaunch'
import { setupWindow } from './setupWindow'
import { taskProgressPlugin } from './taskProgress'
import { trayPlugin } from './tray'
import { windowController } from './windowController'

export const plugins = [gameLaunch, setupWindow, taskProgressPlugin, trayPlugin, windowController]
