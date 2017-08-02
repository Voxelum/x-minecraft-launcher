import {
    app,
    BrowserWindow,
    ipcMain,
} from 'electron'
import {
    AuthService,
} from 'ts-minecraft'

const devMod = process.env.NODE_ENV === 'development'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

ipcMain.on('ping', (event) => {
    event.sender.send('pong')
})

let mainWindow
const winURL = process.env.NODE_ENV === 'development' ?
    'http://localhost:9080' :
    `file://${__dirname}/index.html`


function createWindow() {
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow({
        height: 563,
        useContentSize: true,
        width: 1000,
        frame: false,
    })

    mainWindow.loadURL(winURL)

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

app.on('ready', () => {
    createWindow()
})

app.on('window-all-closed', () => { // will be removed later...
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
})

ipcMain.on('park', () => {
    mainWindow.close()
    mainWindow = null;
})
ipcMain.on('restart', () => {
    createWindow()
})
ipcMain.on('exit', () => {
    mainWindow.close()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

const launcher = require('./launcher');
const services = require('./services').default;

console.log('Start services initialize')

for (const key in services) {
    if (services.hasOwnProperty(key)) {
        const service = services[key];
        if (service.initialize) {
            console.log(`Initializes service ${key}`)
            service.initialize();
        }
    }
}
