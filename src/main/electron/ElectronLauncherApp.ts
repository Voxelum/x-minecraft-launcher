import LauncherApp, { AppContext } from '@main/app/LauncherApp';
import { BUILTIN_TRUSTED_SITES, IS_DEV } from '@main/constant';
import { acrylic } from '@main/util/acrylic';
import { isDirectory } from '@main/util/fs';
import { UpdateInfo } from '@universal/entities/update';
import { StaticStore } from '@universal/util/staticStore';
import { Task } from '@xmcl/task';
import { app, BrowserWindow, BrowserWindowConstructorOptions, ipcMain, session, shell, dialog, Tray, Menu, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import { checkUpdateTask as _checkUpdateTask, downloadAsarUpdateTask, downloadFullUpdateTask, quitAndInstallAsar, quitAndInstallFullUpdate } from '../app/updater';

export default class ElectronLauncherApp extends LauncherApp {
    get version() { return app.getVersion(); }

    getContext(): AppContext {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const isWin = this.platform.name === 'windows';
        return {
            dock: app.dock,
            dialog,
            createTray(image) {
                return new Tray(image);
            },
            buildMenuFromTemplate(template) {
                return Menu.buildFromTemplate(template);
            },
            createNotification(notificationOptions) {
                return new Notification(notificationOptions);
            },
            closeWindow(name) {
                const win = self.windows[name];
                win.removeAllListeners();
                win.close();
                delete self.windows[name];
            },
            openWindow(name, url, options) {
                const normalizedOptions: BrowserWindowConstructorOptions = {
                    ...options,
                };

                if (!normalizedOptions.webPreferences) { normalizedOptions.webPreferences = {}; }
                normalizedOptions.webPreferences.webSecurity = !IS_DEV; // disable security for loading local image
                normalizedOptions.webPreferences.nodeIntegration = IS_DEV; // enable node for webpack in dev
                normalizedOptions.webPreferences.preload = join(__static, 'preload.js');
                normalizedOptions.webPreferences.session = session.fromPartition(`persist:${name}`);
                normalizedOptions.webPreferences.webviewTag = true;
                // ops.webPreferences.enableRemoteModule = true;
                // normalizedOptions.webPreferences.devTools = false;

                const ref = new BrowserWindow(normalizedOptions);

                self.log(`Create window from ${url}`);
                self.setupBrowserLogger(ref, name);

                ref.loadURL(url);
                ref.webContents.on('will-navigate', (event, url) => {
                    event.preventDefault();
                    if (!IS_DEV) {
                        shell.openExternal(url);
                    } else if (!url.startsWith('http://localhost')) {
                        shell.openExternal(url);
                    }
                });
                ref.on('ready-to-show', () => { self.log(`Window ${name} is ready to show!`); });
                ref.on('close', () => { delete self.windows[name]; });

                self.windows[name] = ref;

                if (normalizedOptions.vibrancy && isWin) {
                    setTimeout(() => {
                        const id = ref!.webContents.getOSProcessId();
                        self.log(`Set window Acrylic transparent ${id}`);
                        acrylic(id).then((e) => {
                            if (e) {
                                self.log('Set window Acrylic success');
                            } else {
                                self.warn('Set window Acrylic failed');
                            }
                        }, (e) => {
                            self.warn('Set window Acrylic failed');
                            self.warn(e);
                        });
                    }, 100);
                }

                return ref;
            },
        };
    }

    /**
     * A map to keep running browser
     */
    protected windows: { [name: string]: BrowserWindow } = {};

    showItemInFolder = shell.showItemInFolder;

    quitApp = app.quit;

    exit = app.exit;

    getPath(key: string) {
        return app.getPath(key as any);
    }

    handle = ipcMain.handle;

    /**
     * Push a event with payload to client.
     *
     * @param channel The event channel to client
     * @param payload The event payload to client
     */
    broadcast(channel: string, ...payload: any[]): void {
        Object.values(this.windows).map(w => w.webContents).forEach(c => {
            c.send(channel, ...payload);
        });
    }


    /**
     * A safe method that only open directory. If the `path` is a file, it won't execute it.
     * @param file The directory path
     */
    async openDirectory(path: string) {
        if (await isDirectory(path)) {
            return shell.openItem(path);
        }
        return false;
    }

    /**
     * Try to open a url in default browser. It will popup a message dialog to let user know.
     * If user does not trust the url, it won't open the site.
     * @param url The pending url
     */
    async openInBrowser(url: string) {
        if ([...BUILTIN_TRUSTED_SITES, ...this.trustedSites].indexOf(url) === -1) {
            const result = await this.controller!.requestOpenExternalUrl(url);
            if (result) {
                this.trustedSites.push(url);
                shell.openExternal(url);
                return true;
            }
        } else {
            shell.openExternal(url);
            return true;
        }
        return false;
    }

    checkUpdateTask(): Task<UpdateInfo> {
        return _checkUpdateTask.bind(this)();
    }

    downloadUpdateTask(): Task<void> {
        if (this.storeManager.store.state.setting.updateInfo) {
            if (this.storeManager.store.state.setting.updateInfo.incremental) {
                return downloadFullUpdateTask();
            }
            return downloadAsarUpdateTask.bind(this)();
        }
        throw new Error('Please check update first!');
    }

    async installUpdateAndQuit(): Promise<void> {
        if (this.storeManager.store.state.setting.updateInfo) {
            if (this.storeManager.store.state.setting.updateInfo.incremental) {
                await quitAndInstallAsar.bind(this)();
            } else {
                quitAndInstallFullUpdate();
            }
        } else {
            throw new Error('Please check and download update first!');
        }
    }

    waitEngineReady(): Promise<void> {
        return app.whenReady();
    }

    getModule(module: string) {
        if (module === 'electron') {
            return {};
        }
        return undefined;
    }

    relaunch() {
        app.relaunch();
    }

    protected async setup() {
        process.on('SIGINT', () => {
            app.quit();
        });

        if (!app.requestSingleInstanceLock()) {
            app.quit();
        }

        if (!app.isDefaultProtocolClient('xmcl')) {
            app.setAsDefaultProtocolClient('xmcl');
        }

        if (!IS_DEV && process.platform === 'win32') {
            if (process.argv.length > 1) {
                const urlOrPath = process.argv[process.argv.length - 1];
                if (!(urlOrPath.startsWith('https:') || urlOrPath.startsWith('http:')) && !await this.startFromUrl(urlOrPath).then(() => true, () => false)) {
                    this.startFromFilePath(urlOrPath).then(() => true, () => false);
                }
            }
        }

        // forward window-all-closed event
        app.on('window-all-closed', () => {
            this.emit('window-all-closed');
        });

        app.on('open-url', (event, url) => {
            event.preventDefault();
            this.startFromUrl(url);
        }).on('second-instance', (e, argv) => {
            if (process.platform === 'win32') {
                // Keep only command line / deep linked arguments
                this.startFromFilePath(argv[argv.length - 1]);
            }
        });

        await super.setup();
    }

    protected async onEngineReady() {
        app.allowRendererProcessReuse = true;
        return super.onEngineReady();
    }

    getLocale() {
        return app.getLocale();
    }

    protected async onStoreReady(store: StaticStore<any>) {
        this.parking = true;

        store.subscribe(({ type, payload }) => {
            if (type === 'autoInstallOnAppQuit') {
                autoUpdater.autoInstallOnAppQuit = payload;
            } else if (type === 'allowPrerelease') {
                // autoUpdater.allowPrerelease = payload;
            } else if (type === 'autoDownload') {
                autoUpdater.autoDownload = payload;
            }
        });

        if (!store.state.locale) {
            store.commit('locale', app.getLocale());
        }

        this.log(`Current launcher core version is ${this.version}.`);

        autoUpdater.autoInstallOnAppQuit = store.state.setting.autoInstallOnAppQuit;
        autoUpdater.autoDownload = store.state.setting.autoDownload;
        // autoUpdater.allowPrerelease = store.state.setting.allowPrerelease;

        autoUpdater.allowPrerelease = true;

        this.storeManager.store.commit('version', [app.getVersion(), process.env.BUILD_NUMBER]);

        await super.onStoreReady(store);
    }

    private setupBrowserLogger(ref: BrowserWindow, name: string) {
        const stream = this.logManager.openWindowLog(name);
        const levels = ['INFO', 'WARN', 'ERROR'];
        ref.webContents.on('console-message', (e, level, message, line, id) => {
            stream.write(`[${levels[level]}] [${new Date().toUTCString()}] [${id}]: ${message}\n`);
        });
        ref.once('close', () => {
            ref.webContents.removeAllListeners('console-message');
            this.logManager.closeWindowLog(name);
        });
    }
}
