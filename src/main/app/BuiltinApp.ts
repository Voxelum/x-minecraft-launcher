
import { App, BrowserWindow, dialog, Menu, nativeImage, Tray, Dock } from 'electron';
import { LauncherApp, LauncherAppContext } from 'main/manager/AppManager';
import { resolve } from 'path';

export default class BuiltinApp extends LauncherApp {
    private mainRef: BrowserWindow | null = null;

    private loggerRef: BrowserWindow | null = null;

    private tray: Tray | null = null;

    private dock: Dock | null = null;

    createMainWindow() {
        this.mainRef = this.createWindow('main.html', {
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
        this.loggerRef = this.createWindow('logger.html', {
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

    private createMenu(app: Electron.App) {
        return Menu.buildFromTemplate([
            { type: 'normal', label: this.t('launcher.checkUpdate') },
            { type: 'separator' },
            {
                label: this.t('launcher.showDiagnosis'),
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
                            message: `CPU: ${JSON.stringify(cpu)}\nMem: ${JSON.stringify(m)}\nSysMem: ${JSON.stringify(sysmem)}`,
                        });
                    });
                },
            },
            { type: 'separator' },
            {
                label: this.t('launcher.quit'),
                type: 'normal',
                click(item, window, event) {
                    app.quit();
                },
            },
        ]);
    }

    private setupTray(app: Electron.App) {
        const img = nativeImage.createFromPath(`${__static}/favicon@2x.png`);
        const tray = new Tray(img);
        tray.setContextMenu(this.createMenu(app));
        tray.on('click', () => {
            if (this.loggerRef && !this.loggerRef.isFocused()) {
                this.loggerRef.focus();
            } else if (this.mainRef && !this.mainRef.isFocused()) {
                this.mainRef.focus();
            }
        }).on('double-click', () => {
            if (this.loggerRef) {
                if (this.loggerRef.isVisible()) this.loggerRef.hide();
                else this.loggerRef.show();
            } else if (this.mainRef) {
                if (this.mainRef.isVisible()) this.mainRef.hide();
                else this.mainRef.show();
            }
        });
        this.tray = tray;
        this.eventBus.on('locale-changed', () => {
            if (tray) {
                tray.setToolTip(this.t('launcher.title'));
                tray.setContextMenu(this.createMenu(app));
            }
        });
        this.dock = app.dock;
        this.dock.setIcon(nativeImage.createFromPath(`${__static}/apple-touch-icon.png`));
    }

    onMinecraftWindowReady = () => {
        const { getters } = this.store;
        if (this.mainRef && this.mainRef.isVisible()) {
            this.mainRef.webContents.send('minecraft-window-ready');
            const { hideLauncher } = getters.selectedProfile;
            if (hideLauncher) {
                this.mainRef.hide();
            }
        }

        if (this.loggerRef === undefined && getters.selectedProfile.showLog) {
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

        this.dock?.setMenu(Menu.buildFromTemplate([{
            label: 'Show Log',
            type: 'normal',
            click,
        }]));
    }

    onMinecraftStdOut = (content: string) => {
        if (this.loggerRef) {
            this.loggerRef.webContents.send('minecraft-stdout', content);
        }
    }

    onMinecraftStdErr = (content: string) => {
        if (this.loggerRef) {
            this.loggerRef.webContents.send('minecraft-stderr', content);
        }
    }

    onMinecraftExited = (status: any) => {
        const { hideLauncher } = this.store.getters.selectedProfile;
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
            this.loggerRef = null;
        }
    }

    appReady(app: App) {
        this.setupTray(app);
        this.eventBus.on('task-successed', (id) => {
            if (this.mainRef) {
                this.mainRef.webContents.send('task-successed', id);
            }
        }).on('task-failed', (id, error) => {
            if (this.mainRef) {
                this.mainRef.webContents.send('task-failed', id, error);
            }
        })
            .on('minecraft-window-ready', this.onMinecraftWindowReady)
            .on('minecraft-stdout', this.onMinecraftStdOut)
            .on('minecraft-stderr', this.onMinecraftStdErr)
            .on('minecraft-exit', this.onMinecraftExited);
    }

    async start(context: LauncherAppContext): Promise<void> {
        this.store = context.store;
        this.createMainWindow();
    }

    requestFocus(): void {
        if (this.mainRef) {
            this.mainRef.focus();
        } else if (this.loggerRef) {
            this.loggerRef.focus();
        }
    }

    dispose(): void {
        if (this.mainRef) {
            this.mainRef.close();
            this.mainRef = null;
        }
        if (this.loggerRef) {
            this.loggerRef.close();
            this.loggerRef = null;
        }
    }
}
