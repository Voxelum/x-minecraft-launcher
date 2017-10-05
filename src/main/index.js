import {
    app, BrowserWindow,
    ipcMain, DownloadItem,
    Tray, nativeImage,
    dialog, MenuItem, Menu,
} from 'electron'
import paths from 'path'
import urls from 'url'
import fs from 'fs-extra'
import os from 'os'

const devMod = process.env.NODE_ENV === 'development'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

const winURL = process.env.NODE_ENV === 'development' ?
    'http://localhost:9080/index.html' :
    `file://${__dirname}/index.html`

let mainWindow;
let logWindow;

let maindownloadCallback;
const downloadTasks = new Map()

let parking = false;

let iconImage

let root = process.env.LAUNCHER_ROOT
let theme = 'semantic';

const appData = app.getPath('appData');
const cfgFile = `${appData}/launcher.json`

function updateSettings(newRoot, newTheme) {
    let updated = false;
    if (newRoot && newRoot != null && newRoot !== root) {
        root = newRoot;
        app.setPath('userData', root);
        updated = true;
    }
    if (newTheme && newTheme != null && newTheme !== theme) {
        theme = newTheme;
        updated = true;
    }
    if (updated) fs.writeFile(cfgFile, JSON.stringify({ path: root, theme }))
}

try {
    const buf = fs.readFileSync(cfgFile)
    const cfg = JSON.parse(buf.toString())
    root = cfg.root || paths.join(appData, '.launcher');
    app.setPath('userData', root);
    theme = cfg.theme || 'semantic'
} catch (e) {
    root = paths.join(appData, '.launcher');
    app.setPath('userData', root);
    theme = 'semantic'
    fs.writeFile(cfgFile, JSON.stringify({ path: root, theme }))
}

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

function setupIcon(window) {
    const platform = os.platform()
    if (platform === 'darwin') app.dock.setIcon(iconImage)
    else logWindow.setIcon(iconImage);
}

function createLogWindow() {
    logWindow = new BrowserWindow({
        height: 400,
        width: 600,
        frame: false,
    })
    logWindow.setTitle('Log')
    setupIcon(logWindow)
    logWindow.loadURL(`${winURL}?logger=true`);
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
    setupIcon(mainWindow)
    mainWindow.loadURL(`${winURL}?logger=false&theme=${theme}&root=${root}`)

    mainWindow.on('closed', () => { mainWindow = null })
    mainWindow.on('ready-to-show', () => {
    })
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
    require('./services'); // load all service 
    iconImage = nativeImage.createFromPath(`${__static}/logo.png`) // eslint-disable-line no-undef
    createMainWindow()

    const tray = new Tray(iconImage)
    tray.setToolTip('An Electron Minecraft Launcher')
    const menu = new Menu();
    menu.append(new MenuItem({
        click: (item, win, event) => {
            mainWindow.close();
        },
        role: 'Hint',
        label: 'Exit',
    }))
    tray.setContextMenu(menu)
    app.setName('ILauncher');
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

ipcMain.on('update', (event, newRoot, newTheme) => {
    if (newRoot !== undefined || newTheme !== undefined) {
        updateSettings(newRoot, newTheme);
        newTheme = newTheme || 'semantic'
        parking = true
        mainWindow.close();
        createMainWindow();
        parking = false;
    }
})

ipcMain.on('park', (debug) => {
    parking = true;
    mainWindow.close()
    createLogWindow();
})

ipcMain.on('restart', () => {
    parking = false;
    if (logWindow) {
        logWindow.close();
    }
    createMainWindow()
})

ipcMain.on('exit', () => {
    mainWindow.close()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

