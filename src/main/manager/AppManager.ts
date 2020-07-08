import { LauncherAppController } from '@main/app/LauncherAppController';
import BuiltinController from '@main/builtin/BuiltinController';
import { IS_DEV, LAUNCHER_NAME } from '@main/constant';
import { isDirectory } from '@main/util/fs';
import { getPlatform } from '@xmcl/core';
import { App, app, BrowserWindow, BrowserWindowConstructorOptions, Dock, ipcMain, Menu, NativeImage, nativeImage, session, shell, Tray } from 'electron';
import { readFile } from 'fs-extra';
import { join } from 'path';
import { ParsedUrlQuery } from 'querystring';
import { parse as parseUrl } from 'url';
import { Store } from 'vuex';
import { Manager } from '.';

export interface LauncherAppContext {
    getNativeImageAsset(imageName: string): NativeImage;

    Tray: typeof Tray;

    Dock: typeof Dock;

    Menu: typeof Menu;
}

const BUILTIN_TRUSTED = Object.freeze(['https://www.java.com/download/']);

function queryToWindowOptions(query: ParsedUrlQuery) {
    function num(key: string) { return key in query && typeof query[key] === 'string' ? Number.parseFloat(query[key] as string) : undefined; }
    function str(key: string) { return key in query && typeof query[key] === 'string' ? query[key] as string : undefined; }
    function bool(key: string) { return key in query && typeof query[key] === 'string' ? query[key] === 'true' : undefined; }
    return {
        width: num('width'),
        height: num('height'),
        x: num('x'),
        y: num('y'),
        useContentSize: bool('useContentSize'),
        center: bool('center'),
        minWidth: num('minWidth'),
        minHeight: num('minHeight'),
        maxWidth: num('maxWidth'),
        maxHeight: num('maxHeight'),
        resizable: bool('resizable'),
        movable: bool('movable'),
        minimizable: bool('minimizable'),
        maximizable: bool('maximizable'),
        closable: bool('closable'),
        focusable: bool('focusable'),
        alwaysOnTop: bool('alwaysOnTop'),
        fullscreen: bool('fullscreen'),
        fullscreenable: bool('fullscreenable'),
        simpleFullscreen: bool('simpleFullscreen'),
        skipTaskbar: bool('skipTaskbar'),
        title: str('title'),
        show: bool('show'),
        paintWhenInitiallyHidden: bool('paintWhenInitiallyHidden'),
        frame: bool('frame'),
        modal: bool('modal'),
        acceptFirstMouse: bool('acceptFirstMouse'),
        disableAutoHideCursor: bool('disableAutoHideCursor'),
        autoHideMenuBar: bool('autoHideMenuBar'),
        enableLargerThanScreen: bool('enableLargerThanScreen'),
        backgroundColor: str('backgroundColor'),
        hasShadow: bool('hasShadow'),
        opacity: num('opacity'),
        darkTheme: bool('darkTheme'),
        transparent: bool('transparent'),
        type: str('type'),
        titleBarStyle: str('titleBarStyle'),
        fullscreenWindowTitle: bool('fullscreenWindowTitle'),
        thickFrame: bool('thickFrame'),
        vibrancy: str('vibrancy'),
        tabbingIdentifier: str('tabbingIdentifier'),
        zoomToPageWidth: bool('zoomToPageWidth'),
    } as BrowserWindowConstructorOptions;
}

const APP_DATA = app.getPath('appData');
const CFG_PATH = `${app.getPath('appData')}/xmcl/launcher.json`;

export type ExtendsApp = Pick<typeof ipcMain, 'handle'> & Pick<typeof app, 'getPath'>;

export interface AppManager extends ExtendsApp {
}
export class AppManager extends Manager {
    public app = app;

    /**
     * Launcher root
     */
    public root!: string;

    /**
     * ref for if the game is launching and the launcher is paused
     */
    private parking = false;

    private controller: LauncherAppController;

    /**
     * A map to keep running browser
     */
    private windows: { [name: string]: BrowserWindow } = {};

    private trustedSites: string[] = [];

    readonly platform = getPlatform();

    constructor() {
        super();
        this.root = join(app.getPath('appData'), LAUNCHER_NAME);
        this.handle = ipcMain.handle;
        this.controller = undefined as any;
    }

    async startApp() {
        Reflect.set(LauncherAppController.prototype, 'app', app);
        Reflect.set(LauncherAppController.prototype, 'Tray', Tray);
        Reflect.set(LauncherAppController.prototype, 'Dock', Dock);
        Reflect.set(LauncherAppController.prototype, 'Menu', Menu);
        Reflect.set(LauncherAppController.prototype, 'newWindow', this.newWindow.bind(this));

        if (process.platform === 'win32') {
            const launchUrl = process.argv[process.argv.length - 1];
            if (launchUrl && launchUrl.trim().length !== 0) {
                await this.handleUrlRequest(launchUrl).then(() => true, () => false);
            }
        }

        if (!this.controller) {
            this.controller = new BuiltinController();
        }

        app.on('open-url', (event, url) => {
            event.preventDefault();
            this.handleUrlRequest(url);
        }).on('second-instance', (e, argv) => {
            if (process.platform === 'win32') {
                // Keep only command line / deep linked arguments
                this.handleUrlRequest(argv[argv.length - 1]);
            }
        });
    }

    /**
     * Launch app from url request
     * @param url 
     */
    async handleUrlRequest(url: string) {
        try {
            const { host, query } = parseUrl(url, true);
            if (host === 'app') {
                // TODO: implement app
                const host = query.url as string;
                // let loader = new AppLoader(host, join(host));
                // let controller = await loader.loadController();
            } else if (host === 'window') {
                const windowUrl = query.url;
                const name = query.name as string || url;
                let icon: NativeImage | undefined;
                if (typeof query.icon === 'string') {
                    // TODO: cache this
                    icon = nativeImage.createFromBuffer(await this.managers.networkManager.request(query.icon).buffer());
                }
                this.newWindow(name, windowUrl as string, { ...queryToWindowOptions(query), icon });
            }
        } catch (e) {
            this.error(e);
        }
    }

    /**
     * Open window for current app
     * @param name The name of the window
     * @param url The url of the window
     * @param options The construct options
     */
    newWindow(name: string, url: string, options: BrowserWindowConstructorOptions) {
        const normalizedOptions: BrowserWindowConstructorOptions = {
            ...options,
        };

        if (!normalizedOptions.webPreferences) { normalizedOptions.webPreferences = {}; }
        normalizedOptions.webPreferences.webSecurity = !IS_DEV; // disable security for loading local image
        normalizedOptions.webPreferences.nodeIntegration = IS_DEV; // enable node for webpack in dev
        // ops.webPreferences.enableRemoteModule = true;
        normalizedOptions.webPreferences.preload = join(__static, 'preload.js');
        normalizedOptions.webPreferences.session = session.fromPartition(`persist:${name}`);
        // normalizedOptions.webPreferences.devTools = false;

        const ref = new BrowserWindow(normalizedOptions);
        this.setupBrowserLogger(ref, name);

        this.log(`Create window from ${url}`);

        ref.loadURL(url);
        ref.webContents.on('will-navigate', (event, url) => {
            event.preventDefault();
            if (!IS_DEV) {
                shell.openExternal(url);
            } else if (!url.startsWith('http://localhost')) {
                shell.openExternal(url);
            }
        });
        ref.on('ready-to-show', () => { this.log(`Window ${name} is ready to show!`); });
        ref.on('close', () => { delete this.windows[name]; });

        this.windows[name] = ref;

        return ref;
    }

    private setupBrowserLogger(ref: BrowserWindow, name: string) {
        const stream = this.managers.logManager.openWindowLog(name);
        const levels = ['INFO', 'WARN', 'ERROR'];
        ref.webContents.on('console-message', (e, level, message, line, id) => {
            stream.write(`[${levels[level]}] [${new Date().toUTCString()}] [${id}]: ${message}\n`);
        });
        ref.once('close', () => {
            ref.webContents.removeAllListeners('console-message');
            this.managers.logManager.closeWindowLog(name);
        });
    }


    get isParking() { return this.parking; }

    async getTrustedSites() {
        return this.trustedSites;
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
        if ([...BUILTIN_TRUSTED, ...this.trustedSites].indexOf(url) === -1) {
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

    /**
     * Push an event to the client
     */
    push(channel: string, ...payload: any[]) {
        Object.values(this.windows).map(w => w.webContents).forEach(c => {
            c.send(channel, ...payload);
        });
    }

    showItemInFolder = shell.showItemInFolder;

    quit = app.quit;

    exit = app.exit;

    getPath = app.getPath;

    // setup code

    async setup() {
        Reflect.set(LauncherAppController.prototype, 'app', app);
        Reflect.set(LauncherAppController.prototype, 'Tray', Tray);
        Reflect.set(LauncherAppController.prototype, 'Dock', Dock);
        Reflect.set(LauncherAppController.prototype, 'Menu', Menu);
        Reflect.set(LauncherAppController.prototype, 'managers', this.managers);
        Reflect.set(LauncherAppController.prototype, 'newWindow', this.newWindow.bind(this));

        if (process.platform === 'win32') {
            const launchUrl = process.argv[process.argv.length - 1];
            if (launchUrl && launchUrl.trim().length !== 0) {
                await this.handleUrlRequest(launchUrl).then(() => true, () => false);
            }
        }

        if (!this.controller) {
            this.controller = new BuiltinController();
        }

        app.on('open-url', (event, url) => {
            event.preventDefault();
            this.handleUrlRequest(url);
        }).on('second-instance', (e, argv) => {
            if (process.platform === 'win32') {
                // Keep only command line / deep linked arguments
                this.handleUrlRequest(argv[argv.length - 1]);
            }
        });
    }

    async rootReady(root: string) {
        const sites = await readFile(join(root, 'sites')).then((b) => b.toString().split('\n')).catch(() => []);
        this.trustedSites = sites;
    }

    async appReady(app: App) {
        app
            .on('window-all-closed', () => {
                if (this.parking) return;
                if (process.platform !== 'darwin') { app.quit(); }
            })
            .on('minecraft-start', () => { this.parking = true; })
            .on('minecraft-exit', () => { this.parking = false; });
        ipcMain
            .on('exit', () => { app.quit(); });

        this.controller!.appReady(app);
    }

    async storeReady(store: Store<any>) {
        this.parking = true;
        if (!store.state.locale) {
            store.commit('locale', app.getLocale());
        }
        Object.assign(LauncherAppController.prototype, { store });
        await this.controller!.dataReady(store);
        this.log('App booted');
        this.parking = false;
    }
}

export default AppManager;
