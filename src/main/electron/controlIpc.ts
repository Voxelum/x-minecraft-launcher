import { BrowserWindow, ipcMain } from 'electron'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
}

ipcMain.handle('control', (event, operation: Operation) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window) {
    switch (operation) {
      case Operation.Maximize:
        if (window.maximizable) {
          window.maximize()
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
