
import { LauncherAppController } from '@main/app/LauncherAppController';
import { IS_DEV } from '@main/constant';
import BaseService from '@main/service/BaseService';
import { acrylic } from '@main/util/acrylic';
import { TaskNotification } from '@universal/entities/notification';
import { StaticStore } from '@universal/util/staticStore';
import { app, BrowserWindow, dialog, Menu, session, Tray, Notification } from 'electron';
import { join, resolve } from 'path';
import LauncherApp from '../app/LauncherApp';
import i18n from './locales';

const isDev = process.env.NODE_ENV === 'development';
const baseURL = isDev
    ? 'http://localhost:9080/'
    : `file://${__dirname}/`;


export default class Controller implements LauncherAppController {
    private mainWin: BrowserWindow | undefined = undefined;

    private loggerWin: BrowserWindow | undefined = undefined;

    private setupRef: BrowserWindow | undefined = undefined;

    private i18n = i18n;

    private tray: Tray | undefined;

    private store!: StaticStore<any>;

    constructor(protected app: LauncherApp) { }
   
    private setupBrowserLogger(ref: BrowserWindow, name: string) {
        const stream = this.app.logManager.openWindowLog(name);
        const levels = ['INFO', 'WARN', 'ERROR'];
        ref.webContents.on('console-message', (e, level, message, line, id) => {
            stream.write(`[${levels[level]}] [${new Date().toUTCString()}] [${id}]: ${message}\n`);
        });
        ref.once('close', () => {
            ref.webContents.removeAllListeners('console-message');
            this.app.logManager.closeWindowLog(name);
        });
    }

    private setWindowArcry(browser: BrowserWindow) {
        const isWin = this.app.platform.name === 'windows';
        if (isWin) {
            setTimeout(() => {
                const id = browser.webContents.getOSProcessId();
                this.app.log(`Set window Acrylic transparent ${id}`);
                acrylic(id).then((e) => {
                    if (e) {
                        this.app.log('Set window Acrylic success');
                    } else {
                        this.app.warn('Set window Acrylic failed');
                    }
                }, (e) => {
                    this.app.warn('Set window Acrylic failed');
                    this.app.warn(e);
                });
            }, 100);
        }
    }

    createMainWindow() {
        const browser = new BrowserWindow({
            title: 'KeyStone Launcher',
            minWidth: 800,
            minHeight: 580,
            width: 800,
            height: 580,
            maxWidth: 1600,
            maxHeight: 1060,
            resizable: true,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            vibrancy: 'sidebar', // or popover
            icon: resolve(__static, 'apple-touch-icon.png'),
            webPreferences: {
                webSecurity: !IS_DEV, // disable security for loading local image
                nodeIntegration: IS_DEV, // enable node for webpack in dev
                preload: join(__static, 'preload.js'),
                session: session.fromPartition('persist:main'),
                webviewTag: true,
            },
        });

        browser.on('ready-to-show', () => { this.app.log('Main Window is ready to show!'); });
        browser.on('close', () => { });

        this.setupBrowserLogger(browser, 'main');
        this.setWindowArcry(browser);

        browser.loadURL(`${baseURL}main.html`);
        browser.show();

        this.mainWin = browser;
    }

    createLoggerWindow() {
        const browser = new BrowserWindow({
            title: 'KeyStone Logger',
            width: 770,
            height: 580,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            icon: resolve(__static, 'apple-touch-icon.png'),
            webPreferences: {
                webSecurity: !IS_DEV, // disable security for loading local image
                nodeIntegration: IS_DEV, // enable node for webpack in dev
                preload: join(__static, 'preload.js'),
                session: session.fromPartition('persist:logger'),
            },
        });

        this.setupBrowserLogger(browser, 'logger');
        this.setWindowArcry(browser);

        browser.loadURL(`${baseURL}logger.html`);
        browser.show();

        this.loggerWin = browser;
    }

    createSetupWindow() {
        const browser = new BrowserWindow({
            title: 'Setup XMCL',
            width: 480,
            height: 480,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            vibrancy: 'sidebar', // or popover
            icon: resolve(__static, 'apple-touch-icon.png'),
            webPreferences: {
                webSecurity: !IS_DEV, // disable security for loading local image
                nodeIntegration: IS_DEV, // enable node for webpack in dev
                preload: join(__static, 'preload.js'),
                session: session.fromPartition('persist:setup'),
            },
        });

        this.setupBrowserLogger(browser, 'setup');
        this.setWindowArcry(browser);

        browser.loadURL(`${baseURL}setup.html`);
        browser.show();

        this.setupRef = browser;
    }

    requireFocus(): void {
        if (this.mainWin) {
            this.mainWin.focus();
        } else if (this.loggerWin) {
            this.loggerWin.focus();
        }
    }

    async requestOpenExternalUrl(url: string) {
        const { t: $t } = this.i18n;
        const result = await dialog.showMessageBox(this.mainWin!, {
            type: 'question',
            title: $t('openUrl.title', { url }),
            message: $t('openUrl.message', { url }),
            checkboxLabel: $t('openUrl.trust'),
            buttons: [$t('openUrl.cancel'), $t('openUrl.yes')],
        });
        return result.response === 1;
    }

    private createMenu() {
        const { t: $t } = this.i18n;
        const app = this.app;
        const service = this.app.serviceManager.getService(BaseService);
        return Menu.buildFromTemplate([
            {
                type: 'normal',
                label: $t('checkUpdate'),
                click() {
                    service?.checkUpdate();
                },
            },
            { type: 'separator' },
            {
                label: $t('showDiagnosis'),
                type: 'normal',
                click() {
                    const cpu = process.getCPUUsage();
                    const mem = process.getProcessMemoryInfo();

                    const p: Promise<Electron.ProcessMemoryInfo> = mem instanceof Promise ? mem : Promise.resolve(mem);
                    p.then((m) => {
                        let cpuPercentage = (cpu.percentCPUUsage * 100).toFixed(2);
                        let messages = [
                            `Mode: ${process.env.NODE_ENV}`,
                            `CPU: ${cpuPercentage}%`,
                            `Private Memory: ${m.private}KB`,
                            `Shared Memory: ${m.shared}KB`,
                            `Physically Memory: ${m.residentSet}KB`,
                        ];
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Diagnosis Info',
                            message: `${messages.join('\n')}`,
                        });
                    });
                },
            },
            { type: 'separator' },
            {
                label: $t('quit'),
                type: 'normal',
                click() {
                    app.quit();
                },
            },
        ]);
    }

    private setupTray() {
        const tray = new Tray(`${__static}/favicon@2x.png`);
        tray.on('click', () => {
            const window = this.mainWin;
            if (window && !window.isFocused()) {
                window.focus();
            }
        }).on('double-click', () => {
            const window = this.mainWin;
            if (window) {
                if (window.isVisible()) window.hide();
                else window.show();
            }
        });
        if (app.dock) {
            app.dock.setIcon(`${__static}/apple-touch-icon.png`);
        }
        this.tray = tray;
    }

    onMinecraftWindowReady() {
        const { getters } = this.store;
        if (this.mainWin && this.mainWin.isVisible()) {
            this.mainWin.webContents.send('minecraft-window-ready');

            const { hideLauncher } = getters.instance;
            if (hideLauncher) {
                this.mainWin.hide();
            }
        }

        if (this.loggerWin === undefined && getters.instance.showLog) {
            this.createLoggerWindow();
        }
    }

    onMinecraftExited(status: any) {
        const { hideLauncher } = this.store.getters.instance;
        if (hideLauncher) {
            if (this.mainWin) {
                this.mainWin.show();
            }
        }
        this.app.broadcast('minecraft-exit', status);
        if (this.loggerWin) {
            this.loggerWin.close();
            this.loggerWin = undefined;
        }
    }

    async processFirstLaunch(): Promise<string> {
        this.createSetupWindow();
        this.app.handle('preset', () => ({ locale: this.app.getLocale(), minecraftPath: this.app.minecraftDataPath, defaultPath: this.app.appDataPath }));

        return new Promise<string>((resolve) => {
            const fallback = () => {
                resolve(this.app.appDataPath);
            };
            this.setupRef!.once('closed', fallback);

            this.setupRef!.center();
            this.setupRef!.focus();

            this.app.handle('setup', (_, s) => {
                resolve(s as string);
                this.setupRef!.removeAllListeners();
                this.setupRef!.close();
                this.setupRef = undefined;
            });
        });
    }

    async engineReady() {
        this.createMainWindow();
        this.setupTray();
        this.setupTask();

        this.app.on('minecraft-stdout', (...args) => {
            this.app.broadcast('minecraft-stdout', ...args);
        });
        this.app.on('minecraft-stderr', (...args) => {
            this.app.broadcast('minecraft-stderr', ...args);
        });

        this.app
            .on('minecraft-window-ready', this.onMinecraftWindowReady.bind(this))
            .on('minecraft-exit', this.onMinecraftExited.bind(this));
    }

    async dataReady(store: StaticStore<any>): Promise<void> {
        this.mainWin!.show();
        this.store = store;
        this.store.commit('locales', this.i18n.locales);
        this.store.subscribe((mutation) => {
            if (mutation.type === 'locale') {
                this.i18n.use(mutation.payload);
            }
        });
        this.i18n.use(this.store.state.setting.locale);

        const $t = this.i18n.t;
        const tray = this.tray;
        if (tray) {
            tray.setContextMenu(this.createMenu());
            store.subscribe((m) => {
                if (m.type === 'locale') {
                    tray.setToolTip($t('title'));
                    tray.setContextMenu(this.createMenu());
                }
            });
        }
    }

    get activeWindow() {
        return this.mainWin ?? this.loggerWin;
    }

    private setupTask() {
        const tasks = this.app.taskManager;
        tasks.emitter.on('update', (uid, task) => {
            if (tasks.getActiveTask() === task) {
                if (this.activeWindow && !this.activeWindow.isDestroyed()) {
                    this.activeWindow.setProgressBar(task.progress / task.total);
                }
            }
        });
        tasks.emitter.on('success', (_, task) => {
            if (tasks.getActiveTask() === task) {
                if (this.activeWindow && !this.activeWindow.isDestroyed()) {
                    this.activeWindow.setProgressBar(-1);
                }
                this.notify({ type: 'taskFinish', name: task.path, arguments: task.param });
            }
        });
        tasks.emitter.on('fail', (_, task) => {
            if (tasks.getActiveTask() === task) {
                if (this.activeWindow && !this.activeWindow.isDestroyed()) {
                    this.activeWindow.setProgressBar(-1);
                }
                this.notify({ type: 'taskFail', name: task.path, arguments: task.param });
            }
        });
    }

    private notify(n: TaskNotification) {
        const $t = this.i18n.t;
        if (this.activeWindow && this.activeWindow.isFocused()) {
            this.activeWindow.webContents.send('notification', n);
        } else if ((n.type === 'taskFinish' || n.type === 'taskFail')) {
            let notification = new Notification({
                title: n.type === 'taskFinish' ? $t('task.success') : $t('task.fail'),
                body: $t('task.continue'),
                icon: resolve(__static, 'apple-touch-icon.png'),
            });
            notification.show();
            notification.on('click', () => {
                if (this.activeWindow?.isVisible()) {
                    this.activeWindow.focus();
                } else {
                    // eslint-disable-next-line no-unused-expressions
                    this.activeWindow?.show();
                }
            });
        } else {
            this.app.broadcast('notification', n);
        }
    }
}
