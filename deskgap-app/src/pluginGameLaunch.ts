import type { LauncherAppPlugin } from '@xmcl/runtime/app'
import { LaunchService } from '@xmcl/runtime/launch'
import { externalWindow, screen } from 'deskgap'
import type { DeskGapController } from './controller'
import { bindGameLaunchLifecycle } from './gameLaunchLifecycle'

export const pluginGameLaunch: LauncherAppPlugin = (app) => {
  void app.waitEngineReady().then(async () => {
    const service = await app.registry.get(LaunchService)
    const controller = app.controller as DeskGapController
    const logger = app.getLogger('GameLaunch')
    bindGameLaunchLifecycle(service, controller, {
      async moveGameWindow(pid, monitor) {
        if (!externalWindow.isSupported()) return
        const display = screen.getAllDisplays().find(({ id }) => String(id) === monitor)
        if (display) await externalWindow.moveAndResize(pid, display.bounds)
      },
      warn(error) {
        logger.warn(error)
      },
    })
  })
}