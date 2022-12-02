import Controller from '@/Controller'
import { app, BrowserWindow, dialog, FindInPageOptions, ipcMain } from 'electron'
import { ControllerPlugin } from './plugin'
import { platform } from 'os'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
  Close = 4,
}

export const windowController: ControllerPlugin = function (this: Controller) {
  const currentPlatform = platform()

  app.on('browser-window-created', (_, win: BrowserWindow) => {
    win.on('maximize', () => {
      win.webContents.send('maximize', win.isMaximized())
    })
    win.on('enter-full-screen', () => {
      win.webContents.send('maximize', win.fullScreen)
    })
    win.on('leave-full-screen', () => {
      win.webContents.send('maximize', win.fullScreen)
    })
    win.on('minimize', () => {
      win.webContents.send('minimize', win.isMaximized())
    })
  })
  ipcMain.handle('dialog:showOpenDialog', (event, ...args) => {
    return dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender)!, args[0])
  })
  ipcMain.handle('dialog:showSaveDialog', (event, ...args) => {
    return dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender)!, args[0])
  })
  ipcMain.handle('find-in-page', (event, text: string, options: FindInPageOptions) => {
    event.sender.findInPage(text, options)
  })
  ipcMain.handle('stop-find-in-page', (event) => {
    event.sender.stopFindInPage('clearSelection')
  })
  ipcMain.handle('isMaximized', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window?.isMaximized()
  })
  ipcMain.handle('control', (event, operation: Operation) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      switch (operation) {
        case Operation.Maximize:
          if (window.maximizable) {
            if (currentPlatform === 'darwin') {
              window.fullScreen = !window.fullScreen
            } else {
              if (!window.isMaximized()) {
                window.maximize()
              } else {
                window.unmaximize()
              }
            }
            return true
          }
          return false
        case Operation.Minimize:
          if (window.minimizable) {
            window.minimize()
            return true
          }
          return false
        case Operation.Hide:
          if (window.isVisible()) {
            window.hide()
            return true
          }
          return false
        case Operation.Show:
          if (!window.isVisible()) {
            window.show()
            return true
          }
          return false
        case Operation.Close:
          window.close()
          return true
      }
    }
    return false
  })
}
