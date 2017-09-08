import {
    app,
    BrowserWindow,
    ipcMain,
    DownloadItem,
    Tray,
    nativeImage,
} from 'electron'
import {
    AuthService,
} from 'ts-minecraft'
import paths from 'path'
import urls from 'url'

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

const mainWinURL = process.env.NODE_ENV === 'development' ?
    'http://localhost:9080/index.html' :
    `file://${__dirname}/index.html`


const logWinURL = process.env.NODE_ENV === 'development' ?
    'http://localhost:9080/log.html' :
    `file://${__dirname}/log.html`

let mainWindow;
let logWindow;


let maindownloadCallback;
const downloadTasks = new Map()

let parking = false;

let iconImage

let root = process.env.LAUNCHER_ROOT
if (!root) {
    process.env.LAUNCHER_ROOT = paths.join(app.getPath('appData'), '.launcher');
    root = process.env.LAUNCHER_ROOT
}
app.setPath('appData', root);

const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
    }
})

if (isSecondInstance) {
    app.quit()
}

function createLogWindow() {
    logWindow = new BrowserWindow({
        height: 400,
        width: 600,
        frame: false,
    })
    logWindow.setTitle('Log')
    logWindow.setIcon(iconImage);
    logWindow.loadURL(logWinURL);
    logWindow.on('closed', () => { logWindow = null })
}

ipcMain.on('minecraft-stdout', (s) => {
    if (logWindow) {
        logWindow.webContents.send('minecraft-stdout', s);
    }
})

ipcMain.on('minecraft-stderr', (s) => {
    if (logWindow) {
        logWindow.webContents.send('minecraft-stderr', s);
    }
})

function createMainWindow() {
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow({
        height: 626,
        width: 1100,
        resizable: false,
        frame: false,
    })
    mainWindow.setTitle('ILauncher')
    mainWindow.setIcon(iconImage)
    mainWindow.loadURL(mainWinURL)

    mainWindow.on('closed', () => { mainWindow = null })
    mainWindow.on('show', () => {
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
    iconImage = nativeImage.createFromPath(`${__dirname}/logo.png`)
    createMainWindow()

    const appIcon = new Tray(iconImage)
    app.setName('ILauncher');
    // createLogWindow();
})

app.on('window-all-closed', () => {
    if (parking) return;
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) createMainWindow()
})

ipcMain.on('init', (event) => {
    mainWindow.webContents.send('init', root)
})
ipcMain.on('park', (debug) => {
    parking = true;
    mainWindow.close()
    mainWindow = null;
    createLogWindow();
})
ipcMain.on('restart', () => {
    parking = false;
    if (logWindow) {
        logWindow.close();
        logWindow = undefined;
    }
    console.log('recreate main')
    createMainWindow()
})
ipcMain.on('exit', () => {
    mainWindow.close()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

require('./services'); // load all service 

