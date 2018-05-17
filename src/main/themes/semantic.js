import { ipcMain, BrowserWindow, app, Tray, Menu, MenuItem, nativeImage } from 'electron'
import os from 'os';

export default function setup(winURL) {
    let logWindow; // log win ref
    let mainWindow; // main win ref
    let iconImage; // icon image
    let parking; // ref for if the game is launching and the launcher is paused

    function setupIcon(window) {
        const platform = os.platform()
        if (platform === 'darwin') app.dock.setIcon(iconImage)
        else window.setIcon(iconImage)
    }

    /**
     * Create main window
     */
    function createMainWindow() {
        mainWindow = new BrowserWindow({
            height: 626,
            width: 1100,
            resizable: false,
            frame: false,
            transparent: true,
        })
        mainWindow.setResizable(false)
        mainWindow.setTitle('ILauncher')
        setupIcon(mainWindow)
        mainWindow.loadURL(`${winURL}?logger=false`)
        mainWindow.on('closed', () => { mainWindow = null })
    }

    /**
     * Create log window
     */
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
    app.makeSingleInstance((commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

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

    app.on('window-all-closed', () => {
        if (parking) return;
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })
    app.on('activate', () => {
        if (mainWindow === null) createMainWindow()
    })

    const ipcListeners = [];
    const ipcListen = (listener) => {
        ipcListeners.push(listener);
        return listener;
    }
    /**
     * handle log window log message
     */
    ipcMain.on('minecraft-stdout', ipcListen((s) => {
        if (logWindow) {
            logWindow.webContents.send('minecraft-stdout', s);
        }
    }))
    ipcMain.on('minecraft-stderr', ipcListen((s) => {
        if (logWindow) {
            logWindow.webContents.send('minecraft-stderr', s);
        }
    }))

    ipcMain.on('reset', ipcListen((event, newRoot) => {
        if (newRoot !== undefined) {
            parking = true
            mainWindow.close();
            createMainWindow();
            parking = false;
        }
    }))
    /**
     * handle park launcher when the game launch
     */
    ipcMain.on('park', ipcListen((debug) => {
        parking = true;
        mainWindow.close()
        if (debug) createLogWindow();
    }))
    ipcMain.on('restart', ipcListen(() => {
        if (logWindow) {
            logWindow.close();
        }
        parking = false;
        createMainWindow()
    }))
    ipcMain.on('exit', ipcListen(() => {
        mainWindow.close()
        if (process.platform !== 'darwin') {
            app.quit()
        }
    }))

    console.log('finish')

    return {
        dispose() {
            ipcListeners.forEach(ipcMain.removeListener);
        },
    }
}
