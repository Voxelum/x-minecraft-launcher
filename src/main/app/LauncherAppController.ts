import { LauncherAppContext } from '@main/manager/AppManager';
import { StaticStore } from '@main/util/staticStore';
import { App, BrowserWindow, BrowserWindowConstructorOptions, Dock, Menu, NativeImage, Tray } from 'electron';

export abstract class LauncherAppController {
    protected app!: App;

    protected Tray!: typeof Tray;

    protected Dock!: typeof Dock;

    protected Menu!: typeof Menu;

    protected getNativeImageAsset!: ((imageName: string) => NativeImage);

    protected newWindow!: ((name: string, url: string, options: BrowserWindowConstructorOptions) => BrowserWindow);

    protected getStaticFile!: (file: string) => string;

    protected store!: StaticStore<any>;

    abstract setup(context: LauncherAppContext): void;

    abstract appReady(app: App): void;

    abstract dataReady(store: StaticStore<string>): Promise<void>;

    abstract requestOpenExternalUrl(url: string): Promise<boolean>;

    abstract updateProgress(progress: number): void;
}
