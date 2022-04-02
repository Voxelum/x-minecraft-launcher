import Controller from '@/Controller'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { app, dialog, Menu, ProcessMemoryInfo, Tray } from 'electron'
import iconPath from '../assets/apple-touch-icon.png'
import favcon2XPath from '../assets/favicon@2x.png'
import { ControllerPlugin } from './plugin'

export const trayPlugin: ControllerPlugin = function (this: Controller) {
  const { t } = this.i18n
  const createMenu = () => {
    const app = this.app
    const service = this.app.serviceManager.getService(BaseServiceKey)
    const onBrowseAppClicked = () => {
      if (this.browserRef && !this.browserRef.isDestroyed()) {
        this.browserRef.show()
      } else {
        this.createBrowseWindow()
      }
    }
    const diagnose = () => {
      const cpu = process.getCPUUsage()
      const mem = process.getProcessMemoryInfo()

      const p: Promise<ProcessMemoryInfo> = mem instanceof Promise ? mem : Promise.resolve(mem)
      p.then((m) => {
        const cpuPercentage = (cpu.percentCPUUsage * 100).toFixed(2)
        const messages = [
          `Mode: ${process.env.NODE_ENV}`,
          `CPU: ${cpuPercentage}%`,
          `Private Memory: ${m.private}KB`,
          `Shared Memory: ${m.shared}KB`,
          `Physically Memory: ${m.residentSet}KB`,
        ]
        if (this.browserRef) {
          const runnings = this.browserRef.webContents.session.serviceWorkers.getAllRunning()
          for (const [ver, info] of Object.entries(runnings)) {
            messages.push(`Service Worker ${ver}: ${info.scope} ${info.renderProcessId} ${info.scriptUrl}`)
          }
        }
        dialog.showMessageBox({
          type: 'info',
          title: 'Diagnosis Info',
          message: `${messages.join('\n')}`,
        })
      })
    }
    return Menu.buildFromTemplate([
      {
        type: 'normal',
        label: t('checkUpdate'),
        click() {
          service?.checkUpdate()
        },
      },
      {
        label: t('browseApps'),
        type: 'normal',
        click: onBrowseAppClicked,
      },
      { type: 'separator' },
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
    const tray = new Tray(favcon2XPath)
    tray.on('click', () => {
      const window = this.mainWin
      if (window && !window.isFocused()) {
        window.focus()
      }
    }).on('double-click', () => {
      const window = this.mainWin
      if (window) {
        if (window.isVisible()) window.hide()
        else window.show()
      }
    })
    if (app.dock) {
      app.dock.setIcon(iconPath)
    }
    app.on('before-quit', () => {
      this.tray?.destroy()
    })
    this.tray = tray
  })

  this.app.on('app-booted', (man) => {
    this.tray?.setTitle(man.name)
    this.tray?.setImage(man.iconPath)
  })

  Promise.all([
    new Promise<void>((resolve) => {
      this.app.once('engine-ready', resolve)
    }),
    new Promise<void>((resolve) => {
      this.app.once('all-services-ready', resolve)
    }),
  ]).then(() => {
    const tray = this.tray
    if (tray) {
      tray.setToolTip(t('title'))
      tray.setContextMenu(createMenu())
      this.app.serviceStateManager.subscribe('localeSet', (l) => {
        tray.setToolTip(t('title'))
        tray.setContextMenu(createMenu())
      })
    }
  })
}
