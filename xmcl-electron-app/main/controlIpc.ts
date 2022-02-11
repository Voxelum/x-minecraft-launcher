import { BrowserWindow, dialog, ipcMain } from 'electron'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
}

ipcMain.handle('dialog:showOpenDialog', (event, ...args) => {
  return dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender)!, args[0])
})
ipcMain.handle('dialog:showSaveDialog', (event, ...args) => {
  return dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender)!, args[0])
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
