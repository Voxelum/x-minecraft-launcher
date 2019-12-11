import { App, BrowserWindow, BrowserWindowConstructorOptions, ipcMain, shell, app } from 'electron';
import { EventEmitter } from 'events';
import { Store } from 'vuex';
import { join } from 'path';
import { Manager } from '.';

const isDev = process.env.NODE_ENV === 'development';
const baseURL = isDev
    ? 'http://localhost:9080/'
    : `file://${__dirname}/`;

export interface LauncherAppEventBus extends EventEmitter {
    on(channel: 'browser-window-setup', listener: (window: BrowserWindow, name: string) => void): this;
    on(channel: 'locale-changed', listener: () => void): this;

    on(channel: 'minecraft-window-ready', listener: () => void): this;
    on(channel: 'minecraft-start', listener: () => void): this;
    on(channel: 'minecraft-exit', listener: (exitStatus?: { code?: string; signal?: string; crashReport?: string; crashReportLocation?: string }) => void): this;
    on(channel: 'minecraft-stdout', listener: (out: string) => void): this;
    on(channel: 'minecraft-stderr', listener: (err: string) => void): this;
    on(channel: 'minecraft-crash-report', listener: (report: { crashReport: string; crashReportLocation: string }) => void): this;

    on(channel: 'reload', listener: () => void): this;

    on(channel: 'task-successed', listener: (id: string) => void): this;
    on(channel: 'task-failed', listener: (id: string, error: any) => void): this;
}

export interface LauncherAppContext {
    store: Store<any>;
}

export abstract class LauncherApp {
    /**
     * A map to keep running browser
     */
    protected windows: { [name: string]: BrowserWindow } = {};

    protected eventBus!: LauncherAppEventBus;

    protected store!: Store<any>;

    protected t!: (key: string) => string;

    setup(): void { }

    appReady(app: App): void { }

    abstract start(context: LauncherAppContext): Promise<void>;

    abstract requestFocus(): void;

    abstract dispose(): void;

    onLocalChanged() { }

    onMinecraftStarted() { }

    onMinecraftWindowReady() { }

    onMinecraftExited(exitStatus?: { code?: string; signal?: string; crashReport?: string; crashReportLocation?: string }) { }

    onMinecraftStdOut(content: string) { }

    onMinecraftStdErr(content: string) { }

    createWindow(name: string, option: BrowserWindowConstructorOptions) {
        const ops: BrowserWindowConstructorOptions = {
            ...option,
        };
        if (!ops.webPreferences) { ops.webPreferences = {}; }
        ops.webPreferences.webSecurity = !isDev; // disable security for loading local image
        ops.webPreferences.nodeIntegration = isDev; // enable node for webpack in dev
        ops.webPreferences.preload = join(__static, 'preload.js');
        const ref = new BrowserWindow(ops);
        ipcMain.emit('browser-window-setup', ref, name);
        ref.loadURL(`${baseURL}${name}`);
        console.log(`Create window from ${`${baseURL}${name}`}`);
        ref.on('ready-to-show', () => {
            console.log(`Window ${name} is ready to show!`);
        });
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
        this.windows[name] = ref;
        ref.on('close', () => {
            delete this.windows[name];
            if (Object.keys(this.windows).length === 0) {
                ipcMain.emit('window-all-closed');
            }
        });
        return ref;
    }
}

export default class AppManager extends Manager {
    /**
     * ref for if the game is launching and the launcher is paused
     */
    private parking = false;

    private instance: LauncherApp | undefined;

    readonly eventBus: LauncherAppEventBus = new EventEmitter();

    async setup() {
        const constructor = await import('../app/BuiltinApp').then(c => c.default);
        const app = new constructor();
        Reflect.set(app, 'eventBus', this.eventBus);
        Reflect.set(app, 't', this.managers.I18nManager.t);
        this.instance = app;
    }

    async appReady(app: App) {
        app
            .on('window-all-closed', () => {
                if (this.parking) return;
                if (process.platform !== 'darwin') { app.quit(); }
            })
            .on('second-instance', () => { if (this.instance) this.instance.requestFocus(); });
        ipcMain
            .on('exit', () => { app.quit(); })
            .on('minecraft-start', () => { this.parking = true; })
            .on('minecraft-exit', () => { this.parking = false; });
        this.instance!.appReady(app);
    }

    get isParking() { return this.parking; }

    async storeReady(store: Store<any>) {
        this.parking = true;
        // if (this.instance) {
        //     try {
        //         this.instance.dispose();
        //     } catch (e) {
        //         console.warn('An error occure during dispose.');
        //         console.error(e);
        //     }
        // }
        await this.instance!.start({ store });
        this.parking = false;
    }

    quit = app.quit

    exit = app.exit;
}
