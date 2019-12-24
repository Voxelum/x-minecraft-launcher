
import { App, BrowserWindow, dialog, Dock, Menu, nativeImage, Tray } from 'electron';
import { EventEmitter } from 'events';
import { createI18n } from 'main/utils/i18n';
import { resolve } from 'path';
import en from '../utils/locales/en.json';
import zh from '../utils/locales/zh-CN.json';
import { LauncherAppController } from './LauncherAppController';

export function focusOnClick(getWindow: () => BrowserWindow | undefined) {
    return () => {
        const window = getWindow();
        if (window && !window.isFocused()) {
            window.focus();
        }
    };
}

export function toggleVisibilityOnDoubleClick(getWindow: () => BrowserWindow | undefined) {
    return () => {
        const window = getWindow();
        if (window) {
            if (window.isVisible()) window.hide();
            else window.show();
        }
    };
}

export function forwardEvent(event: string, eventEmitter: EventEmitter, getBrowser: () => (BrowserWindow | undefined)) {
    eventEmitter.on(event, (...args: any[]) => {
        // eslint-disable-next-line no-unused-expressions
        getBrowser()?.webContents.send(event, ...args);
    });
}


const isDev = process.env.NODE_ENV === 'development';
const baseURL = isDev
    ? 'http://localhost:9080/'
    : `file://${__dirname}/`;


export default class BuiltinController extends LauncherAppController {
    private mainRef: BrowserWindow | undefined = undefined;

    private loggerRef: BrowserWindow | undefined = undefined;

    private tray: Tray | undefined = undefined;

    private dock: Dock | undefined = undefined;

    private i18n = createI18n({ en, zh }, 'en');

    private primary: BrowserWindow | undefined;

    constructor() {
        super();
    }

    createMainWindow() {
        this.mainRef = this.newWindow('main', `${baseURL}main.html`, {
            title: 'VoxeLauncher',
            width: 800,
            height: 580,
            resizable: false,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            icon: resolve(__static, 'apple-touch-icon.png'),
        });
        this.mainRef!.show();
    }

    createLoggerWindow() {
        this.loggerRef = this.newWindow('logger', `${baseURL}logger.html`, {
            title: 'VoxeLauncher',
            width: 770,
            height: 580,
            frame: false,
            transparent: true,
            hasShadow: false,
            maximizable: false,
            icon: resolve(__static, 'apple-touch-icon.png'),
        });
    }

    setup(): void { }

    async requestOpenExternalUrl(url: string) {
        const { t: $t } = this.i18n;
        const result = await dialog.showMessageBox(BrowserWindow.getAllWindows()[0], {
            type: 'question',
            title: $t('openUrl.title', { url }),
            message: $t('openUrl.message', { url }),
            checkboxLabel: $t('openUrl.trust'),
            buttons: [$t('openUrl.cancel'), $t('openUrl.yes')],
        });
        return result.response === 1;
    }

    private createMenu(app: App) {
        const { t: $t } = this.i18n;
        return Menu.buildFromTemplate([
            { type: 'normal', label: $t('checkUpdate') },
            { type: 'separator' },
            {
                label: $t('showDiagnosis'),
                type: 'normal',
                click() {
                    const cpu = process.getCPUUsage();
                    const mem = process.getProcessMemoryInfo();
                    const sysmem = process.getSystemMemoryInfo();

                    const p: Promise<Electron.ProcessMemoryInfo> = mem instanceof Promise ? mem : Promise.resolve(mem);
                    p.then((m) => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Diagnosis Info',
                            message: `Mode: ${process.env.NODE_ENV}\nCPU: ${JSON.stringify(cpu)}\nMem: ${JSON.stringify(m)}\nSysMem: ${JSON.stringify(sysmem)}`,
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

    private setupTray(app: Electron.App) {
        const img = nativeImage.createFromPath(`${__static}/favicon@2x.png`);
        const tray = new Tray(img);
        tray.setContextMenu(this.createMenu(app));

        const { t: $t } = this.i18n;

        tray.on('click', focusOnClick(() => this.primary))
            .on('double-click', toggleVisibilityOnDoubleClick(() => this.primary));
        this.tray = tray;
        this.app.on('locale-changed', () => {
            if (tray) {
                tray.setToolTip($t('title'));
                tray.setContextMenu(this.createMenu(app));
            }
        });
        if (app.dock) {
            this.dock = app.dock;
            this.dock.setIcon(nativeImage.createFromPath(`${__static}/apple-touch-icon.png`));
        }
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

        const click = () => {
            if (!this.loggerRef) {
                this.createLoggerWindow();
            } else if (!this.loggerRef.isVisible()) {
                this.loggerRef.show();
            } else {
                this.loggerRef.focus();
            }
        };

        if (this.dock) {
            this.dock.setMenu(Menu.buildFromTemplate([{
                label: 'Show Log',
                type: 'normal',
                click,
            }]));
        }
    }

    onMinecraftExited(status: any) {
        const { hideLauncher } = this.store.getters.instance;
        if (hideLauncher) {
            if (this.mainRef) {
                this.mainRef.show();
            }
        }
        if (this.mainRef) {
            this.mainRef.webContents.send('minecraft-exit', status);
        }
        if (this.loggerRef) {
            this.loggerRef.close();
            this.loggerRef = undefined;
        }
    }

    appReady(app: App) {
        this.createMainWindow();
        this.setupTray(app);

        forwardEvent('task-successed', app, () => this.loggerRef);
        forwardEvent('task-failed', app, () => this.loggerRef);
        forwardEvent('minecraft-stdout', app, () => this.loggerRef);
        forwardEvent('minecraft-stderr', app, () => this.loggerRef);

        this.app
            .on('minecraft-window-ready', this.onMinecraftWindowReady.bind(this))
            .on('minecraft-exit', this.onMinecraftExited.bind(this));
    }

    async dataReady(): Promise<void> {
        this.mainRef!.show();
    }
}
