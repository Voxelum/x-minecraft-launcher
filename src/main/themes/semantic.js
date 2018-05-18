import { ipcMain, BrowserWindow, app, Tray, Menu, MenuItem, nativeImage } from 'electron'
import os from 'os';

export default function setup(winURL) {
    let logWindow; // log win ref
    let mainWindow; // main win ref
    let iconImage; // icon image

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

    app.on('activate', () => {
        if (mainWindow === null) createMainWindow()
    })

    const ipcListeners = [];
    const ipcListen = (event, listener) => {
        ipcListeners.push({ event, listener });
        ipcMain.on(event, listener)
        return listener;
    }
    /**
     * handle log window log message
     */
    ipcListen('minecraft-stdout', ((s) => {
        if (logWindow) {
            logWindow.webContents.send('minecraft-stdout', s);
        }
    }))
    ipcListen('minecraft-stderr', ((s) => {
        if (logWindow) {
            logWindow.webContents.send('minecraft-stderr', s);
        }
    }))

    ipcListen('reset', ((event, newRoot) => {
        if (newRoot !== undefined) {
            mainWindow.close();
            createMainWindow();
        }
    }))
    /**
     * handle park launcher when the game launch
     */
    ipcListen('minecraft-start', ((debug) => {
        mainWindow.close()
        if (debug) createLogWindow();
    }))
    ipcListen('minecraft-exit', (() => {
        if (logWindow) {
            logWindow.close();
        }
        createMainWindow()
    }))

    return {
        dispose() {
            for (const l of ipcListeners) {
                ipcMain.removeListener(l.event, l.listener);
            }
        },
    }
}
