
import { BrowserWindow, Tray } from '@main/engineBridge';
import { createI18n } from '@main/util/i18n';
import { TaskNotification } from '@universal/util/notification';
import { StaticStore } from '@universal/util/staticStore';
import { resolve } from 'path';
import LauncherApp, { AppContext } from './LauncherApp';
import en from './locales/en.json';
import zh from './locales/zh-CN.json';

const isDev = process.env.NODE_ENV === 'development';
const baseURL = isDev
    ? 'http://localhost:9080/'
    : `file://${__dirname}/`;


export default class LauncherAppController {
    private mainRef: BrowserWindow | undefined = undefined;

    private loggerRef: BrowserWindow | undefined = undefined;

    private setupRef: BrowserWindow | undefined = undefined;

    private i18n = createI18n({ en, 'zh-CN': zh }, 'en');

    private primary: BrowserWindow | undefined;

    private tray: Tray | undefined;

    private store!: StaticStore<any>;

    constructor(protected app: LauncherApp, protected context: AppContext) { }

    createMainWindow() {
        this.mainRef = this.context.openWindow('main', `${baseURL}main.html`, {
            title: 'XMCL',
            width: 800,
            height: 580,
            resizable: false,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            vibrancy: 'sidebar', // or popover
            icon: resolve(__static, 'apple-touch-icon.png'),
        });

        this.mainRef!.show();
    }

    createLoggerWindow() {
        this.loggerRef = this.context.openWindow('logger', `${baseURL}logger.html`, {
            title: 'XMCL',
            width: 770,
            height: 580,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            icon: resolve(__static, 'apple-touch-icon.png'),
        });
    }

    createSetupWindow() {
        this.setupRef = this.context.openWindow('setup', `${baseURL}setup.html`, {
            title: 'Setup XMCL',
            width: 480,
            height: 480,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            vibrancy: 'sidebar', // or popover
            icon: resolve(__static, 'apple-touch-icon.png'),
        });
    }

    async requestOpenExternalUrl(url: string) {
        const { t: $t } = this.i18n;
        if (this.context.dialog) {
            const result = await this.context.dialog.showMessageBox(this.primary!, {
                type: 'question',
                title: $t('openUrl.title', { url }),
                message: $t('openUrl.message', { url }),
                checkboxLabel: $t('openUrl.trust'),
                buttons: [$t('openUrl.cancel'), $t('openUrl.yes')],
            });
            return result.response === 1;
        }
        return true;
    }

    private createMenu() {
        const { t: $t } = this.i18n;
        if (!this.context.buildMenuFromTemplate) {
            return null;
        }
        const app = this.app;
        const dialog = this.context.dialog;
        return this.context.buildMenuFromTemplate([
            { type: 'normal', label: $t('checkUpdate') },
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
                        dialog!.showMessageBox({
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
        if (!this.context.createTray) { return; }
        const tray = this.context.createTray(`${__static}/favicon@2x.png`);
        tray.setContextMenu(this.createMenu());
        tray.on('click', () => {
            const window = this.primary;
            if (window && !window.isFocused()) {
                window.focus();
            }
        }).on('double-click', () => {
            const window = this.primary;
            if (window) {
                if (window.isVisible()) window.hide();
                else window.show();
            }
        });
        if (this.context.dock) {
            this.context.dock.setIcon(`${__static}/apple-touch-icon.png`);
        }
        this.tray = tray;
    }

    onMinecraftWindowReady() {
        const { getters } = this.store;
        if (this.mainRef && this.mainRef.isVisible()) {
            this.mainRef.webContents.send('minecraft-window-ready');

            const { hideLauncher } = getters.instance;
            if (hideLauncher) {
                this.mainRef.hide();
            }
        }

        if (this.loggerRef === undefined && getters.instance.showLog) {
            this.createLoggerWindow();
        }

        // const click = () => {
        //     if (!this.loggerRef) {
        //         this.createLoggerWindow();
        //     } else if (!this.loggerRef.isVisible()) {
        //         this.loggerRef.show();
        //      } else {
        //         this.loggerRef.focus();
        //     }
        // };

        // if (this.context.dock && this.context.buildMenuFromTemplate) {
        //     this.context.dock.setMenu(this.context.buildMenuFromTemplate([{
        //         label: 'Show Log',
        //         type: 'normal',
        //         click,
        //     }]));
        // }
    }

    onMinecraftExited(status: any) {
        const { hideLauncher } = this.store.getters.instance;
        if (hideLauncher) {
            if (this.mainRef) {
                this.mainRef.show();
            }
        }
        this.app.broadcast('minecraft-exit', status);
        if (this.loggerRef) {
            this.loggerRef.close();
            this.loggerRef = undefined;
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
                this.context.closeWindow('setup');
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
        this.mainRef!.show();
        this.store = store;
        this.store.subscribe((mutation) => {
            if (mutation.type === 'locale') {
                this.i18n.use(mutation.payload);
            }
        });
        this.i18n.use(this.store.state.setting.locale);

        const $t = this.i18n.t;
        const tray = this.tray;
        if (tray) {
            store.subscribe((m) => {
                if (m.type === 'locale-change') {
                    tray.setToolTip($t('title'));
                    tray.setContextMenu(this.createMenu());
                }
            });
        }
    }

    get activeWindow() {
        return this.mainRef ?? this.loggerRef;
    }

    private setupTask() {
        const tasks = this.app.taskManager;
        tasks.runtime.on('update', ({ progress, total }, node) => {
            if (tasks.getActiveTask()?.root.id === node.id && progress && total) {
                if (this.activeWindow && !this.activeWindow.isDestroyed()) {
                    this.activeWindow.setProgressBar(progress / total);
                }
            }
        });
        tasks.runtime.on('finish', (_, node) => {
            if (tasks.getActiveTask()?.root.id === node.id) {
                if (this.activeWindow && !this.activeWindow.isDestroyed()) {
                    this.activeWindow.setProgressBar(-1);
                }
            }
            if (tasks.isRootTask(node.id)) {
                this.notify({ type: 'taskFinish', name: node.path, arguments: node.arguments });
            }
        });
        tasks.runtime.on('fail', (_, node) => {
            if (tasks.getActiveTask()?.root.id === node.id) {
                if (this.activeWindow && !this.activeWindow.isDestroyed()) {
                    this.activeWindow.setProgressBar(-1);
                }
            }
            if (tasks.isRootTask(node.id)) {
                this.notify({ type: 'taskFail', name: node.path, arguments: node.arguments });
            }
        });
        tasks.runtime.on('execute', (node, parent) => {
            if (!parent) {
                this.notify({ type: 'taskStart', name: node.path, arguments: node.arguments });
            }
        });
    }

    private notify(n: TaskNotification) {
        const $t = this.i18n.t;
        if (this.activeWindow && this.activeWindow.isFocused()) {
            this.activeWindow.webContents.send('notification', n);
        } else if ((n.type === 'taskFinish' || n.type === 'taskFail') && this.context.createNotification) {
            let notification = this.context.createNotification({
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
