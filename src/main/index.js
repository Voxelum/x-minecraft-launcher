import electron, {
    app, BrowserWindow,
    ipcMain, DownloadItem,
    Tray, nativeImage,
    dialog, MenuItem, Menu,
    net,
} from 'electron'
import paths from 'path'
import urls from 'url'
import fs from 'fs-extra'
import os from 'os'
import vuex from 'vuex'
import storeLoader from './store'

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

/**
 * @type {BrowserWindow}
 */
let mainWindow;
/**
 * @type {BrowserWindow}
 */
let logWindow;
let parking = false;
/**
 * @type {electron.NativeImage}
 */
let iconImage;
/**
 * @type {vuex.Store}
 */
let store;

/**
 * @type {string}
 */
let root = process.env.LAUNCHER_ROOT
const appData = app.getPath('appData');
const cfgFile = `${appData}/launcher.json`

/**
 * Setup root and config
 */

try {
    const buf = fs.readFileSync(cfgFile)
    const cfg = JSON.parse(buf.toString())
    root = cfg.root || paths.join(appData, '.launcher');
    app.setPath('userData', root);
} catch (e) {
    root = paths.join(appData, '.launcher');
    app.setPath('userData', root);
    // theme = 'semantic'
    fs.writeFile(cfgFile, JSON.stringify({ path: root }))
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

/**
 * @type {Promise<void>}
 */
const storePromise = storeLoader(root).then((result) => {
    store = result;
})

/**
 * Helper functions
 */

function updateSettings(newRoot) {
    let updated = false;
    if (newRoot && newRoot != null && newRoot !== root) {
        root = newRoot;
        app.setPath('userData', root);
        updated = true;
    }
    if (updated) fs.writeFile(cfgFile, JSON.stringify({ path: root }))
}

function setupIcon(window) {
    const platform = os.platform()
    if (platform === 'darwin') app.dock.setIcon(iconImage)
    else window.setIcon(iconImage);
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
    logWindow.webContents.setVisualZoomLevelLimits(1, 1);
    logWindow.webContents.setLayoutZoomLevelLimits(1, 1);
}

function createMainWindow() {
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow({
        height: 626,
        width: 1100,
        resizable: false,
        frame: false,
        transparent: true,
    })
    mainWindow.setResizable(false);
    mainWindow.setTitle('ILauncher')
    setupIcon(mainWindow)
    mainWindow.loadURL(`${winURL}?logger=false&root=${root}`)

    mainWindow.on('closed', () => { mainWindow = null })
}

/**
 * ElectronApp event handle
 */

app.on('ready', () => {
    iconImage = nativeImage.createFromPath(`${__static}/logo.png`) // eslint-disable-line no-undef
    createMainWindow();

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

/**
 * Custom ipc event handle
 */

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

ipcMain.on('update', (event, newRoot) => {
    if (newRoot !== undefined) {
        updateSettings(newRoot);
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
    if (logWindow) {
        logWindow.close();
    }
    parking = false;
    createMainWindow()
})

ipcMain.on('exit', () => {
    mainWindow.close()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

export function commit(type, payload, option) {
    storePromise.then(() => store.commit(type, payload, option))
}
export function dispatch(type, payload, option) {
    return storePromise.then(() => store.dispatch(type, payload, option))
}
