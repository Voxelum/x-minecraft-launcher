import Controller from '@/Controller'
import { BrowserWindow, dialog, FindInPageOptions, ipcMain } from 'electron'
import { ControllerPlugin } from './plugin'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
}

export const windowController: ControllerPlugin = function (this: Controller) {
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
  ipcMain.handle('control', (event, operation: Operation) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      switch (operation) {
        case Operation.Maximize:
          if (window.maximizable) {
            if (!window.isMaximized()) {
              window.maximize()
            } else {
              window.unmaximize()
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
      }
    }
    return false
  })
}
