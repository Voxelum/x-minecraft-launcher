import {
    app,
    BrowserWindow,
    ipcMain,
    DownloadItem,
} from 'electron'
import {
    AuthService,
} from 'ts-minecraft'
import paths from 'path'

const devMod = process.env.NODE_ENV === 'development'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

ipcMain.on('ping', (event, time) => {
    console.log(time)
    event.sender.send('pong')
    console.log(`single spend ${Date.now() - time}`)
})

let mainWindow
let maindownloadCallback
const downloadTasks = new Map()
const winURL = process.env.NODE_ENV === 'development' ?
    'http://localhost:9080' :
    `file://${__dirname}/index.html`
let parking = false;

let root = process.env.LAUNCHER_ROOT
if (!root) {
    process.env.LAUNCHER_ROOT = paths.join(app.getPath('appData'), '.launcher');
    root = process.env.LAUNCHER_ROOT
}

function createWindow() {
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow({
        height: 626,
        useContentSize: true,
        width: 1000,
        resizable: false,
        // minWidth: 1000,
        // minHeight: 626,
        // maxWidth: 1000,
        // maxHeight: 626,
        frame: false,
        titleBarStyle: 'customButtonsOnHover',
    })

    mainWindow.loadURL(winURL)

    mainWindow.on('closed', () => {
        mainWindow = null
    })
    mainWindow.on('show', () => {
        console.log(`init ${root}`)
    })
    mainWindow.webContents.session.setDownloadPath(paths.join(root, 'temps'))
    mainWindow.webContents.session.on('will-download', (event, item, content) => {
        const save = downloadTasks.get(item.getURL())
        if (save) item.setSavePath(save)
        mainWindow.webContents.send('will-download', {
            file: item.getFilename(),
            url: item.getURL(),
        })
        item.on('updated', ($event, state) => {
            mainWindow.webContents.send('download', {
                file: item.getFilename(),
                url: item.getURL(),
                state,
                byte: item.getReceivedBytes(),
                total: item.getTotalBytes(),
            })
        })
        item.on('done', ($event, state) => {
            downloadTasks.delete(item.getURL())
            mainWindow.webContents.send('download-done', {
                file: item.getFilename(),
                url: item.getURL(),
                state,
                byte: item.getReceivedBytes(),
                total: item.getTotalBytes(),
            })
        })
    })
    maindownloadCallback = (filePath, url) => {
        downloadTasks.set(url, filePath)
        mainWindow.webContents.downloadURL(url)
    }
}

app.on('ready', () => {
    createWindow()
})

app.on('window-all-closed', () => {
    if (parking) return;
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
})

ipcMain.on('init', (event) => {
    console.log(root)
    mainWindow.webContents.send('init', root)
})
ipcMain.on('park', () => {
    parking = true;
    mainWindow.close()
    mainWindow = null;
})
ipcMain.on('restart', () => {
    parking = false;
    createWindow()
})
ipcMain.on('exit', () => {
    mainWindow.close()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
ipcMain.on('ping', (event, time) => {
    event.sender.send('pong')
    console.log(`single spend ${Date.now() - time}`)
})

require('./services'); // load all service 
