import Controller from '@/Controller'
import { darkIco, darkIcon, darkTray, lightIcon, lightTray } from '@/utils/icons'
import { BaseService } from '@xmcl/runtime'
import { app, Menu, shell, Tray, nativeTheme } from 'electron'
import { ControllerPlugin } from './plugin'

export const trayPlugin: ControllerPlugin = function (this: Controller) {
  const { t } = this.i18n
  // nativeTheme.addListener('updated', () => {
  //   if (nativeTheme.shouldUseDarkColors) {

  //   } else {

  //   }
  // })
  const createMenu = () => {
    const app = this.app
    const service = this.app.serviceManager.get(BaseService)
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
      shell.openPath(this.app.logManager.getLogRoot())
    }
    return Menu.buildFromTemplate([
      {
        type: 'normal',
        label: t('checkUpdate'),
        click() {
          service.checkUpdate()
        },
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
      },
      {
        label: t('quit'),
        type: 'normal',
        click() {
          app.quit()
        },
      },
    ])
  }

  this.app.once('engine-ready', () => {
    const tray = new Tray(nativeTheme.shouldUseDarkColors ? darkTray : lightTray)
    tray.on('click', () => {
      if (this.app.platform.name === 'windows') {
        const window = this.mainWin
        if (window && !window.isFocused()) {
          window.focus()
        }
      }
    }).on('double-click', () => {
      const window = this.mainWin
      if (window) {
        if (window.isVisible()) window.hide()
        else window.show()
      }
    })
    tray.setToolTip(t('title'))
    tray.setContextMenu(createMenu())
    this.app.serviceStateManager.subscribe('config', () => {
      tray.setToolTip(t('title'))
      tray.setContextMenu(createMenu())
    })
    this.app.serviceStateManager.subscribe('localeSet', () => {
      tray.setToolTip(t('title'))
      tray.setContextMenu(createMenu())
    })
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
    this.tray?.setImage(nativeTheme.shouldUseDarkColors ? man.iconSets.darkTrayIcon : man.iconSets.trayIcon)
  })
}
