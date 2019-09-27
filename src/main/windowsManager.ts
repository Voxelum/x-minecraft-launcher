import { app, BrowserWindow, ipcMain, shell, BrowserWindowConstructorOptions, BrowserViewConstructorOptions, Tray, Dock } from 'electron';
import ipc from './ipc';
import getTray from './trayManager';
import setupDownload from './downloadManager';

import { CustomEvents } from './ipc';
import { Repo, RootState } from '../universal/store';
import { Store } from 'vuex';

export interface ClientInstance extends Hook {
    /**
     * All client listeners
     */
    listeners: { [channel: string]: Function[] };
}

export interface Hook {
    requestFocus(): void;
    dispose(): void;
}
export interface ClientContext {
    createWindow(url: string, option: BrowserWindowConstructorOptions): BrowserWindow;
    ipcMain: CustomEvents;
    configTray(func: (tray: Tray) => void): this;
    configDock(func: (dock: Dock) => void): this;
}

export type ClientBootstrap = (context: ClientContext, store: Repo) => Hook;

const headless = process.env.HEADLESS || false;

const isDev = process.env.NODE_ENV === 'development';
const baseURL = isDev
    ? 'http://localhost:9080/'
    : `file://${__dirname}/`;
/**
 * A map to keep running browser
 */
let windows: { [name: string]: BrowserWindow } = {};
/**
 * ref for if the game is launching and the launcher is paused
 */
let parking: boolean;

/**
 * instance of client
 */
let instance: ClientInstance | null;

/**
 * The instance of the guard window
 */
let guard: BrowserWindow | null = null;

/**
 * Create a window 
 */
function createWindow(name: string, option: BrowserViewConstructorOptions) {
    const ops = { ...option };
    if (!ops.webPreferences) { ops.webPreferences = {}; }
    ops.webPreferences.webSecurity = !isDev; // disable security for loading local image
    ops.webPreferences.nodeIntegration = isDev; // enable node for webpack in dev
    const ref = new BrowserWindow(ops);
    ipcMain.emit('browser-window-setup', ref, name);
    ref.loadURL(`${baseURL}${name}`);
    console.log(`Create window from ${`${baseURL}${name}`}`);
    ref.webContents.on('will-navigate', (event, url) => {
        if (isDev) {
            if (!url.startsWith('http://localhost')) {
                event.preventDefault();
                shell.openExternal(url);
            }
        } else {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
    windows[name] = ref;
    ref.on('close', () => {
        delete windows[name];
        if (Object.keys(windows).length === 0) {
            app.emit('window-all-closed');
        }
    });
    return ref;
}

function setupClient(client: ClientBootstrap, store: Store<RootState>) {
    parking = true;
    const tray = getTray();

    if (instance) { // stop current client if exist
        try {
            instance.dispose();
        } catch (e) {
            console.warn(`An error occure during dispose ${client}`);
            console.error(e);
        }
        for (const channel of Object.keys(instance.listeners)) {
            for (const lis of instance.listeners[channel]) {
                ipcMain.removeListener(channel, lis);
            }
        }
        if (tray) {
            tray.removeAllListeners();
        }
        windows = {};
        BrowserWindow.getAllWindows().forEach(win => win.close());
        instance = null;
    }
    const listeners: ClientInstance['listeners'] = {};

    const hook = client({
        createWindow,
        ipcMain: {
            on(channel: string, func: Function) {
                if (!listeners[channel]) listeners[channel] = [];
                listeners[channel].push(func);
                return ipcMain.addListener(channel, func);
            },
        },
        configTray(func) {
            if (tray) { func(tray); }
            return this;
        },
        configDock(func) {
            if (app.dock) {
                func(app.dock);
            }
            return this;
        },
    }, store);

    const newInstance = {
        ...hook,
        listeners,
    };
    instance = newInstance;

    parking = false;
}

async function setup(store: Store<RootState>) {
    if (!headless) {
        setupClient(await import('./material').then(c => c.default), store);
    }

    ipcMain.on('online-status-changed', (_: any, s: any) => {
        store.commit('online', s[0]);
    });

    guard = new BrowserWindow({
        focusable: false,
        width: 0,
        height: 0,
        show: false,
        webPreferences: { preload: `${__static}/network-status.js`, devTools: false },
    });
    guard.loadURL(`${__static}/index.empty.html`);

    setupDownload(store, guard);
}

app.on('will-quit', () => {
    console.log('will quit');
}).on('before-quit', () => {
    console.log('before quit');
}).on('quit', () => {
    console.log('quit');
});

ipc
    .on('exit', () => { app.quit(); })
    .on('minecraft-start', () => { parking = true; })
    .on('minecraft-exit', () => { parking = false; })
    .on('store-ready', setup);

app
    .on('window-all-closed', () => {
        if (parking) return;
        if (process.platform !== 'darwin') { app.quit(); }
    })
    .on('second-instance', () => { if (instance) instance.requestFocus(); });



export function getGuardWindow() {
    return guard;
}

export default { getGuardWindow };
