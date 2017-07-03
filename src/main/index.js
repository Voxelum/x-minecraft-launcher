import { app, BrowserWindow, ipcMain } from 'electron'
import { AuthService } from 'ts-minecraft'


/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`


function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 563,
    useContentSize: true,
    width: 1000
  })

  mainWindow.loadURL(winURL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function init() {
  ipcMain.on('init', (event, args) => {
    event.send.send('init', 'pong')
  })
  ipcMain.on('login', (evet, args) => {
    let [account, password, mode] = args
    AuthService.newYggdrasilAuthService().login(account, password, 'non', (resp) => {
      console.log(resp)
    })
  })
}
app.on('ready', () => {
  init()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
