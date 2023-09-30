import { ElectronController } from '@/ElectronController'
import { darkIcon, darkTray, lightIcon, lightTray } from '@/utils/icons'
import { BaseService } from '@xmcl/runtime'
import { app, Menu, shell, Tray, nativeTheme, nativeImage, MenuItemConstructorOptions } from 'electron'
import { ControllerPlugin } from './plugin'
import { kSettings } from '@xmcl/runtime/lib/entities/settings'

export const trayPlugin: ControllerPlugin = function (this: ElectronController) {
  const { t } = this.i18n
  // nativeTheme.addListener('updated', () => {
  //   if (nativeTheme.shouldUseDarkColors) {

  //   } else {

  //   }
  // })
  let checkUpdate: (() => void) | undefined
  const createMenu = () => {
    const app = this.app
    const onBrowseAppClicked = () => {
      if (this.browserRef && !this.browserRef.isDestroyed()) {
        this.browserRef.show()
      } else {
        this.createBrowseWindow()
      }
    }
    const diagnose = () => {
      this.activeWindow?.webContents.closeDevTools()
      this.activeWindow?.webContents.openDevTools()
    }
    const showLogs = () => {
      // shell.openPath(this.app.logManager.getLogRoot())
    }
    const options: MenuItemConstructorOptions[] = [
      {
        type: 'normal',
        label: t('checkUpdate'),
        click: () => {
          checkUpdate?.()
        },
        enabled: !!checkUpdate,
      },
      // {
      //   label: t('browseApps'),
      //   type: 'normal',
      //   click: onBrowseAppClicked,
      // },
      { type: 'separator' },
      // {
      //   label: t('showLogsFolder'),
      //   type: 'normal',
      //   click: showLogs,
      // },
      {
        label: t('showDiagnosis'),
        type: 'normal',
        click: diagnose,
        role: 'toggleDevTools',
      },
      {
        label: t('quit'),
        type: 'normal',
        click() {
          app.quit()
        },
      },
    ]
    if (app.platform.os === 'osx') {
      const show = () => {
        const window = this.mainWin
        window?.show()
      }
      options.unshift({
        label: t('showLauncher'),
        type: 'normal',
        click: show,
        role: 'front',
      })
    }
    return Menu.buildFromTemplate(options)
  }

  const getTrayImage = (dark: string, light: string) => {
    const path = nativeTheme.shouldUseDarkColors ? dark : light
    if (this.app.platform.os === 'osx') {
      const icon = nativeImage.createFromPath(path)
      return icon.resize({ width: 20, height: 20 })
    }
    return path
  }

  this.app.once('engine-ready', async () => {
    this.app.registry.get(BaseService).then(service => {
      checkUpdate = () => service.checkUpdate()
    })
    this.app.registry.get(kSettings).then(state => {
      state.subscribe('config', () => {
        tray.setToolTip(t('title'))
        tray.setContextMenu(createMenu())
      }).subscribe('localeSet', () => {
        tray.setToolTip(t('title'))
        tray.setContextMenu(createMenu())
      })
    })

    const tray = new Tray(getTrayImage(darkTray, lightTray))
    if (this.app.platform.os === 'windows') {
      tray.on('double-click', () => {
        const window = this.mainWin
        if (window) {
          if (window.isVisible()) {
            window.hide()
          } else window.show()
        }
      })
    }

    tray.setToolTip(t('title'))
    tray.setContextMenu(createMenu())

    if (app.dock) {
      app.dock.setIcon(nativeTheme.shouldUseDarkColors ? darkIcon : lightIcon)
    }
    app.on('before-quit', () => {
      this.tray?.destroy()
    })
    this.tray = tray
  })

  this.app.on('app-booted', (man) => {
    if (app.dock) {
      app.dock.setIcon(nativeTheme.shouldUseDarkColors ? man.iconSets.darkDockIcon : man.iconSets.dockIcon)
    }
    this.tray?.setImage(getTrayImage(man.iconSets.darkTrayIcon, man.iconSets.trayIcon))
  })
}
